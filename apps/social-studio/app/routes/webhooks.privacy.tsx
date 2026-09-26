import type { ActionFunctionArgs } from 'react-router';
import { prisma, recordAudit } from '@spirithaus/db';
import { WEBHOOK_TOPICS } from '@spirithaus/shopify';
import { logger } from '@spirithaus/observability';
import { markProcessed, receiveWebhook } from '../lib/webhook.server.js';

/**
 * The three privacy webhooks Shopify requires of every public app.
 *
 * They are short because of a design decision rather than an omission: this app holds
 * no customer records. Section 25 operates on aggregated segments, and the attribution
 * identity chain (Phase 5) is pseudonymous with no name, email or address in it. So a
 * customer redaction has nothing here to erase, and saying that plainly is the honest
 * answer rather than deleting rows that do not exist.
 */
export async function action({ request }: ActionFunctionArgs) {
  const receipt = await receiveWebhook(request);
  if (!receipt.accepted) return receipt.response;
  if (receipt.duplicate) return new Response(null, { status: 200 });

  const shop = await prisma.shop.findUnique({ where: { domain: receipt.shopDomain } });

  if (shop) {
    await recordAudit(prisma, {
      shopId: shop.id,
      action: 'webhook.received',
      targetType: 'WebhookEvent',
      targetId: receipt.webhookEventId,
      after: {
        topic: receipt.topic,
        outcome:
          receipt.topic === WEBHOOK_TOPICS.SHOP_REDACT
            ? 'shop data marked for erasure'
            : 'no customer personal data is stored by this app, so there is nothing to return or erase',
      },
    });
  }

  if (receipt.topic === WEBHOOK_TOPICS.SHOP_REDACT && shop) {
    // 48 hours after uninstall. The catalogue mirror goes; the audit trail does not,
    // because it records what this app did rather than anything about a customer.
    await prisma.shopifyVariant.deleteMany({ where: { shopId: shop.id } });
    await prisma.shopifyCollectionProduct.deleteMany({ where: { shopId: shop.id } });
    await prisma.shopifyProduct.deleteMany({ where: { shopId: shop.id } });
    await prisma.shopifyCollection.deleteMany({ where: { shopId: shop.id } });
    logger.info({ shop: receipt.shopDomain }, 'shop/redact: catalogue mirror erased');
  }

  await markProcessed(receipt.webhookEventId);
  return new Response(null, { status: 200 });
}
