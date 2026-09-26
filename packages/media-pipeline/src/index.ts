/**
 * The media pipeline, as a package rather than as part of the web app.
 *
 * It lived in `apps/social-studio/app/lib` until compositing moved off the request path. That
 * move is the reason this package exists: the worker cannot import from the app, and OCR plus
 * image compositing is seconds of work that has no business holding a response open (ADR 0012).
 */
export {
  ingestProtectedAsset,
  compositeForPlatform,
  queueComposite,
  queueRender,
  cancelRender,
  type IngestInput,
  type CompositeInputForApp,
  type CompositeResult,
} from './pipeline.js';
export {
  ingestCatalogueImages,
  compareWithGroundTruth,
  type CatalogueIngestInput,
  type CatalogueIngestResult,
  type GroundTruth,
  type IngestOutcome,
} from './catalogue-ingest.js';
export {
  storage,
  createStorage,
  resetStorage,
  assertStorage,
  LocalStorage,
  type Storage,
} from './storage.js';
export { S3Storage, StorageError } from './s3-storage.js';
export {
  resolveStorageConfig,
  assertStorageConfigured,
  StorageConfigError,
  DEFAULT_REGION,
  DEFAULT_LOCAL_ROOT,
  type S3StorageConfig,
  type StorageResolution,
} from './storage-config.js';
export { queue } from './queue.js';
