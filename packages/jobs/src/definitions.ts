/** The queues Phase 1 runs. Later phases add to this list, not to its shape. */
export const QUEUES = {
  shopifySync: 'shopify-sync',
  webhook: 'webhook',
  reconciliation: 'reconciliation',
  render: 'render',
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

export interface RenderPayload {
  shopId: string;
  renderJobId: string;
  compositionId: string;
  props: Record<string, unknown>;
  /** Object key the finished file is written to. */
  outputKey: string;
}
