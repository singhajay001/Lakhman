import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prisma, recordAudit } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import type { RenderPayload } from '@spirithaus/jobs';
import { render } from '@spirithaus/render';

/**
 * The render queue (section 36).
 *
 * Durable, cancellable, with progress. A render is minutes of work, so the interesting cases
 * are the ones around it rather than the render itself: a worker restart mid-job, a cancel
 * arriving while frames are being written, and a retry that must not pay twice.
 *
 * Output goes to the object store in production. Here it is written to a local directory,
 * because the storage provider is mocked and a mock that returned a signed URL to a file it
 * never stored would be the failure section 43 names.
 */
export async function handleRender(payload: RenderPayload): Promise<void> {
  const log = childLogger({ job: 'render', composition: payload.compositionId });

  const job = await prisma.renderJob.findFirst({
    where: { id: payload.renderJobId, shopId: payload.shopId },
  });
  if (!job) {
    log.warn({ renderJobId: payload.renderJobId }, 'render job row is gone; nothing to do');
    return;
  }
  if (job.state === 'CANCELLED') {
    log.info({ renderJobId: job.id }, 'render was cancelled before it started');
    return;
  }

  await prisma.renderJob.update({
    where: { id: job.id },
    data: { state: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  const controller = new AbortController();
  // Cancellation is polled rather than pushed: the queue has no channel back into a running
  // render, and a cancel that only takes effect after the render finishes is not a cancel.
  const watch = setInterval(() => {
    void prisma.renderJob
      .findUnique({ where: { id: job.id }, select: { state: true } })
      .then((current) => {
        if (current?.state === 'CANCELLED') controller.abort();
      })
      .catch(() => undefined);
  }, 2000);

  const outputPath = resolve(
    process.env.RENDER_OUTPUT_DIR ?? '/tmp/spirithaus-renders',
    payload.outputKey,
  );
  await mkdir(dirname(outputPath), { recursive: true });

  let lastReported = 0;
  const outcome = await render({
    compositionId: payload.compositionId,
    props: payload.props,
    outputPath,
    signal: controller.signal,
    onProgress: (pct) => {
      const whole = Math.round(pct * 100);
      // Written at most every five points: a progress update per frame would be a write per
      // 33 milliseconds for the whole render.
      if (whole - lastReported < 5) return;
      lastReported = whole;
      void prisma.renderJob
        .update({ where: { id: job.id }, data: { progress: whole } })
        .catch(() => undefined);
    },
  });

  clearInterval(watch);

  if (controller.signal.aborted) {
    await prisma.renderJob.update({
      where: { id: job.id },
      data: { state: 'CANCELLED', finishedAt: new Date() },
    });
    return;
  }

  if (!outcome.ok) {
    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        state: 'FAILED',
        finishedAt: new Date(),
        error: `${outcome.error.reason} ${outcome.error.cause ?? ''}`.trim().slice(0, 2000),
      },
    });
    await recordAudit(prisma, {
      shopId: payload.shopId,
      action: 'media.render_failed',
      targetType: 'RenderJob',
      targetId: job.id,
      after: { composition: payload.compositionId, error: outcome.error.reason },
    });
    throw new Error(outcome.error.reason);
  }

  const media = await prisma.mediaAsset.create({
    data: {
      shopId: payload.shopId,
      campaignId: job.campaignId,
      variantId: job.variantId,
      kind: 'VIDEO',
      objectKey: payload.outputKey,
      contentType: 'video/mp4',
      widthPx: outcome.value.width,
      heightPx: outcome.value.height,
      durationMs: Math.round((outcome.value.durationInFrames / outcome.value.fps) * 1000),
      // A render composes verified pixels; it does not re-verify them. The still it was built
      // from carries the four-part result, and this points at it.
      verification: 'NOT_APPLICABLE',
      generation: { renderer: 'remotion', compositionId: payload.compositionId },
    },
  });

  await prisma.renderJob.update({
    where: { id: job.id },
    data: {
      state: 'SUCCEEDED',
      progress: 100,
      finishedAt: new Date(),
      renderMs: outcome.value.renderMs,
      mediaAssetId: media.id,
    },
  });

  await recordAudit(prisma, {
    shopId: payload.shopId,
    action: 'media.rendered',
    targetType: 'MediaAsset',
    targetId: media.id,
    after: {
      composition: payload.compositionId,
      dimensions: `${outcome.value.width}x${outcome.value.height}`,
      renderMs: outcome.value.renderMs,
    },
  });

  log.info({ mediaId: media.id, renderMs: outcome.value.renderMs }, 'render stored');
}
