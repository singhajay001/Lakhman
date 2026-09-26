import {
  Badge,
  BlockStack,
  Card,
  DataTable,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
} from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { MANDATORY_SCOPES, NEVER_REQUESTED, OPTIONAL_SCOPES } from '@spirithaus/shopify';
import { readSelections } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop } = await requireSection(request, 'settings:manage');

  const configs = await prisma.providerConfig.findMany({
    where: { shopId: shop.id },
    orderBy: { contract: 'asc' },
  });
  const byContract = new Map(configs.map((config) => [config.contract, config]));

  return {
    shop,
    granted: shop.grantedScopes,
    mandatory: MANDATORY_SCOPES.map((scope) => ({
      ...scope,
      granted: shop.grantedScopes.includes(scope.scope),
    })),
    optional: OPTIONAL_SCOPES.map((scope) => ({
      ...scope,
      granted: shop.grantedScopes.includes(scope.scope),
    })),
    neverRequested: NEVER_REQUESTED,
    providers: readSelections().map((selection) => {
      const config = byContract.get(selection.contract);
      return {
        contract: selection.contract,
        adapterId: config?.adapterId ?? selection.adapterId,
        enabled: config?.enabled ?? false,
        hasRateCard: Boolean(config?.rateCard),
        termsReviewed: Boolean(config?.reviewedAt),
        envVar: selection.envVar,
      };
    }),
  };
}

export default function Settings() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page
      title="Settings"
      subtitle={`${data.shop.domain} · ${data.shop.timezone} · ${data.shop.currency}`}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Scopes this app requested, and why
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={['Scope', 'Granted', 'Feature', 'Why it is needed']}
                rows={[...data.mandatory, ...data.optional].map((scope) => [
                  scope.scope,
                  scope.granted ? 'yes' : 'no',
                  scope.feature,
                  scope.reason,
                ])}
              />
              <Text as="h3" variant="headingSm">
                Scopes this app never requests
              </Text>
              <List>
                {data.neverRequested.map((entry) => (
                  <List.Item key={entry.scope}>
                    <Text as="span" fontWeight="semibold">
                      {entry.scope}
                    </Text>{' '}
                    — {entry.why}
                  </List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Providers
              </Text>
              <Text as="p" tone="subdued">
                A provider is enabled by an administrator who has reviewed its data-sharing terms
                and entered its rate card. Without a rate card, a cost estimate is unknown, and an
                unknown cost is refused against any budget rather than treated as free.
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Contract', 'Adapter', 'State', 'Rate card', 'Terms reviewed']}
                rows={data.providers.map((provider) => [
                  provider.contract,
                  provider.adapterId,
                  provider.enabled ? (
                    <Badge tone="success" key={provider.contract}>
                      Enabled
                    </Badge>
                  ) : (
                    <Badge key={provider.contract}>Disabled</Badge>
                  ),
                  provider.hasRateCard ? 'set' : 'not set',
                  provider.termsReviewed ? 'yes' : 'no',
                ])}
              />
              <InlineStack gap="200">
                <Text as="p" tone="subdued">
                  Adapters are selected per contract with the environment variables listed in
                  .env.example.
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
