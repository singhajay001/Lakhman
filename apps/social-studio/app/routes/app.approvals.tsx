import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import {
  Form,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import { KEY_REQUIREMENTS, formatInZone, requirePermission } from '@spirithaus/domain';
import { requireSection } from '../lib/principal.server.js';
import { signApprovalKey } from '../lib/campaign.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'campaign:read');

  const approvals = await prisma.approval.findMany({
    where: { shopId: shop.id },
    orderBy: [{ outcome: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      campaign: { select: { id: true, name: true } },
      variant: { select: { platform: true, contentHash: true, approvalState: true } },
      keys: true,
    },
  });

  return {
    canApprove: principal.roles.some((role) =>
      ['campaign_manager', 'compliance_reviewer', 'finance_approver'].includes(role),
    ),
    myUserId: principal.userId,
    roles: principal.roles,
    requirements: KEY_REQUIREMENTS,
    approvals: approvals.map((approval) => ({
      id: approval.id,
      campaignId: approval.campaign.id,
      campaign: approval.campaign.name,
      platform: approval.variant?.platform ?? '—',
      kind: approval.kind,
      outcome: approval.outcome,
      requiredKeys: approval.requiredKeys,
      createdAt: formatInZone(approval.createdAt, shop.timezone),
      hashPrefix: approval.contentHash.slice(0, 12),
      // If the variant's hash has moved, the approval is for content that no longer
      // exists. Shown rather than hidden, because it is the interesting case.
      stale: Boolean(approval.variant && approval.variant.contentHash !== approval.contentHash),
      keys: approval.keys.map((key) => ({ role: key.role, userId: key.userId, note: key.note })),
      signedByMe: approval.keys.some((key) => key.userId === principal.userId),
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'campaign:read');
  requirePermission(principal, 'campaign:approve');

  const form = await request.formData();
  const result = await signApprovalKey({
    shopId: shop.id,
    actor: principal,
    approvalId: String(form.get('approvalId')),
    note: (form.get('note') as string) || undefined,
  });

  return result.ok
    ? {
        message: result.granted
          ? 'Approved. Every key is in.'
          : 'Key signed. A second, distinct person must sign the other.',
      }
    : { error: result.error };
}

const OUTCOME_TONE: Record<string, 'success' | 'attention' | 'critical' | undefined> = {
  GRANTED: 'success',
  PENDING: 'attention',
  INVALIDATED: 'critical',
  REJECTED: undefined,
};

export default function Approvals() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = data.approvals.filter((approval) => approval.outcome === 'PENDING');

  return (
    <Page
      title="Approvals"
      subtitle="Nothing reaches the public without a recorded human decision."
    >
      <Layout>
        {result && 'error' in result && result.error ? (
          <Layout.Section>
            <Banner tone="critical" title="Refused">
              <p>{result.error}</p>
            </Banner>
          </Layout.Section>
        ) : null}
        {result && 'message' in result && result.message ? (
          <Layout.Section>
            <Banner tone="success">
              <p>{result.message}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Waiting on a human
              </Text>
              {pending.length === 0 ? (
                <EmptyState heading="Nothing is waiting" image="">
                  <Text as="p">
                    Submit a variant from a campaign to create an approval. The number of keys is
                    computed from the action and the compliance result, never chosen by the
                    requester.
                  </Text>
                </EmptyState>
              ) : (
                pending.map((approval) => (
                  <Card key={approval.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          <Link url={`/app/campaigns/${approval.campaignId}`}>
                            {approval.campaign}
                          </Link>{' '}
                          · {approval.platform}
                        </Text>
                        <InlineStack gap="200">
                          <Badge tone={OUTCOME_TONE[approval.outcome]}>{approval.outcome}</Badge>
                          <Badge>{`${approval.keys.length}/${approval.requiredKeys} keys`}</Badge>
                        </InlineStack>
                      </InlineStack>

                      <Text as="p" tone="subdued">
                        {approval.kind.replace(/_/g, ' ').toLowerCase()} · content{' '}
                        {approval.hashPrefix} · requested {approval.createdAt}
                      </Text>
                      <Text as="p" tone="subdued">
                        {data.requirements[approval.kind as keyof typeof data.requirements]?.why}
                      </Text>

                      {approval.stale ? (
                        <Banner tone="critical" title="The content has moved">
                          <p>
                            This approval is for a version of the copy that no longer exists.
                            Nothing can be signed against it — re-run the checks and submit again.
                          </p>
                        </Banner>
                      ) : null}

                      {approval.keys.length > 0 ? (
                        <Text as="p">
                          Signed by: {approval.keys.map((key) => key.role).join(', ')}
                        </Text>
                      ) : null}

                      {approval.signedByMe ? (
                        <Banner tone="info">
                          <p>
                            You have already signed this. Dual control requires two distinct people,
                            so the second key is somebody else&rsquo;s.
                          </p>
                        </Banner>
                      ) : data.canApprove && !approval.stale ? (
                        <Form method="post">
                          <input type="hidden" name="approvalId" value={approval.id} />
                          <InlineStack gap="200">
                            <TextField label="Note" labelHidden name="note" autoComplete="off" />
                            <Button submit variant="primary">
                              Sign a key
                            </Button>
                          </InlineStack>
                        </Form>
                      ) : null}
                    </BlockStack>
                  </Card>
                ))
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Decided
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Campaign', 'Platform', 'Kind', 'Outcome', 'Keys']}
                rows={data.approvals
                  .filter((approval) => approval.outcome !== 'PENDING')
                  .map((approval) => [
                    approval.campaign,
                    approval.platform,
                    approval.kind.replace(/_/g, ' ').toLowerCase(),
                    <Badge key={approval.id} tone={OUTCOME_TONE[approval.outcome]}>
                      {approval.outcome}
                    </Badge>,
                    approval.keys.map((key) => key.role).join(', ') || '—',
                  ])}
              />
              <Text as="p" tone="subdued">
                An invalidated approval was withdrawn by the database when the content changed. It
                is kept, not deleted: the record of what was approved and when is the point.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
