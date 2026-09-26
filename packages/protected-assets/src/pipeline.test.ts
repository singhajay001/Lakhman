import { afterAll, describe, expect, it } from 'vitest';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { composite, createRendition, inpaintMask, DEFAULT_DILATE_PX } from './composite.js';
import { colourReferenceFor, verifyComposite } from './verify.js';
import { bounds, dilate, erode, maskArea, maskFromAlpha } from './mask.js';
import { decode } from './raster.js';
import { shutdownOcr } from './ocr.js';

/**
 * The protected-product pipeline, end to end on real pixels.
 *
 * The bottle is synthetic (see packages/testing/src/images.ts) because the real packshots are
 * not reachable here — but every byte below is real: a real alpha cutout, a real generated
 * environment, a real alpha-over composite, and four real measurements over the result.
 */
const OUTPUT = { width: 1080, height: 1920 };
const CENTRE = { x: Math.round((1080 - 600) / 2), y: Math.round((1920 - 1200) / 2), scale: 1 };

async function build(over: Parameters<typeof bottlePng>[0] = {}) {
  const master = await bottlePng(over);
  const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
  const output = await composite({
    masterPng: master,
    environmentPng: environment,
    spec: { output: OUTPUT, transform: CENTRE, kernel: 'lanczos3' },
  });
  return { master, environment, output };
}

afterAll(async () => {
  await shutdownOcr();
});

describe('the mask', () => {
  it('finds the bottle from its alpha', async () => {
    const master = await decode(await bottlePng());
    const mask = maskFromAlpha(master);
    const area = maskArea(mask);
    // A bottle is a minority of its bounding canvas, and not a sliver of it.
    expect(area).toBeGreaterThan(master.width * master.height * 0.2);
    expect(area).toBeLessThan(master.width * master.height * 0.8);
  });

  it('bounds the bottle inside the canvas', async () => {
    const mask = maskFromAlpha(await decode(await bottlePng()));
    const box = bounds(mask);
    expect(box).not.toBeNull();
    expect(box!.w).toBeLessThan(mask.width);
    expect(box!.h).toBeLessThan(mask.height);
  });

  it('grows by the requested radius, and shrinks back', async () => {
    const mask = maskFromAlpha(await decode(await bottlePng()));
    const grown = dilate(mask, 3);
    expect(maskArea(grown)).toBeGreaterThan(maskArea(mask));
    // Erode is the inverse operation, not the exact inverse function: a 3px grow then
    // shrink returns close to the original area, not identically.
    const returned = erode(grown, 3);
    expect(maskArea(returned)).toBeGreaterThanOrEqual(maskArea(mask) * 0.99);
  });

  it('leaves the mask alone at radius zero', async () => {
    const mask = maskFromAlpha(await decode(await bottlePng()));
    expect(maskArea(dilate(mask, 0))).toBe(maskArea(mask));
  });
});

describe('the inpainting mask handed to a provider', () => {
  it('forbids painting within the dilation buffer of the bottle', async () => {
    const master = await bottlePng();
    const { mask, dilatePx } = await inpaintMask(master);
    expect(dilatePx).toBe(DEFAULT_DILATE_PX);

    const product = maskFromAlpha(await decode(master));
    const forbidden = dilate(product, dilatePx);

    // Every pixel within the buffer is black in the paintable mask: the model may not touch
    // it, so its own feathering cannot bleed across the silhouette.
    let leaks = 0;
    for (let index = 0; index < mask.data.length; index += 1) {
      if ((forbidden.data[index] ?? 0) > 0 && (mask.data[index] ?? 0) > 0) leaks += 1;
    }
    expect(leaks).toBe(0);
  });

  it('is wider than the bottle itself, by the buffer', async () => {
    const master = await bottlePng();
    const product = maskFromAlpha(await decode(master));
    const { mask } = await inpaintMask(master, 4);
    const paintable = maskArea(mask);
    const canvas = mask.width * mask.height;
    expect(canvas - paintable).toBeGreaterThan(maskArea(product));
  });

  it('honours a tighter buffer when asked', async () => {
    const master = await bottlePng();
    const two = maskArea((await inpaintMask(master, 2)).mask);
    const four = maskArea((await inpaintMask(master, 4)).mask);
    expect(two).toBeGreaterThan(four);
  });
});

describe('the composite', () => {
  it('places the product over the environment at the requested offset', async () => {
    const { output } = await build();
    expect(output.raster.width).toBe(OUTPUT.width);
    expect(output.raster.height).toBe(OUTPUT.height);
    expect(maskArea(output.placedMask)).toBeGreaterThan(0);

    const box = bounds(output.placedMask);
    expect(box!.x).toBeGreaterThanOrEqual(CENTRE.x);
    expect(box!.y).toBeGreaterThanOrEqual(CENTRE.y);
  });

  it('is reproducible from the same inputs, byte for byte', async () => {
    const one = await build();
    const two = await build();
    expect(Buffer.from(one.output.png).equals(Buffer.from(two.output.png))).toBe(true);
  });

  it('leaves the environment visible outside the product', async () => {
    const { output } = await build();
    // A corner is environment, and the environment is not transparent.
    const corner = output.raster.data.subarray(0, 4);
    expect(corner[3]).toBe(255);
    expect(maskArea(output.placedMask)).toBeLessThan(OUTPUT.width * OUTPUT.height);
  });
});

describe('verification of an honest composite', () => {
  it('passes all four checks', async () => {
    const { master, output } = await build();
    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
      approvedColour: await colourReferenceFor(master, labelRegion()),
    });

    expect(
      report.outcome,
      JSON.stringify(report.checks.map((c) => [c.check, c.outcome, c.detail])),
    ).toBe('PASS');
    expect(report.checks.map((check) => check.check).sort()).toEqual([
      'colour',
      'label_text',
      'pixel_identity',
      'structure',
    ]);
    expect(report.diffPng).toBeNull();
  });

  it('holds opaque product pixels to exact identity and glass to the alpha-over', async () => {
    const { master, output } = await build();
    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });
    const pixel = report.checks.find((check) => check.check === 'pixel_identity');
    expect(pixel?.outcome).toBe('PASS');
    // Opaque product pixels — the label, the cap — are held to exact identity.
    expect(pixel?.measurements.maxOpaqueDelta).toBe(0);
    expect(pixel?.measurements.deviantOpaquePixels).toBe(0);
    // Glass is semi-transparent, so those pixels are checked against the deterministic
    // alpha-over instead, and there are plenty of them.
    expect(Number(pixel?.measurements.blendedPixels)).toBeGreaterThan(1000);
    expect(pixel?.measurements.deviantBlendedPixels).toBe(0);
  });

  it('reads the label back with OCR, and the two reads agree', async () => {
    const { master, output } = await build();
    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });
    const text = report.checks.find((check) => check.check === 'label_text');
    expect(text?.outcome).toBe('PASS');
    expect(String(text?.measurements.master)).toContain('APPLEWOOD');
    // The strength statement is the load-bearing claim, and it reads cleanly.
    expect(String(text?.measurements.master)).toContain('43% ABV');
    expect(text?.measurements.master).toBe(text?.measurements.candidate);
  });

  it('is a comparison, not a transcription — which is why OCR being imperfect is survivable', async () => {
    // Tesseract reads this fixture's label as "APPLEWOOD GI": it drops the final N, on the
    // full image as well as on a crop. If the check asserted an expected string it would be
    // permanently broken. Comparing the two reads makes an imperfect reader still useful,
    // because the same imperfection applies to both sides.
    const { master, output } = await build();
    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });
    const text = report.checks.find((check) => check.check === 'label_text');
    expect(text?.outcome).toBe('PASS');
    expect(String(text?.measurements.master)).not.toBe('APPLEWOOD GIN 43% ABV 700ML');
  });

  it('says its thresholds are uncalibrated, and that a pass is not an approval', async () => {
    const { master, output } = await build();
    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });
    expect(report.calibration).toContain('uncalibrated');
    expect(report.calibration).toContain('not a substitute for the human approval');
  });
});

describe('verification of a falsified composite', () => {
  /**
   * The tests that matter. Each takes the honest composite and changes one thing about the
   * product — the way a generative model would, if it were allowed near it — and asserts that
   * the right check fails for the right reason.
   */
  async function falsify(over: Parameters<typeof bottlePng>[0]) {
    const honest = await bottlePng();
    const forged = await bottlePng(over);
    const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
    const output = await composite({
      masterPng: forged,
      environmentPng: environment,
      spec: { output: OUTPUT, transform: CENTRE, kernel: 'lanczos3' },
    });
    // Verified against the *approved* master, which is the one the pipeline holds.
    return verifyComposite({
      masterPng: honest,
      composite: output,
      labelRegion: labelRegion(),
      approvedColour: await colourReferenceFor(honest, labelRegion()),
    });
  }

  it('catches a changed strength statement, and names the change', async () => {
    const report = await falsify({ statement: '45% ABV 700ml' });
    expect(report.outcome).toBe('FAIL');

    const text = report.checks.find((check) => check.check === 'label_text');
    expect(text?.outcome).toBe('FAIL');
    expect(text?.detail).toContain('45%');
    expect(text?.detail).toContain('43%');

    // Pixel identity catches it too, and produces the overlay a reviewer looks at.
    expect(report.checks.find((check) => check.check === 'pixel_identity')?.outcome).toBe('FAIL');
    expect(report.diffPng).not.toBeNull();
  });

  it('catches a changed product name, and says which tokens moved', async () => {
    const report = await falsify({ name: 'APPLEWOOD RUM' });
    expect(report.outcome).toBe('FAIL');
    const text = report.checks.find((check) => check.check === 'label_text');
    expect(text?.outcome).toBe('FAIL');
    expect(text?.detail).toContain('label text changed');
    // Not asserted against the literal "RUM": the same reader that drops the N of GIN drops
    // the M of RUM. What must hold is that the two reads differ and the difference is named.
    expect(text?.measurements.master).not.toBe(text?.measurements.candidate);
    expect(text?.detail).toMatch(/Missing:.*APPLEWOOD|Added:.*APPLEWOOD/);
  });

  it('catches a tinted label that still reads the same', async () => {
    // A colour shift with the text untouched: OCR is happy, and the colour check is not.
    const report = await falsify({ labelHex: '#e8dcc0' });
    expect(report.outcome).toBe('FAIL');

    const colour = report.checks.find((check) => check.check === 'colour');
    expect(colour?.outcome).toBe('FAIL');
    expect(Number(colour?.measurements.deltaEToMaster)).toBeGreaterThan(3);
    expect(report.checks.find((check) => check.check === 'label_text')?.outcome).toBe('PASS');
  });

  it('catches a label that moved, which is the case the other checks are weakest on', async () => {
    const report = await falsify({ labelOffsetY: 24 });
    expect(report.outcome).toBe('FAIL');
    const structure = report.checks.find((check) => check.check === 'structure');
    expect(structure?.outcome).toBe('FAIL');
  });

  it('catches a recoloured glass body', async () => {
    const report = await falsify({ glassHex: '#8a3a2f' });
    expect(report.outcome).toBe('FAIL');
    expect(report.checks.find((check) => check.check === 'pixel_identity')?.outcome).toBe('FAIL');
  });

  it('produces an overlay marking every pixel that moved', async () => {
    const report = await falsify({ statement: '45% ABV 700ml' });
    expect(report.diffPng).not.toBeNull();
    const diff = await decode(report.diffPng as Buffer);
    let marked = 0;
    for (let index = 0; index < diff.width * diff.height; index += 1) {
      if ((diff.data[index * 4 + 3] ?? 0) > 0) marked += 1;
    }
    expect(marked).toBeGreaterThan(50);
  });
});

describe('a resampled product layer', () => {
  it('reports pixel identity as unavailable rather than passing on a tolerance', async () => {
    const master = await bottlePng();
    const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
    const output = await composite({
      masterPng: master,
      environmentPng: environment,
      spec: { output: OUTPUT, transform: { x: 100, y: 200, scale: 0.75 }, kernel: 'lanczos3' },
    });

    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });

    const pixel = report.checks.find((check) => check.check === 'pixel_identity');
    expect(pixel?.outcome).toBe('UNAVAILABLE');
    expect(pixel?.detail).toContain('resampled');
    // An incomplete verification is not a pass. Section 3, applied to our own checks.
    expect(report.outcome).toBe('INCOMPLETE');
    expect(report.incomplete).toBe(true);
  });

  it('reports the label text as unavailable, because OCR is not decisive at a downscale', async () => {
    const master = await bottlePng();
    const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
    const output = await composite({
      masterPng: master,
      environmentPng: environment,
      spec: { output: OUTPUT, transform: { x: 100, y: 200, scale: 0.527 }, kernel: 'lanczos3' },
    });

    const report = await verifyComposite({
      masterPng: master,
      composite: output,
      labelRegion: labelRegion(),
    });

    // Measured, not assumed: at this downscale tesseract reads the *same* honest label as
    // "APPLEWOOD GL ... 700M" against the master's "APPLEWOOD GI ... 700ML", so a FAIL here would
    // be a false accusation — and structure does not separate an honest resample (SSIM 0.9998)
    // from a changed strength statement (0.9983) either. The composite path therefore renders a
    // rendition and verifies at scale 1; here the check says so instead of guessing.
    const label = report.checks.find((check) => check.check === 'label_text');
    expect(label?.outcome).toBe('UNAVAILABLE');
    expect(label?.detail).toContain('scale 1');
    expect(label?.measurements.scale).toBe(0.527);
    expect(report.outcome).toBe('INCOMPLETE');
  });

  it('a rendition verified at scale 1 keeps every check decisive', async () => {
    const master = await bottlePng();
    const rendition = await createRendition(master, { width: 474, height: 737 });
    const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
    const output = await composite({
      masterPng: rendition.png,
      environmentPng: environment,
      spec: { output: OUTPUT, transform: { x: 100, y: 200, scale: 1 }, kernel: 'lanczos3' },
    });

    const report = await verifyComposite({
      masterPng: rendition.png,
      composite: output,
      labelRegion: labelRegion(),
      // The master's approved colour, carried forward rather than re-read off the resample.
      approvedColour: await colourReferenceFor(master, labelRegion()),
    });

    expect(report.checks.map((check) => check.outcome)).toEqual(['PASS', 'PASS', 'PASS', 'PASS']);
    expect(report.outcome).toBe('PASS');
  });

  it('a rendition does not launder a tinted label past the colour check', async () => {
    const approved = await colourReferenceFor(await bottlePng(), labelRegion());
    const tinted = await bottlePng({ labelHex: '#f0e6c8' });
    const rendition = await createRendition(tinted, { width: 474, height: 737 });
    const environment = await environmentPng(OUTPUT.width, OUTPUT.height);
    const output = await composite({
      masterPng: rendition.png,
      environmentPng: environment,
      spec: { output: OUTPUT, transform: { x: 100, y: 200, scale: 1 }, kernel: 'lanczos3' },
    });

    const report = await verifyComposite({
      masterPng: rendition.png,
      composite: output,
      labelRegion: labelRegion(),
      approvedColour: approved,
    });

    // The composite is internally honest, so pixel identity and OCR pass. The approved colour is
    // what catches it, through the resample: ΔE2000 ~8.6, against ~0.06 for the resample itself.
    const colour = report.checks.find((check) => check.check === 'colour');
    expect(colour?.outcome).toBe('FAIL');
    expect(report.outcome).toBe('FAIL');
  });
});
