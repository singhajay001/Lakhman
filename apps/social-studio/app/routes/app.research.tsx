import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import { requirePermission } from '@spirithaus/domain';
import { readSelections } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';
import { addClaim, decideClaim } from '../lib/research.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'research:read');

  const [products, claims] = await Promise.all([
    prisma.shopifyProduct.findMany({
      where: { shopId: shop.id, status: 'ACTIVE' },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
      take: 250,
    }),
    prisma.researchClaim.findMany({
      where: { shopId: shop.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        source: true,
        research: { include: { product: { select: { title: true } } } },
      },
      take: 300,
    }),
  ]);

  const research = readSelections().find((s) => s.contract === 'ResearchProvider');

  return {
    products,
    canCreate: principal.roles.some((role) => ['creator', 'campaign_manager'].includes(role)),
    canApprove: principal.roles.some((role) =>
      ['campaign_manager', 'compliance_reviewer'].includes(role),
    ),
    researchProviderConfigured: research?.configured ?? false,
    claims: claims.map((claim) => ({
      id: claim.id,
      product: claim.research.product.title,
      field: claim.field,
      value: claim.value,
      kind: claim.kind,
      status: claim.status,
      confidence: Number(claim.confidence).toFixed(2),
      source: claim.source?.url ?? '—',
      authority: claim.source?.authority ?? 'unknown',
      rejectionReason: claim.rejectionReason,
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'research:read');
  const form = await request.formData();
  const intent = String(form.get('intent'));

  if (intent === 'add') {
    requirePermission(principal, 'research:create');
    const result = await addClaim({
      shopId: shop.id,
      actor: principal,
      productId: String(form.get('productId')),
      field: String(form.get('field')),
      value: String(form.get('value')),
      kind: String(form.get('kind')) === 'INFERRED' ? 'INFERRED' : 'VERIFIED',
      confidence: Number(form.get('confidence') ?? 0.8),
      sourceUrl: String(form.get('sourceUrl')),
      publisher: (form.get('publisher') as string) || null,
      excerpt: (form.get('excerpt') as string) || null,
    });
    return result.ok ? { message: 'Claim recorded, pending review.' } : { error: result.error };
  }

  if (intent === 'approve' || intent === 'reject') {
    requirePermission(principal, 'research:approve');
    const result = await decideClaim({
      shopId: shop.id,
      claimId: String(form.get('claimId')),
      decision: intent === 'approve' ? 'APPROVED' : 'REJECTED',
      reason: (form.get('reason') as string) || undefined,
      actor: principal,
    });
    return result.ok
      ? { message: `Claim ${intent === 'approve' ? 'approved' : 'rejected'}.` }
      : { error: result.error };
  }

  return { error: 'Unknown action.' };
}

const STATUS_TONE: Record<string, 'success' | 'attention' | 'critical' | undefined> = {
  APPROVED: 'success',
  PENDING: 'attention',
  CONFLICTED: 'critical',
  REJECTED: undefined,
};

export default function Research() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [kind, setKind] = useState('VERIFIED');
  const [productId, setProductId] = useState(data.products[0]?.id ?? '');

  return (
    <Page title="Research Library" subtitle="Only an approved claim may appear in campaign copy.">
      <Layout>
        {result && 'error' in result && result.error ? (
          <Layout.Section>
            <Banner tone="critical" title="That was refused">
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

        {!data.researchProviderConfigured ? (
          <Layout.Section>
            <Banner tone="info" title="No research provider is configured">
              <p>
                Automated sourcing needs a search provider and a page fetcher, and neither is
                enabled. Claims are entered by hand below — the shape is identical either way: a
                claim always carries a source, a retrieval time and a confidence, and always arrives
                pending.
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

        {data.canCreate ? (
          <Layout.Section>
            <Card>
              <Form method="post">
                <input type="hidden" name="intent" value="add" />
                <FormLayout>
                  <Text as="h2" variant="headingMd">
                    Record a claim
                  </Text>
                  <FormLayout.Group>
                    <Select
                      label="Product"
                      name="productId"
                      value={productId}
                      onChange={setProductId}
                      options={data.products.map((product) => ({
                        label: product.title,
                        value: product.id,
                      }))}
                    />
                    <TextField
                      label="Attribute"
                      name="field"
                      autoComplete="off"
                      helpText="abv, region, age_statement, award, rating, vintage, tasting_note_palate…"
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Value" name="value" autoComplete="off" />
                    <Select
                      label="Kind"
                      name="kind"
                      value={kind}
                      onChange={setKind}
                      options={[
                        { label: 'Verified — stated by the source', value: 'VERIFIED' },
                        { label: 'Inference — read between the lines', value: 'INFERRED' },
                      ]}
                    />
                    <TextField
                      label="Confidence"
                      name="confidence"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      autoComplete="off"
                      helpText="Reported, never used to approve anything automatically."
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Source URL"
                      name="sourceUrl"
                      autoComplete="off"
                      helpText="A primary source is preferred: the producer, the distributor, a technical sheet."
                    />
                    <TextField label="Publisher" name="publisher" autoComplete="off" />
                  </FormLayout.Group>
                  <TextField
                    label="Extracted excerpt"
                    name="excerpt"
                    multiline={2}
                    autoComplete="off"
                  />
                  <Button submit loading={navigation.state === 'submitting'}>
                    Record, pending review
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            {data.claims.length === 0 ? (
              <EmptyState heading="No claims recorded yet" image="">
                <Text as="p">
                  A campaign built now can state only what Shopify already knows — title, type,
                  vendor, price and availability.
                </Text>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Product', 'Attribute', 'Value', 'Kind', 'Source', 'Status', '']}
                  rows={data.claims.map((claim) => [
                    claim.product,
                    claim.field,
                    claim.value,
                    `${claim.kind === 'INFERRED' ? 'inference' : 'verified'} ${claim.confidence}`,
                    `${claim.authority} · ${claim.source.replace(/^https?:\/\//, '').slice(0, 40)}`,
                    <Badge key={`${claim.id}-status`} tone={STATUS_TONE[claim.status]}>
                      {claim.status}
                    </Badge>,
                    data.canApprove &&
                    (claim.status === 'PENDING' || claim.status === 'CONFLICTED') ? (
                      <InlineStack gap="200" key={`${claim.id}-actions`}>
                        <Form method="post">
                          <input type="hidden" name="intent" value="approve" />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <Button submit size="slim" variant="primary">
                            Approve
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="intent" value="reject" />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <Button submit size="slim">
                            Reject
                          </Button>
                        </Form>
                      </InlineStack>
                    ) : (
                      (claim.rejectionReason ?? '')
                    ),
                  ])}
                />
                <Text as="p" tone="subdued">
                  A conflicted claim cannot be approved while the disagreement stands. Reject the
                  one that is wrong first — the system will not pick for you.
                </Text>
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
