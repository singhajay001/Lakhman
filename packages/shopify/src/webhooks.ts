/**
 * The webhook topics Phase 1 subscribes to, and what each one is for. Handlers
 * revalidate; they never delete published history (section 31).
 */
export const WEBHOOK_TOPICS = {
  APP_UNINSTALLED: 'app/uninstalled',
  SHOP_UPDATE: 'shop/update',
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  PRODUCTS_DELETE: 'products/delete',
  INVENTORY_LEVELS_UPDATE: 'inventory_levels/update',
  COLLECTIONS_UPDATE: 'collections/update',
  CUSTOMERS_DATA_REQUEST: 'customers/data_request',
  CUSTOMERS_REDACT: 'customers/redact',
  SHOP_REDACT: 'shop/redact',
} as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[keyof typeof WEBHOOK_TOPICS];

/** The three Shopify requires of every public app. */
export const MANDATORY_PRIVACY_TOPICS: readonly WebhookTopic[] = [
  WEBHOOK_TOPICS.CUSTOMERS_DATA_REQUEST,
  WEBHOOK_TOPICS.CUSTOMERS_REDACT,
  WEBHOOK_TOPICS.SHOP_REDACT,
];

export const isWebhookTopic = (value: string): value is WebhookTopic =>
  (Object.values(WEBHOOK_TOPICS) as string[]).includes(value);

export interface WebhookHeaders {
  topic: string | null;
  shopDomain: string | null;
  hmac: string | null;
  eventId: string | null;
  apiVersion: string | null;
  triggeredAt: string | null;
}

export function readWebhookHeaders(headers: Headers): WebhookHeaders {
  return {
    topic: headers.get('x-shopify-topic'),
    shopDomain: headers.get('x-shopify-shop-domain'),
    hmac: headers.get('x-shopify-hmac-sha256'),
    eventId: headers.get('x-shopify-event-id'),
    apiVersion: headers.get('x-shopify-api-version'),
    triggeredAt: headers.get('x-shopify-triggered-at'),
  };
}

export type WebhookRejection =
  | { reason: 'missing_headers'; missing: string[] }
  | { reason: 'unknown_topic'; topic: string }
  | { reason: 'bad_signature' };

/**
 * Header validation, before the body is parsed and before the signature is checked.
 * Returns the missing header names so the failure is diagnosable from a log line.
 */
export function validateWebhookHeaders(
  headers: WebhookHeaders,
):
  | { valid: true; topic: WebhookTopic; shopDomain: string; eventId: string }
  | { valid: false; rejection: WebhookRejection } {
  const missing: string[] = [];
  if (!headers.topic) missing.push('x-shopify-topic');
  if (!headers.shopDomain) missing.push('x-shopify-shop-domain');
  if (!headers.hmac) missing.push('x-shopify-hmac-sha256');
  if (!headers.eventId) missing.push('x-shopify-event-id');
  if (missing.length > 0)
    return { valid: false, rejection: { reason: 'missing_headers', missing } };

  const topic = headers.topic as string;
  if (!isWebhookTopic(topic)) {
    return { valid: false, rejection: { reason: 'unknown_topic', topic } };
  }

  return {
    valid: true,
    topic,
    shopDomain: headers.shopDomain as string,
    eventId: headers.eventId as string,
  };
}
