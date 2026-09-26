/**
 * Server-only domain code.
 *
 * `@spirithaus/domain` is imported by route modules that also render, so its main entry
 * must stay free of Node built-ins — a barrel that imports `node:crypto` drags it into
 * the browser bundle and the build fails, which is how this split came to exist. Content
 * hashing needs crypto, so it lives here and is imported from `.server` modules only.
 */
export {
  canonicalise,
  variantHash,
  approvalContextHash,
  matchesApprovedHash,
  MATERIAL_VARIANT_FIELDS,
  IMMATERIAL_VARIANT_FIELDS,
  type VariantForHashing,
  type ApprovalContextForHashing,
} from './content/canonical.js';
