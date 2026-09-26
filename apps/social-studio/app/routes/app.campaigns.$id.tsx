import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  Divider,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import { DomainError, requirePermission } from '@spirithaus/domain';
import { DISCLAIMER } from '@spirithaus/compliance';
import type { QualityAssessment } from '@spirithaus/content';
import { requireSection } from '../lib/principal.server.js';
import {
  editVariantCopy,
  runComplianceFor,
  signApprovalKey,
  submitForApproval,
} from '../lib/campaign.server.js';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'campaign:read');

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, shopId: shop.id },
    include: {
      brief: true,
      products: { include: { product: { select: { title: true } } } },
      variants: {
        orderBy: { platform: 'asc' },
        include: {
          checks: { orderBy: [{ outcome: 'desc' }, { severity: 'asc' }] },
          approvals: { include: { keys: true } },
        },
      },
    },
  });

  if (!campaign) throw new DomainError('not_found', 'That campaign does not exist in this shop.');

  const strategy = (campaign.brief?.strategy ?? {}) as Record<string, unknown>;
  const factSheet = (campaign.brief?.factSheet ?? { facts: [], excluded: [], products: [] }) as {
    facts: { field: string; value: string; kind: string; origin: string }[];
    excluded: { field: string; value: string; because: string }[];
  };

  return {
    canEdit: principal.roles.some((role) => ['creator', 'campaign_manager'].includes(role)),
    canApprove: principal.roles.some((role) =>
      ['campaign_manager', 'compliance_reviewer'].includes(role),
    ),
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      state: campaign.state,
      offerTerms: campaign.offerTerms,
      products: campaign.products.map((entry) => entry.product.title),
    },
    strategy,
    factSheet,
    variants: campaign.variants.map((variant) => ({
      id: variant.id,
      platform: variant.platform,
      primaryCopy: variant.primaryCopy,
      hashtags: variant.hashtags,
      altText: variant.altText,
      destinationUrl: variant.destinationUrl,
      approvalState: variant.approvalState,
      revision: variant.revision,
      hashPrefix: variant.contentHash?.slice(0, 12) ?? null,
      generation: variant.generation as Record<string, unknown> | null,
      quality: variant.qualityScores as unknown as QualityAssessment | null,
      checks: variant.checks.map((check) => ({
        ruleId: check.ruleId,
        category: check.category,
        severity: check.severity,
        outcome: check.outcome,
        explanation: check.explanation,
        suggestion: check.suggestion,
        evidence: check.evidence as { field: string; match: string; excerpt: string }[] | null,
      })),
      approvals: variant.approvals.map((approval) => ({
        id: approval.id,
        outcome: approval.outcome,
        requiredKeys: approval.requiredKeys,
        keys: approval.keys.map((key) => ({ role: key.role, userId: key.userId })),
      })),
    })),
    disclaimer: DISCLAIMER,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'campaign:read');
  const form = await request.formData();
  const intent = String(form.get('intent'));

  if (intent === 'edit') {
    requirePermission(principal, 'campaign:edit');
    const result = await editVariantCopy({
      shopId: shop.id,
      actor: principal,
      variantId: String(form.get('variantId')),
      primaryCopy: String(form.get('primaryCopy') ?? ''),
    });
    if (!result.ok) return { error: result.error };
    return {
      message: result.invalidated
        ? 'Saved. The approval was withdrawn because the copy changed.'
        : 'Saved, and the checks were re-run.',
    };
  }

  if (intent === 'recheck') {
    requirePermission(principal, 'campaign:read');
    await runComplianceFor(shop.id, String(form.get('variantId')));
    return { message: 'Checks re-run.' };
  }

  if (intent === 'submit') {
    requirePermission(principal, 'campaign:edit');
    const result = await submitForApproval({
      shopId: shop.id,
      actor: principal,
      variantId: String(form.get('variantId')),
    });
    return result.ok
      ? { message: `Submitted. ${result.requiredKeys} key(s) required.` }
      : { error: result.error };
  }

  if (intent === 'sign') {
    requirePermission(principal, 'campaign:approve');
    const result = await signApprovalKey({
      shopId: shop.id,
      actor: principal,
      approvalId: String(form.get('approvalId')),
      note: (form.get('note') as string) || undefined,
    });
    return result.ok
      ? {
          message: result.granted
            ? 'Approved.'
            : 'Key signed. Another distinct person must sign the second.',
        }
      : { error: result.error };
  }

  return { error: 'Unknown action.' };
}

const SEVERITY_TONE: Record<string, 'critical' | 'warning' | 'info'> = {
  BLOCKING: 'critical',
  ADVISORY: 'warning',
  INFO: 'info',
};

export default function CampaignDetail() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Page
      title={data.campaign.name}
      subtitle={`${data.campaign.objective.toLowerCase().replace(/_/g, ' ')} · ${data.campaign.state.replace(/_/g, ' ')} · ${data.campaign.products.join(', ')}`}
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
                The fact sheet this campaign was built from
              </Text>
              {data.factSheet.facts.length === 0 ? (
                <Text as="p" tone="subdued">
                  No approved research claim. The copy can restate only Shopify product data, and
                  any ABV, award, rating, vintage or price that is not in the product snapshot is
                  blocked.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text']}
                  headings={['Attribute', 'Value', 'Kind', 'Source']}
                  rows={data.factSheet.facts.map((fact) => [
                    fact.field,
                    fact.value,
                    fact.kind,
                    fact.origin.replace(/^https?:\/\//, '').slice(0, 40),
                  ])}
                />
              )}
              {data.factSheet.excluded.length > 0 ? (
                <Text as="p" tone="subdued">
                  {data.factSheet.excluded.length} claim(s) excluded and unusable in copy:{' '}
                  {data.factSheet.excluded
                    .map((claim) => `${claim.field} (${claim.because})`)
                    .join(', ')}
                  . The sheet is frozen, so approving one now does not change this campaign.
                </Text>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>

        {data.variants.map((variant) => (
          <Layout.Section key={variant.id}>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {variant.platform}
                  </Text>
                  <InlineStack gap="200">
                    <Badge
                      tone={
                        variant.approvalState === 'APPROVED'
                          ? 'success'
                          : variant.approvalState === 'INVALIDATED'
                            ? 'critical'
                            : variant.approvalState === 'PENDING'
                              ? 'attention'
                              : undefined
                      }
                    >
                      {variant.approvalState}
                    </Badge>
                    <Badge>{`rev ${variant.revision}`}</Badge>
                    {variant.generation?.mock === true ? (
                      <Badge tone="attention">mock copy</Badge>
                    ) : null}
                  </InlineStack>
                </InlineStack>

                {data.canEdit ? (
                  <Form method="post">
                    <input type="hidden" name="intent" value="edit" />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <BlockStack gap="200">
                      <TextField
                        label="Copy"
                        name="primaryCopy"
                        multiline={6}
                        autoComplete="off"
                        value={variant.primaryCopy}
                        helpText={`Hash ${variant.hashPrefix ?? 'none'}. Editing this withdraws any approval — the database does that, not this screen.`}
                      />
                      <InlineStack gap="200">
                        <Button submit loading={navigation.state === 'submitting'}>
                          Save and re-check
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Form>
                ) : (
                  <Text as="p">{variant.primaryCopy}</Text>
                )}

                <Text as="p" tone="subdued">
                  {variant.hashtags.join(' ')}
                  {variant.altText ? ` · alt: ${variant.altText}` : ''}
                </Text>

                <Divider />

                <Text as="h3" variant="headingSm">
                  Compliance
                </Text>
                {variant.checks.filter((check) => check.outcome === 'FAIL').length === 0 ? (
                  <Text as="p" tone="subdued">
                    {variant.checks.length} rules ran, none failed. That is not an approval.
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text']}
                    headings={['Rule', 'Severity', 'Evidence', 'Suggested correction']}
                    rows={variant.checks
                      .filter((check) => check.outcome === 'FAIL')
                      .map((check) => [
                        check.ruleId,
                        <Badge
                          key={`${variant.id}-${check.ruleId}`}
                          tone={SEVERITY_TONE[check.severity]}
                        >
                          {check.severity}
                        </Badge>,
                        (check.evidence ?? [])
                          .map((evidence) => `${evidence.field}: “${evidence.match}”`)
                          .join('; ') || '—',
                        check.suggestion,
                      ])}
                  />
                )}

                {variant.quality ? (
                  <>
                    <Text as="h3" variant="headingSm">
                      Quality — {variant.quality.overall}/100 across the measurable dimensions
                    </Text>
                    <DataTable
                      columnContentTypes={['text', 'numeric', 'text']}
                      headings={['Dimension', 'Score', 'Why']}
                      rows={variant.quality.dimensions.map((dimension) => [
                        dimension.dimension,
                        dimension.measurable ? String(dimension.score) : 'withheld',
                        dimension.reason,
                      ])}
                    />
                    <Text as="p" tone="subdued">
                      {variant.quality.caveat}
                    </Text>
                  </>
                ) : null}

                <Divider />

                <InlineStack gap="300" blockAlign="center">
                  {variant.approvals.length === 0 && data.canEdit ? (
                    <Form method="post">
                      <input type="hidden" name="intent" value="submit" />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <Button submit variant="primary">
                        Submit for approval
                      </Button>
                    </Form>
                  ) : null}
                  <Form method="post">
                    <input type="hidden" name="intent" value="recheck" />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <Button submit>Re-run checks</Button>
                  </Form>
                </InlineStack>

                {variant.approvals.map((approval) => (
                  <BlockStack gap="200" key={approval.id}>
                    <Text as="p">
                      Approval {approval.outcome.toLowerCase()} — {approval.keys.length} of{' '}
                      {approval.requiredKeys} key(s):{' '}
                      {approval.keys.map((key) => key.role).join(', ') || 'none signed'}
                    </Text>
                    {approval.outcome === 'PENDING' && data.canApprove ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="sign" />
                        <input type="hidden" name="approvalId" value={approval.id} />
                        <InlineStack gap="200">
                          <TextField label="Note" name="note" labelHidden autoComplete="off" />
                          <Button submit variant="primary">
                            Sign a key
                          </Button>
                        </InlineStack>
                      </Form>
                    ) : null}
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        ))}

        <Layout.Section>
          <Banner tone="info" title="What these checks are">
            <p>{data.disclaimer}</p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
