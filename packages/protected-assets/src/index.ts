export {
  decode,
  encode,
  encodeMask,
  greyscale,
  luminance,
  cropRaster,
  toPixels,
  type Raster,
  type Mask,
  type Region,
} from './raster.js';
export {
  maskFromAlpha,
  maskFromRect,
  dilate,
  erode,
  invert,
  maskArea,
  bounds,
  intersectMasks,
  covered,
  type Bounds,
} from './mask.js';
export {
  composite,
  createRendition,
  inpaintMask,
  DEFAULT_DILATE_PX,
  DEFAULT_KERNEL,
  type CompositeInput,
  type CompositeOutput,
  type CompositeSpec,
  type Transform,
  type Rendition,
} from './composite.js';
export { srgbToLab, deltaE2000, meanLab, type Lab } from './colour.js';
export { pHash, hammingDistance64, ssim } from './structure.js';
export {
  readText,
  compareLabelText,
  normaliseLabelText,
  findLanguageData,
  shutdownOcr,
  type OcrResult,
  type TextComparison,
} from './ocr.js';
export {
  verifyComposite,
  colourReferenceFor,
  DEFAULT_VERIFICATION_THRESHOLDS,
  CALIBRATION_NOTE,
  type VerificationReport,
  type VerificationThresholds,
  type CheckResult,
  type CheckName,
  type VerifyInput,
} from './verify.js';
