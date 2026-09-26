import { prisma, recordAudit } from '@spirithaus/db';
import {
  DomainError,
  type Permission,
  type Principal,
  type RoleKey,
  isRoleKey,
  requirePermission,
} from '@spirithaus/domain';
import { missingMandatoryScopes } from '@spirithaus/shopify';
import { authenticate } from '../shopify.server.js';

export interface AuthenticatedContext {
  principal: Principal;
  shop: { id: string; domain: string; timezone: string; currency: string; grantedScopes: string[] };
  user: { id: string; email: string; name: string | null };
  /** Mandatory scopes Shopify did not grant. Surfaced, not assumed away. */
  missingScopes: string[];
  session: Awaited<ReturnType<typeof authenticate.admin>>['session'];
  admin: Awaited<ReturnType<typeof authenticate.admin>>['admin'];
}

/**
 * Resolves the Shopify session into a Principal with roles.
 *
 * Online tokens carry the staff member who is looking at the screen, which is what
 * section 20 means by a verified human. A user seen for the first time gets **no
 * roles** — except the account owner at install, who gets Administrator, because
 * otherwise nobody could grant the first role. Least privilege by default is
 * occasionally inconvenient and that is the intended trade.
 */
export async function authenticateAdmin(request: Request): Promise<AuthenticatedContext> {
  const { session, admin } = await authenticate.admin(request);

  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    create: { domain: session.shop, grantedScopes: session.scope?.split(',') ?? [] },
    update: { grantedScopes: session.scope?.split(',') ?? [], uninstalledAt: null },
  });

  const associated = session.onlineAccessInfo?.associated_user;
  if (!associated) {
    throw new DomainError(
      'precondition_failed',
      'This session carries no staff identity, so no action can be attributed to a person. Reload the app from Shopify Admin.',
    );
  }

  const email = associated.email ?? `shopify-user-${associated.id}@${session.shop}`;
  const name = [associated.first_name, associated.last_name].filter(Boolean).join(' ') || null;

  const existing = await prisma.user.findUnique({
    where: { shopId_email: { shopId: shop.id, email } },
    include: { roles: { include: { role: true } } },
  });

  let user = existing;
  if (!user) {
    const created = await prisma.user.create({
      data: {
        shopId: shop.id,
        email,
        name,
        shopifyUserId: BigInt(associated.id),
      },
    });
    await recordAudit(prisma, {
      shopId: shop.id,
      action: 'user.created',
      targetType: 'User',
      targetId: created.id,
      after: { email, accountOwner: associated.account_owner === true },
    });

    if (associated.account_owner === true) {
      const administrator = await prisma.role.findUnique({ where: { key: 'administrator' } });
      if (administrator) {
        await prisma.userRole.create({ data: { userId: created.id, roleId: administrator.id } });
        await recordAudit(prisma, {
          shopId: shop.id,
          action: 'user.role_granted',
          targetType: 'User',
          targetId: created.id,
          actorUserId: created.id,
          after: { role: 'administrator', reason: 'Shopify account owner at first sign-in' },
        });
      }
    }

    user = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { roles: { include: { role: true } } },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), name: name ?? user.name },
    });
  }

  const roles = user.roles
    .map((link) => link.role.key)
    .filter((key): key is RoleKey => isRoleKey(key));

  return {
    principal: { userId: user.id, shopId: shop.id, roles },
    shop: {
      id: shop.id,
      domain: shop.domain,
      timezone: shop.timezone,
      currency: shop.currency,
      grantedScopes: shop.grantedScopes,
    },
    user: { id: user.id, email: user.email, name: user.name },
    missingScopes: missingMandatoryScopes(shop.grantedScopes),
    session,
    admin,
  };
}

/**
 * The loader guard. Authenticates, then refuses without the permission — the refusal
 * is a 403 with the permission named, not a redirect that looks like the page is empty.
 */
export async function requireSection(
  request: Request,
  permission: Permission,
): Promise<AuthenticatedContext> {
  const context = await authenticateAdmin(request);
  requirePermission(context.principal, permission);
  return context;
}
