export { verifyWebhookHmac, verifyQueryHmac } from './hmac.js';
export {
  MANDATORY_SCOPES,
  OPTIONAL_SCOPES,
  NEVER_REQUESTED,
  mandatoryScopeList,
  optionalScopeList,
  missingMandatoryScopes,
  type ScopeRequirement,
} from './scopes.js';
export {
  AdminClient,
  type AdminClientOptions,
  type AdminError,
  type AdminErrorClass,
  type AdminResult,
  type AdminResponse,
} from './admin-client.js';
export {
  ADMIN_API_VERSION,
  PRODUCTS_PAGE_QUERY,
  COLLECTIONS_PAGE_QUERY,
  SHOP_QUERY,
  type ProductNode,
  type VariantNode,
  type CollectionNode,
  type Page,
} from './queries.js';
export {
  mapProduct,
  mapVariant,
  mapCollection,
  normaliseMoney,
  assessPromotability,
  type MappedProduct,
  type MappedVariant,
  type MappedCollection,
  type MappedProductStatus,
  type Promotability,
  type PromotabilityInput,
} from './mapping.js';
export {
  syncProducts,
  syncCollections,
  type SyncCounts,
  type SyncDeps,
  type ProductStore,
} from './sync.js';
// PrismaProductStore is deliberately not re-exported here: it imports Prisma, which reads
// DATABASE_URL at module load. Import it from '@spirithaus/shopify/server'. ADR 0008.
export {
  WEBHOOK_TOPICS,
  MANDATORY_PRIVACY_TOPICS,
  isWebhookTopic,
  readWebhookHeaders,
  validateWebhookHeaders,
  type WebhookTopic,
  type WebhookHeaders,
  type WebhookRejection,
} from './webhooks.js';
export {
  originalImageUrl,
  pickPrimaryImage,
  parseAbv,
  parseVolumeMl,
  mapMediaProduct,
  PRODUCT_MEDIA_PAGE_QUERY,
  type CatalogueImage,
  type CatalogueProduct,
  type CatalogueSource,
  type MediaProductNode,
} from './product-images.js';
export { AdminCatalogueSource, StorefrontCatalogueSource } from './catalogue-sources.js';
export {
  describeProxyEnvironment,
  classifyThrownOutbound,
  classifyDeniedResponse,
  outboundDiagnostic,
  type OutboundBlock,
  type ProxyEnvironment,
} from './network.js';
export {
  ShopifyGateway,
  SANDBOX_MUTATION_LOG,
  type AdminSessionContainer,
  type GatewayOptions,
  type MutationOutcome,
  type OfflineSessionLookup,
  type ReadOutcome,
} from './gateway.js';
