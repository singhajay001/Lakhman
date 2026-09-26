import { prisma, recordAudit, type SyncKind } from '@spirithaus/db';
import { QUEUES, syncIdempotencyKey, type ShopifySyncPayload } from '@spirithaus/jobs';
import { queue } from './queue.server.js';

export interface EnqueueSyncInput {
  shopId: string;
  shopDomain: string;
  kind: SyncKind;
  trigger: ShopifySyncPayload['trigger'];
  actorUserId?: string;
  /** Minutes of clock time that collapse into one sync. A bulk edit in Shopify fires
   * one webhook per product, so without this a 400-product edit queues 400 syncs. */
  windowMinutes?: number;
}

export interface EnqueueSyncResult {
  syncRunId: string;
  enqueued: boolean;
  jobId: string;
}

/**
 * Creates a SyncRun and queues the job that advances it.
 *
 * The two must agree. An earlier version created the run before enqueueing, so a
 * request whose job was collapsed as a duplicate left a run sitting in RUNNING that
 * nothing would ever finish — an incomplete function behind a successful-looking
 * interface, which is exactly what section 4 forbids. A collapsed request now cancels
 * its own run and names the run it was collapsed into.
 */
export async function enqueueSync(input: EnqueueSyncInput): Promise<EnqueueSyncResult> {
  const windowMinutes = input.windowMinutes ?? 1;
  const jobId = syncIdempotencyKey({
    shopId: input.shopId,
    kind: input.kind,
    windowStart: windowStart(new Date(), windowMinutes),
  });

  const run = await prisma.syncRun.create({
    data: {
      shopId: input.shopId,
      kind: input.kind,
      trigger: input.trigger,
      status: 'RUNNING',
    },
  });

  const payload: ShopifySyncPayload = {
    shopId: input.shopId,
    shopDomain: input.shopDomain,
    kind: input.kind,
    trigger: input.trigger,
    syncRunId: run.id,
  };

  const outcome = await queue().enqueue(QUEUES.shopifySync, payload, { jobId, maxAttempts: 3 });

  if (!outcome.created) {
    const collapsedInto = (outcome.job.payload as ShopifySyncPayload | undefined)?.syncRunId;
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
        error: collapsedInto
          ? `Collapsed into sync run ${collapsedInto}, already queued for this ${windowMinutes}-minute window.`
          : `Collapsed into an earlier sync already queued for this ${windowMinutes}-minute window.`,
      },
    });
  }

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: outcome.created ? 'product.sync_started' : 'webhook.duplicate_skipped',
    targetType: 'SyncRun',
    targetId: run.id,
    actorUserId: input.actorUserId,
    after: { kind: input.kind, trigger: input.trigger, enqueued: outcome.created, jobId },
  });

  return { syncRunId: run.id, enqueued: outcome.created, jobId };
}

/** Floors an instant to the start of its window, in UTC. */
function windowStart(at: Date, windowMinutes: number): string {
  const minutes = Math.floor(at.getUTCMinutes() / windowMinutes) * windowMinutes;
  const floored = new Date(at);
  floored.setUTCMinutes(minutes, 0, 0);
  return floored.toISOString().slice(0, 16);
}
