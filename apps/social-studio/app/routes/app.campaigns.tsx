import {
  Badge,
  BlockStack,
  Card,
  DataTable,
  EmptyState,
  Layout,
  Link,
  Page,
  Text,
} from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { formatInZone } from '@spirithaus/domain';
import { requireSection } from '../lib/principal.server.js';

const STATE_TONE: Record<string, 'success' | 'attention' | 'critical' | 'info' | undefined> = {
  DRAFT: undefined,
  RESEARCH_REVIEW: 'attention',
  COMPLIANCE_REVIEW: 'attention',
  CHANGES_REQUESTED: 'critical',
  APPROVED: 'success',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
  FAILED: 'critical',
  PAUSED: 'attention',
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop } = await requireSection(request, 'campaign:read');

  const campaigns = await prisma.campaign.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      variants: { select: { platform: true, approvalState: true } },
      complianceChecks: { where: { outcome: 'FAIL', severity: 'BLOCKING' }, select: { id: true } },
      approvals: { select: { outcome: true, requiredKeys: true, keys: { select: { id: true } } } },
    },
  });

  return {
    timezone: shop.timezone,
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      state: campaign.state,
      updatedAt: formatInZone(campaign.updatedAt, shop.timezone),
      variants: campaign.variants.length,
      approved: campaign.variants.filter((variant) => variant.approvalState === 'APPROVED').length,
      invalidated: campaign.variants.filter((variant) => variant.approvalState === 'INVALIDATED')
        .length,
      blocking: campaign.complianceChecks.length,
      awaitingKeys: campaign.approvals
        .filter((approval) => approval.outcome === 'PENDING')
        .reduce((total, approval) => total + (approval.requiredKeys - approval.keys.length), 0),
    })),
  };
}

export default function Campaigns() {
  const { campaigns, timezone } = useLoaderData<typeof loader>();

  return (
    <Page title="Campaigns" subtitle={`Times in ${timezone}.`}>
      <Layout>
        <Layout.Section>
          <Card>
            {campaigns.length === 0 ? (
              <EmptyState heading="No campaigns yet" image="">
                <Text as="p">
                  Build one from <Link url="/app/create">Create</Link>. It will generate a variant
                  per platform from one strategy, run the compliance ruleset over each, and wait for
                  a human.
                </Text>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <DataTable
                  columnContentTypes={[
                    'text',
                    'text',
                    'text',
                    'numeric',
                    'numeric',
                    'numeric',
                    'text',
                  ]}
                  headings={[
                    'Campaign',
                    'Objective',
                    'State',
                    'Variants',
                    'Approved',
                    'Blocking',
                    'Updated',
                  ]}
                  rows={campaigns.map((campaign) => [
                    <Link key={campaign.id} url={`/app/campaigns/${campaign.id}`}>
                      {campaign.name}
                    </Link>,
                    campaign.objective.toLowerCase().replace(/_/g, ' '),
                    <Badge key={`${campaign.id}-state`} tone={STATE_TONE[campaign.state]}>
                      {campaign.state.replace(/_/g, ' ')}
                    </Badge>,
                    String(campaign.variants),
                    String(campaign.approved),
                    campaign.blocking > 0 ? (
                      <Badge key={`${campaign.id}-block`} tone="critical">
                        {String(campaign.blocking)}
                      </Badge>
                    ) : (
                      '0'
                    ),
                    campaign.updatedAt,
                  ])}
                />
                {campaigns.some((campaign) => campaign.invalidated > 0) ? (
                  <Text as="p" tone="subdued">
                    An invalidated variant was edited after it was approved. That is the database
                    withdrawing the approval, not an error.
                  </Text>
                ) : null}
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
