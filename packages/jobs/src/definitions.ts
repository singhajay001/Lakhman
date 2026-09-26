/** The queues Phase 1 runs. Later phases add to this list, not to its shape. */
export const QUEUES = {
  shopifySync: 'shopify-sync',
  webhook: 'webhook',
  reconciliation: 'reconciliation',
  render: 'render',
  /**
   * Compositing a protected master over an environment. Queued rather than done in the request,
   * because it runs OCR and image work measured in seconds, and a loader holding a response open
   * for that is a gateway timeout waiting to happen (ADR 0012).
   */
  composite: 'composite',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface ShopifySyncPayload {
  shopId: string;
  shopDomain: string;
  kind: 'PRODUCTS' | 'COLLECTIONS' | 'INVENTORY' | 'FULL';
  trigger: 'manual' | 'install' | 'webhook' | 'scheduled';
  syncRunId: string;
}

export interface WebhookPayload {
  webhookEventId: string;
  shopDomain: string;
  topic: string;
}

export interface ReconciliationPayload {
  shopId: string;
  shopDomain: string;
  syncRunId: string;
}

export interface CompositePayload {
  shopId: string;
  /** The RenderJob row tracking this work. Same lifecycle as a video render. */
  jobId: string;
  assetId: string;
  platform: string;
  format: string;
  /** Object key of an environment already in storage, where the caller supplied one. */
  environmentKey: string | null;
  requestedByUserId: string | null;
}

export interface RenderPayload {
  shopId: string;
  renderJobId: string;
  compositionId: string;
  props: Record<string, unknown>;
  /** Object key the finished file is written to. */
  outputKey: string;
}
