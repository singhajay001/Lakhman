/**
 * Structural comparisons: a perceptual hash and SSIM.
 *
 * These catch what pixel identity catches too, but survive a lossy round-trip — which is the
 * point. A composite re-encoded as JPEG for a platform has no bit-identical pixels left, and
 * a check with a tolerance wide enough to accept the re-encode is wide enough to accept a
 * changed digit. Structure is the check that still works there.
 */

/** 64-bit DCT perceptual hash. */
export function pHash(grey: Uint8Array, width: number, height: number): bigint {
  const size = 32;
  const resized = resizeNearest(grey, width, height, size, size);
  const dct = dct2(resized, size);

  // Top-left 8x8 minus the DC term: the low frequencies that carry structure.
  const coefficients: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (x === 0 && y === 0) continue;
      coefficients.push(dct[y * size + x] ?? 0);
    }
  }

  const sorted = [...coefficients].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  let hash = 0n;
  for (const value of coefficients) hash = (hash << 1n) | (value > median ? 1n : 0n);
  return hash;
}

export function hammingDistance64(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor > 0n) {
    if (xor & 1n) distance += 1;
    xor >>= 1n;
  }
  return distance;
}

/**
 * Mean SSIM over 8×8 windows. Windowed rather than global: a global figure over a whole label
 * is dominated by the background and a changed digit barely moves it.
 */
export function ssim(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  window = 8,
): number {
  if (a.length !== b.length) throw new Error('images differ in size');
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;

  let total = 0;
  let windows = 0;

  for (let y = 0; y + window <= height; y += window) {
    for (let x = 0; x + window <= width; x += window) {
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      const count = window * window;

      for (let dy = 0; dy < window; dy += 1) {
        for (let dx = 0; dx < window; dx += 1) {
          const index = (y + dy) * width + (x + dx);
          const va = a[index] ?? 0;
          const vb = b[index] ?? 0;
          sumA += va;
          sumB += vb;
          sumAA += va * va;
          sumBB += vb * vb;
          sumAB += va * vb;
        }
      }

      const meanA = sumA / count;
      const meanB = sumB / count;
      const varA = sumAA / count - meanA * meanA;
      const varB = sumBB / count - meanB * meanB;
      const covariance = sumAB / count - meanA * meanB;

      total +=
        ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
        ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2));
      windows += 1;
    }
  }

  return windows === 0 ? 1 : total / windows;
}

function resizeNearest(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
      out[y * width + x] = source[sy * sourceWidth + sx] ?? 0;
    }
  }
  return out;
}

/** Separable DCT-II. */
function dct2(input: Uint8Array, size: number): Float64Array {
  const rows = new Float64Array(size * size);
  const cosines = new Float64Array(size * size);
  for (let u = 0; u < size; u += 1) {
    for (let x = 0; x < size; x += 1) {
      cosines[u * size + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let u = 0; u < size; u += 1) {
      let sum = 0;
      for (let x = 0; x < size; x += 1)
        sum += (input[y * size + x] ?? 0) * (cosines[u * size + x] ?? 0);
      rows[y * size + u] = sum;
    }
  }

  const out = new Float64Array(size * size);
  for (let u = 0; u < size; u += 1) {
    for (let v = 0; v < size; v += 1) {
      let sum = 0;
      for (let y = 0; y < size; y += 1)
        sum += (rows[y * size + u] ?? 0) * (cosines[v * size + y] ?? 0);
      out[v * size + u] = sum;
    }
  }
  return out;
}
