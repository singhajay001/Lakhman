import { prisma } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import {
  readWebhookHeaders,
  validateWebhookHeaders,
  verifyWebhookHmac,
  type WebhookTopic,
} from '@spirithaus/shopify';

export type WebhookReceipt =
  | {
      accepted: true;
      duplicate: boolean;
      webhookEventId: string;
      topic: WebhookTopic;
      shopDomain: string;
      payload: unknown;
    }
  | { accepted: false; response: Response };

/**
 * Receives a Shopify webhook.
 *
 * The order is the point:
 *   1. headers validated, so a malformed request is rejected cheaply;
 *   2. **raw body** read and the HMAC verified against those bytes, before any parse —
 *      JSON.parse then re-stringify does not round-trip, so a signature checked
 *      against a re-serialised body can be forged around;
 *   3. recorded under a unique (shop, topic, event id), which makes Shopify's
 *      redelivery free rather than a double-processed event;
 *   4. only then parsed and handed to a handler.
 *
 * Verification is first-party rather than delegated, so this order is ours to keep
 * (docs/adr/0007).
 */
export async function receiveWebhook(request: Request): Promise<WebhookReceipt> {
  const log = childLogger({ route: 'webhook' });
  const headers = readWebhookHeaders(request.headers);
  const validation = validateWebhookHeaders(headers);

  if (!validation.valid) {
    log.warn({ rejection: validation.rejection }, 'webhook rejected before reading the body');
    // 401 for an unverifiable request, 202 for a topic we do not handle: Shopify
    // retries a 4xx, and retrying a topic we will never handle is pointless noise.
    const status = validation.rejection.reason === 'unknown_topic' ? 202 : 401;
    return {
      accepted: false,
      response: new Response(JSON.stringify(validation.rejection), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    };
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    log.error('SHOPIFY_API_SECRET is not set; refusing to accept webhooks unverified');
    return { accepted: false, response: new Response('not configured', { status: 500 }) };
  }

  const rawBody = await request.text();
  if (!verifyWebhookHmac(rawBody, headers.hmac, secret)) {
    log.warn(
      { topic: validation.topic, shop: validation.shopDomain },
      'webhook signature did not verify',
    );
    return { accepted: false, response: new Response('invalid signature', { status: 401 }) };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { accepted: false, response: new Response('invalid json', { status: 400 }) };
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      shopDomain_topic_shopifyEventId: {
        shopDomain: validation.shopDomain,
        topic: validation.topic,
        shopifyEventId: validation.eventId,
      },
    },
  });

  if (existing) {
    log.info(
      { topic: validation.topic, eventId: validation.eventId },
      'webhook already recorded; skipping as a duplicate',
    );
    return {
      accepted: true,
      duplicate: true,
      webhookEventId: existing.id,
      topic: validation.topic,
      shopDomain: validation.shopDomain,
      payload,
    };
  }

  const event = await prisma.webhookEvent.create({
    data: {
      shopDomain: validation.shopDomain,
      topic: validation.topic,
      shopifyEventId: validation.eventId,
      apiVersion: headers.apiVersion,
      payload: payload as object,
    },
  });

  return {
    accepted: true,
    duplicate: false,
    webhookEventId: event.id,
    topic: validation.topic,
    shopDomain: validation.shopDomain,
    payload,
  };
}

export async function markProcessed(webhookEventId: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });
}

export async function markFailed(webhookEventId: string, error: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: 'FAILED', error: error.slice(0, 2000), attempts: { increment: 1 } },
  });
}
