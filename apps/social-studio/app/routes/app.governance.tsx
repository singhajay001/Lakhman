import { BlockStack, Card, DataTable, EmptyState, Layout, Page, Text } from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { DEFERRED_CONTRACTS, readSelections } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop } = await requireSection(request, 'providers:manage');

  const [models, templates, usage] = await Promise.all([
    prisma.modelRegistry.findMany({ orderBy: [{ provider: 'asc' }, { model: 'asc' }] }),
    prisma.promptTemplate.findMany({
      where: { shopId: shop.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    }),
    prisma.aIUsageRecord.groupBy({
      by: ['contract', 'outcome'],
      where: { shopId: shop.id },
      _count: { _all: true },
    }),
  ]);

  return {
    models: models.map((model) => ({
      provider: model.provider,
      model: model.model,
      purpose: model.purpose,
      active: model.active,
    })),
    templates: templates.map((template) => ({
      key: template.key,
      name: template.name,
      latestVersion: template.versions[0]?.version ?? null,
    })),
    usage: usage.map((row) => ({
      contract: row.contract,
      outcome: row.outcome,
      count: row._count._all,
    })),
    deferred: Object.entries(DEFERRED_CONTRACTS).map(([contract, reason]) => ({
      contract,
      reason,
    })),
    contracts: readSelections().length,
  };
}

export default function Governance() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page
      title="AI Governance"
      subtitle="What may generate, with which model and which prompt version."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Model registry
              </Text>
              <Text as="p" tone="subdued">
                Recorded so that every generated asset can name the model that made it. Listing a
                model here does not enable it; that is an administrator action with a data-sharing
                review attached.
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={['Provider', 'Model', 'Purpose', 'Active']}
                rows={data.models.map((model) => [
                  model.provider,
                  model.model,
                  model.purpose,
                  model.active ? 'yes' : 'no',
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Prompt registry
              </Text>
              {data.templates.length === 0 ? (
                <EmptyState heading="No prompt templates yet" image="">
                  <Text as="p">Phase 2 seeds these from the existing SPIRITHAUS prompt pack.</Text>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text']}
                  headings={['Key', 'Name', 'Latest version']}
                  rows={data.templates.map((template) => [
                    template.key,
                    template.name,
                    template.latestVersion === null ? 'none' : String(template.latestVersion),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Contracts with no provider, and why
              </Text>
              <DataTable
                columnContentTypes={['text', 'text']}
                headings={['Contract', 'Reason']}
                rows={data.deferred.map((entry) => [entry.contract, entry.reason])}
              />
              <Text as="p" tone="subdued">
                {data.contracts} provider contracts are defined in total.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Usage
              </Text>
              {data.usage.length === 0 ? (
                <Text as="p" tone="subdued">
                  No provider calls recorded. Every call writes one row with its units, estimated
                  cost and outcome.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric']}
                  headings={['Contract', 'Outcome', 'Calls']}
                  rows={data.usage.map((row) => [row.contract, row.outcome, String(row.count)])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
