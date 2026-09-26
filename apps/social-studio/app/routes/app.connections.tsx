import { Badge, BlockStack, Banner, Card, DataTable, Layout, Page, Text } from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { publishingAdapter, SOCIAL_PLATFORMS } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';

/**
 * Section 21: show what each platform will and will not permit, and never simulate a
 * publication. In Phase 1 there are no connections, so what this screen reports is the
 * capability position — including the two features that look unavailable to an
 * Australian liquor retailer.
 */
const KNOWN_RESTRICTIONS: { platform: string; capability: string; status: string; note: string }[] =
  [
    {
      platform: 'instagram',
      capability: 'Product tagging',
      status: 'Expected unavailable',
      note: 'Requires Instagram Shopping, which sits under Meta’s Commerce Policy prohibition on alcohol. Variants carry a tracked link instead.',
    },
    {
      platform: 'tiktok',
      capability: 'Paid advertising',
      status: 'Expected prohibited',
      note: 'TikTok’s advertising policy excludes alcohol. Organic only; no paid creative is built for TikTok.',
    },
    {
      platform: 'tiktok',
      capability: 'Direct posting',
      status: 'Needs app audit',
      note: 'An unaudited app can only post to the developer’s own account or a sandbox.',
    },
    {
      platform: 'youtube',
      capability: 'Uploads per day',
      status: 'Quota bound',
      note: 'An upload costs roughly 1600 units against a default 10,000/day, so about six uploads before a quota increase.',
    },
    {
      platform: 'x',
      capability: 'Posting',
      status: 'Tier dependent',
      note: 'Write allowance and media limits vary by paid tier, so the tier is part of the capability, not a property of the platform.',
    },
    {
      platform: 'pinterest',
      capability: 'Standard API access',
      status: 'Needs app review',
      note: 'Trial access is rate- and account-limited.',
    },
  ];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSection(request, 'connections:read');

  const platforms = await Promise.all(
    SOCIAL_PLATFORMS.map(async (platform) => {
      const adapter = publishingAdapter(platform, process.env.PROVIDER_PUBLISHING ?? 'mock');
      const capabilities = await adapter.capabilities();
      return {
        platform,
        adapterId: adapter.id,
        isMock: adapter.isMock,
        capabilities: capabilities.map((capability) => ({
          id: capability.id,
          available: capability.available,
          verified: capability.verified,
          reason: capability.reason ?? '',
        })),
      };
    }),
  );

  return { platforms, restrictions: KNOWN_RESTRICTIONS };
}

export default function Connections() {
  const { platforms, restrictions } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Social Connections"
      subtitle="Accounts, capabilities, and what each platform refuses."
    >
      <Layout>
        <Layout.Section>
          <Banner tone="warning" title="No account is connected, and nothing is verified">
            <p>
              OAuth arrives in Phase 4. Every capability below is marked unverified, because
              verifying one means reading the platform’s current documentation — which this
              environment’s network policy blocks. The app refuses to enable a capability that has
              never been checked rather than assuming it works.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Adapters
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={['Platform', 'Adapter', 'Publishing', 'What it reports']}
                rows={platforms.map((entry) => [
                  entry.platform,
                  entry.adapterId,
                  entry.isMock ? (
                    <Badge tone="attention" key={entry.platform}>
                      Mock — publishes nothing
                    </Badge>
                  ) : (
                    <Badge key={entry.platform}>Live</Badge>
                  ),
                  entry.capabilities.map((capability) => capability.reason).join(' '),
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Known platform and alcohol-policy limits
              </Text>
              <Text as="p" tone="subdued">
                Recorded as expectations pending verification, not as facts. Two of them remove a
                feature this app was asked for.
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={['Platform', 'Capability', 'Status', 'Note']}
                rows={restrictions.map((entry) => [
                  entry.platform,
                  entry.capability,
                  entry.status,
                  entry.note,
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
