import { describe, expect, it } from 'vitest';
import {
  MANDATORY_PRIVACY_TOPICS,
  isWebhookTopic,
  readWebhookHeaders,
  validateWebhookHeaders,
  WEBHOOK_TOPICS,
} from './webhooks.js';

const headers = (over: Record<string, string> = {}) =>
  new Headers({
    'x-shopify-topic': 'products/update',
    'x-shopify-shop-domain': 'spirithaus-dev.myshopify.com',
    'x-shopify-hmac-sha256': 'signature',
    'x-shopify-event-id': 'evt_1',
    'x-shopify-api-version': '2025-07',
    ...over,
  });

describe('readWebhookHeaders', () => {
  it('reads every header the handler needs', () => {
    const read = readWebhookHeaders(headers());
    expect(read.topic).toBe('products/update');
    expect(read.eventId).toBe('evt_1');
    expect(read.apiVersion).toBe('2025-07');
  });

  it('returns null for an absent header rather than undefined', () => {
    expect(readWebhookHeaders(new Headers()).topic).toBeNull();
  });
});

describe('validateWebhookHeaders', () => {
  it('accepts a complete set', () => {
    const outcome = validateWebhookHeaders(readWebhookHeaders(headers()));
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.topic).toBe('products/update');
  });

  it('names every missing header', () => {
    const outcome = validateWebhookHeaders({
      topic: null,
      shopDomain: null,
      hmac: null,
      eventId: null,
      apiVersion: null,
      triggeredAt: null,
    });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.rejection.reason).toBe('missing_headers');
    if (outcome.rejection.reason !== 'missing_headers') return;
    expect(outcome.rejection.missing).toEqual([
      'x-shopify-topic',
      'x-shopify-shop-domain',
      'x-shopify-hmac-sha256',
      'x-shopify-event-id',
    ]);
  });

  it('rejects a topic the app did not subscribe to', () => {
    const outcome = validateWebhookHeaders(
      readWebhookHeaders(headers({ 'x-shopify-topic': 'orders/paid' })),
    );
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.rejection.reason).toBe('unknown_topic');
  });

  it('requires the event id, because it is the idempotency key', () => {
    const stripped = headers();
    stripped.delete('x-shopify-event-id');
    const outcome = validateWebhookHeaders(readWebhookHeaders(stripped));
    expect(outcome.valid).toBe(false);
  });
});

describe('the topic list', () => {
  it('includes the three privacy topics Shopify requires of a public app', () => {
    expect(MANDATORY_PRIVACY_TOPICS).toHaveLength(3);
    for (const topic of MANDATORY_PRIVACY_TOPICS) expect(isWebhookTopic(topic)).toBe(true);
  });

  it('subscribes to uninstall, so tokens and jobs can be cleaned up', () => {
    expect(isWebhookTopic(WEBHOOK_TOPICS.APP_UNINSTALLED)).toBe(true);
  });

  it('has no duplicate topics', () => {
    const values = Object.values(WEBHOOK_TOPICS);
    expect(new Set(values).size).toBe(values.length);
  });
});
