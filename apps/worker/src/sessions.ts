import { prisma } from '@spirithaus/db';

/**
 * The offline access token for a shop.
 *
 * The app uses online tokens so that every action has a verified person behind it
 * (section 20). Online tokens expire within a day, so background work cannot use them —
 * OAuth stores an offline session alongside, and that is what a worker runs as. A job
 * therefore acts as the app, not as a person, which is why anything needing human
 * authority stays in the request path.
 */
export async function offlineAccessToken(shopDomain: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: { id: 'asc' },
  });
  return session?.accessToken ?? null;
}
