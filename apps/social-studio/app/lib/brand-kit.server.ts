import { prisma, recordAudit, type BrandKitVersion } from '@spirithaus/db';
import {
  brandKitReadiness,
  buildBrandKit,
  type BrandKitContent,
  type Principal,
} from '@spirithaus/domain';
import type { BrandRules } from '@spirithaus/compliance';
import { loadThemeProfile } from './theme-profile.server.js';

/**
 * The Brand Kit is versioned and append-only (section 14). A change publishes the next
 * version; nothing edits a published one, so the exact kit an asset was made under can
 * always be resolved.
 */
export async function ensureBrandKit(
  shopId: string,
  actor?: Principal,
): Promise<{ version: BrandKitVersion; seededFrom: string } | { error: string }> {
  const existing = await prisma.brandKit.findUnique({
    where: { shopId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });

  const current = existing?.versions[0];
  if (current) return { version: current, seededFrom: 'existing version' };

  const loaded = loadThemeProfile();
  if (!loaded.ok) return { error: loaded.error };

  const built = buildBrandKit({ themeProfile: loaded.value.profile });
  const kit = existing ?? (await prisma.brandKit.create({ data: { shopId } }));

  const version = await prisma.brandKitVersion.create({
    data: {
      shopId,
      brandKitId: kit.id,
      version: 1,
      content: built.content as unknown as object,
      placeholders: built.placeholders,
      note: `Seeded from ${loaded.value.path}. Placeholders require confirmation before the kit is usable.`,
      publishedByUserId: actor?.userId ?? null,
    },
  });

  await prisma.brandKit.update({ where: { id: kit.id }, data: { currentVersionId: version.id } });
  await recordAudit(prisma, {
    shopId,
    action: 'brand_kit.published',
    targetType: 'BrandKitVersion',
    targetId: version.id,
    actorUserId: actor?.userId,
    after: { version: 1, placeholders: built.placeholders, seededFrom: loaded.value.path },
  });

  return { version, seededFrom: loaded.value.path };
}

/**
 * Publishes the next version with the supplied changes merged in. Confirming a
 * placeholder removes it from the list; nothing else can.
 */
export async function publishBrandKitVersion(input: {
  shopId: string;
  actor: Principal;
  changes: Partial<BrandKitContent>;
  note: string;
}): Promise<{ version: BrandKitVersion } | { error: string }> {
  const kit = await prisma.brandKit.findUnique({
    where: { shopId: input.shopId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const current = kit?.versions[0];
  if (!kit || !current) return { error: 'No Brand Kit exists yet for this shop.' };

  const content = { ...(current.content as unknown as BrandKitContent), ...input.changes };
  const placeholders = current.placeholders.filter((path) => !isConfirmed(content, path));

  const version = await prisma.brandKitVersion.create({
    data: {
      shopId: input.shopId,
      brandKitId: kit.id,
      version: current.version + 1,
      content: content as unknown as object,
      placeholders,
      note: input.note,
      publishedByUserId: input.actor.userId,
    },
  });

  await prisma.brandKit.update({ where: { id: kit.id }, data: { currentVersionId: version.id } });
  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'brand_kit.published',
    targetType: 'BrandKitVersion',
    targetId: version.id,
    actorUserId: input.actor.userId,
    before: { version: current.version, placeholders: current.placeholders },
    after: { version: version.version, placeholders, changed: Object.keys(input.changes) },
  });

  return { version };
}

function isConfirmed(content: BrandKitContent, path: string): boolean {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, content as unknown);

  if (value === null || value === undefined) return false;
  if (typeof value === 'string')
    return value.trim().length > 0 && !value.includes('[TO BE CONFIRMED]');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(
      (item) => item !== null && item !== '',
    );
  }
  return true;
}

/** The rules the compliance engine needs from the current kit. */
export function brandRulesFrom(version: BrandKitVersion): BrandRules {
  const content = version.content as unknown as BrandKitContent;
  return {
    prohibitedPhrases: content.prohibitedPhrases ?? [],
    approvedBrandVariations: content.approvedBrandVariations ?? [],
    responsibleConsumptionLine: content.responsibleConsumptionLine ?? null,
    brandKitVersionId: version.id,
  };
}

export function readinessFor(version: BrandKitVersion) {
  return brandKitReadiness(version.placeholders);
}
