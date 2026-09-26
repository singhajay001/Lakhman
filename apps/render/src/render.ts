import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { childLogger } from '@spirithaus/observability';
import { err, ok, type Result } from '@spirithaus/domain';

/**
 * Rendering, headless.
 *
 * Remotion launches Chromium with the old headless flags, which the full Chrome binary has
 * removed — so the browser is the standalone headless shell, which is the old implementation.
 * Pointing it at `chrome-linux/chrome` fails with a message about the removal, which is how
 * this was found.
 *
 * The bundle is built once and reused across renders in a process: bundling is the expensive
 * part, and a queue rendering six aspects of one campaign should pay it once.
 */
const PREINSTALLED_HEADLESS_SHELL =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

/**
 * An explicit REMOTION_BROWSER_EXECUTABLE wins; otherwise the pre-installed headless shell if
 * this machine has one; otherwise null, which tells Remotion to download its own headless
 * shell (what happens on CI runners and any machine without the pre-installed one).
 */
export const BROWSER_EXECUTABLE: string | null =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  (existsSync(PREINSTALLED_HEADLESS_SHELL) ? PREINSTALLED_HEADLESS_SHELL : null);

const entryPoint = (): string => resolve(dirname(fileURLToPath(import.meta.url)), 'index.ts');

let bundled: Promise<string> | null = null;

export async function serveUrl(): Promise<string> {
  if (!bundled) bundled = bundle({ entryPoint: entryPoint() });
  return bundled;
}

export interface RenderRequest {
  compositionId: string;
  props: Record<string, unknown>;
  outputPath: string;
  onProgress?: (pct: number) => void;
  /** Abort signal, so a cancelled job stops rather than finishing quietly. */
  signal?: AbortSignal;
}

export interface RenderOutcome {
  outputPath: string;
  compositionId: string;
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  renderMs: number;
}

export type RenderFailure = { reason: string; cause?: string };

export async function render(
  request: RenderRequest,
): Promise<Result<RenderOutcome, RenderFailure>> {
  const log = childLogger({ job: 'render', composition: request.compositionId });
  const startedAt = Date.now();

  try {
    const url = await serveUrl();
    const composition = await selectComposition({
      serveUrl: url,
      id: request.compositionId,
      inputProps: request.props,
      browserExecutable: BROWSER_EXECUTABLE,
    });

    await renderMedia({
      composition,
      serveUrl: url,
      codec: 'h264',
      outputLocation: request.outputPath,
      inputProps: request.props,
      browserExecutable: BROWSER_EXECUTABLE,
      jpegQuality: 92,
      onProgress: ({ progress }) => request.onProgress?.(progress),
      cancelSignal: request.signal
        ? (cancel) => {
            request.signal?.addEventListener('abort', () => cancel());
          }
        : undefined,
    });

    const outcome: RenderOutcome = {
      outputPath: request.outputPath,
      compositionId: request.compositionId,
      width: composition.width,
      height: composition.height,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      renderMs: Date.now() - startedAt,
    };
    log.info({ ...outcome }, 'render complete');
    return ok(outcome);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    log.error({ cause }, 'render failed');
    return err({ reason: `Rendering ${request.compositionId} failed.`, cause });
  }
}

export async function listCompositions(): Promise<Result<string[], RenderFailure>> {
  try {
    const compositions = await getCompositions(await serveUrl(), {
      browserExecutable: BROWSER_EXECUTABLE,
    });
    return ok(compositions.map((composition) => composition.id));
  } catch (error) {
    return err({
      reason: 'Could not read the composition list.',
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
