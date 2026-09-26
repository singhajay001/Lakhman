/**
 * Ingests real product artwork from the Shopify catalogue into the protected-product pipeline.
 *
 *   pnpm sync:shopify-assets
 *
 * Two sources, chosen by what is reachable and stated in the audit record either way:
 *
 * - `admin` (default) uses the Admin GraphQL API and the shop's offline token. This is the
 *   production path: it sees product status, drafts and archived products.
 * - `storefront` reads the shop's public `/products.json`. It carries no token, reaches no Admin
 *   endpoint and touches no customer data. It exists because a network policy can allow
 *   `cdn.shopify.com` while refusing `*.myshopify.com`, and because ingesting real artwork beats
 *   ingesting a synthetic bottle. It cannot see drafts and has no metafields.
 *
 * Nothing here publishes, spends or connects an account. It reads images and writes to the local
 * database and object store.
 *
 *   SOURCE=storefront STOREFRONT_ORIGIN=https://www.example.com pnpm sync:shopify-assets
 *
 * PRODUCT_TYPES=Gin,Whisky restricts what is read. LIMIT caps how many products are considered.
 *
 * On Node 22 `fetch` ignores proxy environment variables, so behind an egress proxy this needs
 * NODE_USE_ENV_PROXY=1. That is a property of the container, not of the pipeline, which is why it
 * is set on the command rather than handled in code.
 */
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { shutdownOcr } from '@spirithaus/protected-assets';
import {
  AdminCatalogueSource,
  AdminClient,
  StorefrontCatalogueSource,
  type CatalogueSource,
} from '@spirithaus/shopify';
import { ingestCatalogueImages } from '@spirithaus/media-pipeline';

async function resolveSource(shopDomain: string): Promise<CatalogueSource> {
  const kind = process.env.SOURCE ?? 'admin';

  if (kind === 'storefront') {
    const origin = process.env.STOREFRONT_ORIGIN;
    if (!origin) {
      throw new Error(
        "SOURCE=storefront needs STOREFRONT_ORIGIN, e.g. https://www.example.com. It is not guessed from the shop domain, because reading a URL nobody asked for is not this script's business.",
      );
    }
    return new StorefrontCatalogueSource(origin);
  }

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: { expires: 'desc' },
  });
  if (!session?.accessToken) {
    throw new Error(
      `No offline session for ${shopDomain}, so the Admin API cannot be called. Install the app and complete OAuth, or run with SOURCE=storefront to read the public catalogue instead.`,
    );
  }

  return new AdminCatalogueSource(
    new AdminClient({
      shopDomain,
      accessToken: session.accessToken,
      apiVersion: process.env.SHOPIFY_API_VERSION ?? '2025-07',
    }),
    shopDomain,
  );
}

async function main(): Promise<void> {
  const domain = process.env.SEED_SHOP_DOMAIN ?? 'spirithaus-dev.myshopify.com';
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) throw new Error(`No shop ${domain}. Run pnpm db:seed first.`);

  const user = await prisma.user.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error(`No user in ${domain}. Run pnpm db:seed first.`);
  const actor: Principal = { userId: user.id, shopId: shop.id, roles: ['administrator'] };

  const source = await resolveSource(domain);
  const limit = Number(process.env.LIMIT ?? '25');

  // The rights basis is asserted by whoever runs this, not assumed by the code. A supplier's
  // packshot in a retailer's catalogue is not automatically licensed for marketing use, and
  // section 16 wants the basis recorded rather than invented.
  const holder = process.env.ASSET_LICENCE_HOLDER;
  const terms = process.env.ASSET_LICENCE_TERMS;
  if (!holder || !terms) {
    throw new Error(
      'Set ASSET_LICENCE_HOLDER and ASSET_LICENCE_TERMS to record the rights basis for these images before ingesting them. There is no default, because a supplier packshot carried in a catalogue is not automatically licensed for marketing use, and an asset with an invented licence is worse than no asset.',
    );
  }

  const types = process.env.PRODUCT_TYPES?.split(',')
    .map((type) => type.trim())
    .filter(Boolean);

  const result = await ingestCatalogueImages({
    shopId: shop.id,
    actor,
    source,
    limit,
    ...(types && types.length > 0 ? { productTypes: types } : {}),
    licence: {
      kind: (process.env.ASSET_LICENCE_KIND as 'OWNED' | 'COMMISSIONED' | 'LICENSED') ?? 'LICENSED',
      holder,
      terms,
      permittedUses: (process.env.ASSET_LICENCE_USES ?? 'social')
        .split(',')
        .map((use) => use.trim()),
      evidenceUrl: process.env.ASSET_LICENCE_EVIDENCE_URL ?? null,
    },
  });

  console.log(`\nsource: ${result.source}`);
  console.log(
    `considered ${result.considered}, ingested ${result.ingested}, already present ${result.alreadyPresent}, skipped ${result.skipped}, needing review ${result.needingReview}\n`,
  );

  for (const entry of result.products) {
    if (entry.outcome.status === 'ingested') {
      console.log(
        `  ingested       ${entry.title.slice(0, 48)}${entry.outcome.needsReview ? '  [needs review]' : ''}`,
      );
      for (const reason of entry.outcome.reviewReasons) console.log(`                 - ${reason}`);
    } else if (entry.outcome.status === 'already_present') {
      console.log(`  already held   ${entry.title.slice(0, 48)}`);
    } else {
      console.log(`  skipped        ${entry.title.slice(0, 48)}`);
      console.log(`                 ${entry.outcome.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownOcr();
    await prisma.$disconnect();
  });
