import {
  BlockStack,
  Badge,
  Banner,
  Card,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
} from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { formatInZone } from '@spirithaus/domain';
import { readSelections } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, user, principal } = await requireSection(request, 'campaign:read');

  const [products, availableVariants, lastSync, providerRows, auditCount] = await Promise.all([
    prisma.shopifyProduct.count({ where: { shopId: shop.id } }),
    prisma.shopifyVariant.count({ where: { shopId: shop.id, availableForSale: true } }),
    prisma.syncRun.findFirst({ where: { shopId: shop.id }, orderBy: { startedAt: 'desc' } }),
    prisma.providerConfig.findMany({ where: { shopId: shop.id }, orderBy: { contract: 'asc' } }),
    prisma.auditEvent.count({ where: { shopId: shop.id } }),
  ]);

  const selections = readSelections();
  const liveProviders = providerRows.filter(
    (row) => row.enabled && row.adapterId !== 'mock',
  ).length;

  return {
    shop,
    user,
    roles: principal.roles,
    products,
    availableVariants,
    auditCount,
    lastSync: lastSync
      ? {
          kind: lastSync.kind,
          status: lastSync.status,
          startedAt: formatInZone(lastSync.startedAt, shop.timezone),
          counts: lastSync.counts as Record<string, number>,
        }
      : null,
    providers: { total: selections.length, live: liveProviders },
  };
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Dashboard" subtitle={`${data.shop.domain} · ${data.shop.timezone}`}>
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Phase 1 — foundation">
            <p>
              Installed, synchronising and audited. Research, campaigns, media, publishing and
              attribution are later phases, and every screen that belongs to one says so rather than
              showing an empty version of itself.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Catalogue
              </Text>
              <InlineStack gap="400">
                <Text as="p">{data.products} products mirrored</Text>
                <Text as="p">{data.availableVariants} variants available for sale</Text>
              </InlineStack>
              {data.lastSync ? (
                <Text as="p" tone="subdued">
                  Last sync: {data.lastSync.kind} — {data.lastSync.status} at{' '}
                  {data.lastSync.startedAt}
                </Text>
              ) : (
                <Text as="p" tone="subdued">
                  No sync has run yet. Start one from <Link url="/app/products">Products</Link>.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Providers
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Text as="p">
                  {data.providers.live} of {data.providers.total} contracts have a live adapter
                </Text>
                {data.providers.live === 0 ? <Badge tone="attention">All mocked</Badge> : null}
              </InlineStack>
              <Text as="p" tone="subdued">
                A mocked provider transmits nothing and publishes nothing. Nothing in this app will
                report a publication that did not happen.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                This session
              </Text>
              <Text as="p">
                {data.user.name ?? data.user.email} —{' '}
                {data.roles.length > 0 ? data.roles.join(', ') : 'no role assigned'}
              </Text>
              <Text as="p" tone="subdued">
                {data.auditCount} recorded events. The audit trail is append-only at the database
                level.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
