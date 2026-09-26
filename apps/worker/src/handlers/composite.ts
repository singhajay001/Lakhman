import { prisma } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import { compositeForPlatform, storage } from '@spirithaus/media-pipeline';
import type { FormatKey } from '@spirithaus/media-geometry';
import type { Platform, Principal } from '@spirithaus/domain';
import type { CompositePayload } from '@spirithaus/jobs';

/**
 * Compositing, off the request path.
 *
 * The work itself is unchanged — the same masks, the same deterministic alpha-over, the same four
 * checks. What changed is where it runs. In a loader it held a response open for seconds while
 * decoding a packshot and reading a label twice with OCR; here it takes as long as it takes and
 * the request that asked for it ended immediately with a job id.
 *
 * A failure is recorded on the job row and re-thrown, so BullMQ applies its backoff and the app
 * can show what happened. A *refusal* is not a failure: a composite declined because the stored
 * master no longer matches its digest is the pipeline working, and it ends the job as FAILED with
 * the reason rather than retrying something that will refuse again.
 */
export async function handleComposite(payload: CompositePayload): Promise<void> {
  const log = childLogger({ job: 'composite', shop: payload.shopId, assetId: payload.assetId });

  const job = await prisma.renderJob.findUnique({ where: { id: payload.jobId } });
  if (!job) {
    log.warn({ jobId: payload.jobId }, 'composite job row is gone; nothing to do');
    return;
  }
  if (job.state === 'CANCELLED') {
    log.info({ jobId: payload.jobId }, 'composite was cancelled before it started');
    return;
  }

  await prisma.renderJob.update({
    where: { id: job.id },
    data: { state: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  const started = Date.now();

  try {
    const environment = payload.environmentKey
      ? await storage().get(payload.environmentKey)
      : undefined;

    if (payload.environmentKey && !environment) {
      await failed(
        job.id,
        `The environment image ${payload.environmentKey} is missing from storage, so this composite cannot be rebuilt.`,
      );
      return;
    }

    // The worker acts as the app, not as a person: a job has no session behind it. The person
    // who asked is recorded so the audit trail still names them.
    const actor: Principal = {
      userId: payload.requestedByUserId ?? null,
      shopId: payload.shopId,
      roles: ['creator'],
    } as Principal;

    const result = await compositeForPlatform({
      shopId: payload.shopId,
      actor,
      assetId: payload.assetId,
      platform: payload.platform as Platform,
      format: payload.format as FormatKey,
      ...(environment ? { environmentPng: environment } : {}),
    });

    if (!result.ok) {
      // A refusal, not a fault. Retrying a master that fails its digest check refuses again.
      await failed(job.id, result.error);
      log.warn({ jobId: job.id }, `composite refused: ${result.error}`);
      return;
    }

    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        state: 'SUCCEEDED',
        progress: 100,
        finishedAt: new Date(),
        renderMs: Date.now() - started,
        mediaAssetId: result.mediaAssetId,
      },
    });

    log.info(
      { jobId: job.id, verification: result.verification, geometry: result.geometryVerdict },
      'composite complete',
    );
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    await failed(job.id, message);
    // Re-thrown so BullMQ records the attempt and backs off. The row already says what happened.
    throw thrown;
  }
}

async function failed(jobId: string, error: string): Promise<void> {
  await prisma.renderJob.update({
    where: { id: jobId },
    data: { state: 'FAILED', finishedAt: new Date(), error },
  });
}
