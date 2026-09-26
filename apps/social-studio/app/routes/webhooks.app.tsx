import type { ActionFunctionArgs } from 'react-router';
import { prisma, recordAudit } from '@spirithaus/db';
import { WEBHOOK_TOPICS } from '@spirithaus/shopify';
import { markProcessed, receiveWebhook } from '../lib/webhook.server.js';
import { sessionStorage } from '../shopify.server.js';

export async function action({ request }: ActionFunctionArgs) {
  const receipt = await receiveWebhook(request);
  if (!receipt.accepted) return receipt.response;
  if (receipt.duplicate) return new Response(null, { status: 200 });

  const shop = await prisma.shop.findUnique({ where: { domain: receipt.shopDomain } });

  if (receipt.topic === WEBHOOK_TOPICS.APP_UNINSTALLED) {
    // Sessions go; history stays. Section 31: revalidate and disable, never delete the
    // record of what was published.
    const sessions = await sessionStorage.findSessionsByShop(receipt.shopDomain);
    if (sessions.length > 0)
      await sessionStorage.deleteSessions(sessions.map((session) => session.id));

    if (shop) {
      await prisma.shop.update({ where: { id: shop.id }, data: { uninstalledAt: new Date() } });
      await prisma.providerConfig.updateMany({
        where: { shopId: shop.id },
        data: { enabled: false },
      });
      await recordAudit(prisma, {
        shopId: shop.id,
        action: 'app.uninstalled',
        targetType: 'Shop',
        targetId: shop.id,
        after: { sessionsDeleted: sessions.length, providersDisabled: true },
      });
    }
  }

  if (receipt.topic === WEBHOOK_TOPICS.SHOP_UPDATE && shop) {
    const payload = receipt.payload as { name?: string; iana_timezone?: string; currency?: string };
    const before = { name: shop.name, timezone: shop.timezone, currency: shop.currency };
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        name: payload.name ?? shop.name,
        timezone: payload.iana_timezone ?? shop.timezone,
        currency: payload.currency ?? shop.currency,
      },
    });
    await recordAudit(prisma, {
      shopId: shop.id,
      action: 'app.scopes_changed',
      targetType: 'Shop',
      targetId: shop.id,
      before,
      after: { name: payload.name, timezone: payload.iana_timezone, currency: payload.currency },
    });
  }

  await markProcessed(receipt.webhookEventId);
  return new Response(null, { status: 200 });
}
