import type { ActionFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { markProcessed, receiveWebhook } from '../lib/webhook.server.js';
import { enqueueSync } from '../lib/sync.server.js';

/**
 * Inventory is the webhook that protects campaigns (section 31). Phase 1 revalidates
 * the mirror; pausing queued posts arrives with the publish queue in Phase 4, and the
 * audit note here says so rather than implying a pause happened.
 */
export async function action({ request }: ActionFunctionArgs) {
  const receipt = await receiveWebhook(request);
  if (!receipt.accepted) return receipt.response;
  if (receipt.duplicate) return new Response(null, { status: 200 });

  const shop = await prisma.shop.findUnique({ where: { domain: receipt.shopDomain } });
  if (!shop) {
    await markProcessed(receipt.webhookEventId);
    return new Response(null, { status: 200 });
  }

  await enqueueSync({
    shopId: shop.id,
    shopDomain: shop.domain,
    kind: 'INVENTORY',
    trigger: 'webhook',
  });

  await markProcessed(receipt.webhookEventId);
  return new Response(null, { status: 200 });
}
