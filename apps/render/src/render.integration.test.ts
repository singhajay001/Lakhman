import { createServer, type Server } from 'node:http';
import { createReadStream, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { composite, verifyComposite } from '@spirithaus/protected-assets';
import { writeFile } from 'node:fs/promises';
import { listCompositions, render } from './render';

/**
 * A real render, in this environment.
 *
 * Remotion is driven headless against the pre-installed headless shell, and the output is
 * parsed back to confirm its dimensions and codec. Slow — a minute or two — which is why it is
 * an integration test rather than a unit one.
 */
const OUT = mkdtempSync(join(tmpdir(), 'spirithaus-render-'));
let productPath: string;
let productUrl: string;
let assets: Server;

beforeAll(async () => {
  // The product layer is a *verified* composited still, produced by the Phase 3 pipeline, not
  // a prompt. Verified here too, so the render test rests on a checked asset.
  const master = await bottlePng();
  const environment = await environmentPng(1080, 1920);
  const output = await composite({
    masterPng: master,
    environmentPng: environment,
    spec: {
      output: { width: 1080, height: 1920 },
      transform: { x: 240, y: 360, scale: 1 },
      kernel: 'lanczos3',
    },
  });

  const report = await verifyComposite({
    masterPng: master,
    composite: output,
    labelRegion: labelRegion(),
  });
  expect(report.outcome).toBe('PASS');

  productPath = join(OUT, 'product.png');
  await writeFile(productPath, output.png);

  // Served over HTTP rather than referenced as file://, because that is what production does:
  // the renderer fetches a short-TTL signed URL from the private bucket. The headless browser
  // refuses a file:// asset from an http-served bundle, which is how this was found.
  assets = createServer((request, response) => {
    const name = (request.url ?? '/').replace(/^\//, '') || 'product.png';
    response.writeHead(200, { 'content-type': 'image/png' });
    createReadStream(join(OUT, name)).pipe(response);
  });
  await new Promise<void>((resolve) => assets.listen(0, '127.0.0.1', () => resolve()));
  const address = assets.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  productUrl = `http://127.0.0.1:${port}/product.png`;
}, 120_000);

afterAll(async () => {
  await new Promise<void>((resolve) => assets?.close(() => resolve()));
  const { shutdownOcr } = await import('@spirithaus/protected-assets');
  await shutdownOcr();
});

describe('the composition catalogue', () => {
  it('registers every template at every aspect', async () => {
    const list = await listCompositions();
    expect(list.ok, list.ok ? '' : `${list.error.reason} ${list.error.cause}`).toBe(true);
    if (!list.ok) return;

    for (const template of ['ProductHero', 'WeekendOffer', 'CocktailRecipe']) {
      for (const aspect of ['9x16', '1x1', '16x9']) {
        expect(list.value, `${template}-${aspect}`).toContain(`${template}-${aspect}`);
      }
    }
    expect(list.value).toHaveLength(9);
  }, 180_000);
});

describe('rendering', () => {
  it('produces a 1080x1920 H.264 file from a verified product still', async () => {
    const outputPath = join(OUT, 'hero-9x16.mp4');
    const progress: number[] = [];

    const outcome = await render({
      compositionId: 'ProductHero-9x16',
      props: {
        aspect: '9:16',
        productSrc: productUrl,
        kicker: 'NEW IN',
        headline: 'Applewood Gin,\nfrom the *Adelaide Hills*',
        voiceover: 'Applewood Gin, distilled in the Adelaide Hills with native botanicals.',
        // No confirmed Brand Kit line, so the end frame carries the wordmark and nothing else.
        responsibleLine: null,
      },
      outputPath,
      onProgress: (pct) => progress.push(pct),
    });

    expect(outcome.ok, outcome.ok ? '' : `${outcome.error.reason} ${outcome.error.cause}`).toBe(
      true,
    );
    if (!outcome.ok) return;

    expect(outcome.value.width).toBe(1080);
    expect(outcome.value.height).toBe(1920);
    expect(outcome.value.fps).toBe(30);
    expect(outcome.value.durationInFrames).toBe(210);
    expect(statSync(outputPath).size).toBeGreaterThan(10_000);
    // Progress is reported, which is what the queue surfaces to the editor.
    expect(progress.length).toBeGreaterThan(1);
    expect(Math.max(...progress)).toBeGreaterThan(0.9);
  }, 300_000);

  it('renders a 1:1 from the same props, at the right shape', async () => {
    const outputPath = join(OUT, 'hero-1x1.mp4');
    const outcome = await render({
      compositionId: 'ProductHero-1x1',
      props: {
        aspect: '1:1',
        productSrc: productUrl,
        headline: 'Applewood Gin',
        responsibleLine: 'Enjoy SPIRITHAUS responsibly.',
        licence: 'NSW Packaged Liquor Licence No. LIQP700301260',
      },
      outputPath,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.width).toBe(1080);
    expect(outcome.value.height).toBe(1080);
  }, 300_000);

  it('reports a failure rather than throwing when a composition does not exist', async () => {
    const outcome = await render({
      compositionId: 'NoSuchTemplate-9x16',
      props: {},
      outputPath: join(OUT, 'nope.mp4'),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.reason).toContain('NoSuchTemplate');
  }, 180_000);
});
