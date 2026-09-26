import type { ActionFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { markProcessed, receiveWebhook } from '../lib/webhook.server.js';
import { enqueueSync } from '../lib/sync.server.js';

/**
 * A catalogue change triggers revalidation, never deletion (section 31). Even
 * products/delete only marks the mirror: a published post referencing the product
 * must fail its preflight check, not point at a row that vanished.
 */
export async function action({ request }: ActionFunctionArgs) {
  const receipt = await receiveWebhook(request);
  if (!receipt.accepted) return receipt.response;
  if (receipt.duplicate) return new Response(null, { status: 200 });

  const shop = await prisma.shop.findUnique({ where: { domain: receipt.shopDomain } });
  if (!shop) {
    // Verified, recorded, and not ours to act on. Retrying will not change that.
    await markProcessed(receipt.webhookEventId);
    return new Response(null, { status: 200 });
  }

  await enqueueSync({
    shopId: shop.id,
    shopDomain: shop.domain,
    kind: 'PRODUCTS',
    trigger: 'webhook',
  });

  await markProcessed(receipt.webhookEventId);
  return new Response(null, { status: 200 });
}
