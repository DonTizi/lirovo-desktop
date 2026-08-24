/**
 * 64-bit DCT perceptual hash.
 *
 * Ported unchanged from the hosted engine: it is a pure function over decoded
 * RGBA with no dependencies and no native bindings, so there was nothing to
 * adapt and every reason to keep the two byte-identical — the frame manifests
 * they produce have to be diffable.
 *
 * Pure function over decoded RGBA pixel data — no external deps, no
 * native bindings, no JPEG decoder. The caller decodes JPEG → RGBA
 * (`jpeg-js` in production, fixture arrays in tests) and hands the
 * pixel grid in.
 *
 * Algorithm (the textbook DCT-pHash from ADR-004 §4):
 *   1. Box-average resize the source down to 32×32 grayscale.
 *   2. Compute the 2D Type-II DCT on the 32×32 grid.
 *   3. Take the top-left 8×8 sub-grid (low-frequency components — the
 *      perceptual "fingerprint"), dropping the DC term at [0,0].
 *   4. Compute the median of the 63 remaining coefficients.
 *   5. Bit = 1 iff coefficient > median; pack into a 64-bit hash
 *      (the unused DC slot is bit 0 = 0, fixed).
 *
 * Two perceptually-identical images yield identical (or very close)
 * hashes; the hamming distance between hashes is a perceptual
 * distance metric. ADR-004 §4 locks the dedup threshold at hamming ≤ 5.
 */

/** Decoded image — what the JPEG decoder hands `phash`. */
export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA8 pixel data — 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

const HASH_SIZE = 8;
const RESIZED_SIZE = 32;

/**
 * Compute the 64-bit DCT pHash of a decoded image. Returns a 16-char
 * lowercase hex string (`"f3a1b2..."`).
 */
export const phash = (image: DecodedImage): string => {
  const gray = grayResize(image);
  const dct = dct2d(gray);
  const lowFreq = extractLowFrequency(dct);
  const median = computeMedian(lowFreq);
  return bitsToHex(lowFreq.map((v) => (v > median ? 1 : 0)));
};

/**
 * Hamming distance between two pHash hex strings. Counts bits that
 * differ; range [0, 64].
 */
export const hammingDistance = (a: string, b: string): number => {
  if (a.length !== b.length) {
    throw new Error(`pHash length mismatch: ${a.length} vs ${b.length}`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xor = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    // popcount of a single hex digit's 4 bits — small, no `bigint` overhead.
    let v = xor;
    while (v > 0) {
      distance += v & 1;
      v >>= 1;
    }
  }
  return distance;
};

/** Box-average resize the RGBA image to 32×32 grayscale (one byte per pixel). */
const grayResize = (image: DecodedImage): Float64Array => {
  const { width: w, height: h, data } = image;
  const out = new Float64Array(RESIZED_SIZE * RESIZED_SIZE);
  const xRatio = w / RESIZED_SIZE;
  const yRatio = h / RESIZED_SIZE;

  for (let y = 0; y < RESIZED_SIZE; y += 1) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yRatio));
    for (let x = 0; x < RESIZED_SIZE; x += 1) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xRatio));
      let sum = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const idx = (yy * w + xx) * 4;
          // ITU-R BT.601 luma — the same formula libjpeg uses internally.
          const luma = 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
          sum += luma;
          count += 1;
        }
      }
      out[y * RESIZED_SIZE + x] = count > 0 ? sum / count : 0;
    }
  }
  return out;
};

/**
 * 2D Type-II DCT on the 32×32 grayscale grid. The cosine table is
 * computed once on module load (8 KiB) and reused across calls.
 */
const cosineTable: Float64Array = (() => {
  const N = RESIZED_SIZE;
  const table = new Float64Array(N * N);
  for (let k = 0; k < N; k += 1) {
    for (let n = 0; n < N; n += 1) {
      table[k * N + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N));
    }
  }
  return table;
})();

const dct2d = (input: Float64Array): Float64Array => {
  const N = RESIZED_SIZE;
  // First pass: DCT along rows.
  const tmp = new Float64Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let k = 0; k < N; k += 1) {
      let sum = 0;
      for (let n = 0; n < N; n += 1) {
        sum += input[y * N + n]! * cosineTable[k * N + n]!;
      }
      tmp[y * N + k] = sum;
    }
  }
  // Second pass: DCT along columns.
  const out = new Float64Array(N * N);
  for (let x = 0; x < N; x += 1) {
    for (let k = 0; k < N; k += 1) {
      let sum = 0;
      for (let n = 0; n < N; n += 1) {
        sum += tmp[n * N + x]! * cosineTable[k * N + n]!;
      }
      out[k * N + x] = sum;
    }
  }
  return out;
};

/**
 * Extract the top-left 8×8 low-frequency block from the 32×32 DCT,
 * dropping the DC coefficient at [0,0]. Returns 63 values in row-major
 * order (so callers can pair them with bits 1..63 of the hash).
 */
const extractLowFrequency = (dct: Float64Array): number[] => {
  const N = RESIZED_SIZE;
  const out: number[] = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      if (y === 0 && x === 0) continue; // skip DC term
      out.push(dct[y * N + x]!);
    }
  }
  return out;
};

const computeMedian = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

/**
 * Pack 63 bits (DC slot remains 0) into a 16-char hex string. Bit 0 is
 * the DC slot; bits 1..63 are the bit array passed in (most-significant-
 * first within each hex nibble for human readability).
 */
const bitsToHex = (bits: number[]): string => {
  const all = [0, ...bits]; // bit 0 (DC) is always 0
  let hex = "";
  for (let i = 0; i < 16; i += 1) {
    let nibble = 0;
    for (let b = 0; b < 4; b += 1) {
      nibble = (nibble << 1) | (all[i * 4 + b] ?? 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
};
