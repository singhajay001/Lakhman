/**
 * Colour, in CIELAB, with ΔE2000.
 *
 * The check this serves: a generated environment with warm light shifts the *apparent* colour
 * of the product even when the composite laid the original pixels down untouched. Something
 * has to say how far is too far, and RGB distance is not that something — it is perceptually
 * uneven, so the same numeric delta is invisible in one part of the space and obvious in
 * another.
 */
export interface Lab {
  L: number;
  a: number;
  b: number;
}

const D65 = { x: 95.047, y: 100, z: 108.883 };

export function srgbToLab(r: number, g: number, b: number): Lab {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [linear(r), linear(g), linear(b)];

  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) * 100;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) * 100;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) * 100;

  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const fx = f(x / D65.x);
  const fy = f(y / D65.y);
  const fz = f(z / D65.z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIEDE2000. Long, and worth having exactly right rather than approximated. */
export function deltaE2000(one: Lab, two: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const c1 = Math.hypot(one.a, one.b);
  const c2 = Math.hypot(two.a, two.b);
  const cBar = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1 = one.a * (1 + g);
  const a2 = two.a * (1 + g);

  const cp1 = Math.hypot(a1, one.b);
  const cp2 = Math.hypot(a2, two.b);

  const hp1 = cp1 === 0 ? 0 : mod360(Math.atan2(one.b, a1) * (180 / Math.PI));
  const hp2 = cp2 === 0 ? 0 : mod360(Math.atan2(two.b, a2) * (180 / Math.PI));

  const dL = two.L - one.L;
  const dC = cp2 - cp1;

  let dh: number;
  if (cp1 * cp2 === 0) dh = 0;
  else if (Math.abs(hp2 - hp1) <= 180) dh = hp2 - hp1;
  else if (hp2 - hp1 > 180) dh = hp2 - hp1 - 360;
  else dh = hp2 - hp1 + 360;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * Math.PI) / 360);

  const lBar = (one.L + two.L) / 2;
  const cpBar = (cp1 + cp2) / 2;

  let hBar: number;
  if (cp1 * cp2 === 0) hBar = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hBar = (hp1 + hp2) / 2;
  else if (hp1 + hp2 < 360) hBar = (hp1 + hp2 + 360) / 2;
  else hBar = (hp1 + hp2 - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(rad(hBar - 30)) +
    0.24 * Math.cos(rad(2 * hBar)) +
    0.32 * Math.cos(rad(3 * hBar + 6)) -
    0.2 * Math.cos(rad(4 * hBar - 63));

  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cpBar;
  const sH = 1 + 0.015 * cpBar * t;

  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt(cpBar ** 7 / (cpBar ** 7 + 25 ** 7));
  const rT = -rC * Math.sin(rad(2 * dTheta));

  return Math.sqrt(
    (dL / (kL * sL)) ** 2 +
      (dC / (kC * sC)) ** 2 +
      (dH / (kH * sH)) ** 2 +
      rT * (dC / (kC * sC)) * (dH / (kH * sH)),
  );
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const mod360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** Mean Lab over a set of samples. Averaging in Lab, not in sRGB, which would skew it. */
export function meanLab(samples: { r: number; g: number; b: number }[]): Lab | null {
  if (samples.length === 0) return null;
  let L = 0;
  let a = 0;
  let b = 0;
  for (const sample of samples) {
    const lab = srgbToLab(sample.r, sample.g, sample.b);
    L += lab.L;
    a += lab.a;
    b += lab.b;
  }
  return { L: L / samples.length, a: a / samples.length, b: b / samples.length };
}
