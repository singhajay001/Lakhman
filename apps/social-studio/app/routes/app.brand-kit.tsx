import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  FormLayout,
  Layout,
  List,
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
import { requirePermission, type BrandKitContent } from '@spirithaus/domain';
import { requireSection } from '../lib/principal.server.js';
import { ensureBrandKit, publishBrandKitVersion, readinessFor } from '../lib/brand-kit.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'brand:read');

  const seeded = await ensureBrandKit(shop.id, principal);
  if ('error' in seeded) {
    return { error: seeded.error, kit: null, canEdit: false, history: [] };
  }

  const history = await prisma.brandKitVersion.findMany({
    where: { shopId: shop.id },
    orderBy: { version: 'desc' },
    take: 20,
    include: {},
  });

  const content = seeded.version.content as unknown as BrandKitContent;
  return {
    error: null,
    canEdit: principal.roles.some((role) => ['administrator', 'campaign_manager'].includes(role)),
    kit: {
      version: seeded.version.version,
      seededFrom: seeded.seededFrom,
      placeholders: seeded.version.placeholders,
      readiness: readinessFor(seeded.version),
      content,
    },
    history: history.map((version) => ({
      version: version.version,
      publishedAt: version.publishedAt.toISOString(),
      note: version.note,
      outstanding: version.placeholders.length,
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'brand:read');
  requirePermission(principal, 'brand:publish');

  const form = await request.formData();
  const line = String(form.get('responsibleConsumptionLine') ?? '').trim();
  const licence = String(form.get('licenceNumber') ?? '').trim();
  const premises = String(form.get('licensedPremises') ?? '').trim();
  const variations = String(form.get('approvedBrandVariations') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const current = await prisma.brandKitVersion.findFirstOrThrow({
    where: { shopId: shop.id },
    orderBy: { version: 'desc' },
  });
  const content = current.content as unknown as BrandKitContent;

  const result = await publishBrandKitVersion({
    shopId: shop.id,
    actor: principal,
    note: 'Placeholders confirmed by an administrator.',
    changes: {
      responsibleConsumptionLine: line.length > 0 ? line : content.responsibleConsumptionLine,
      approvedBrandVariations: variations,
      business: {
        ...content.business,
        licenceNumber: licence.length > 0 ? licence : content.business.licenceNumber,
        licensedPremises: premises.length > 0 ? premises : content.business.licensedPremises,
      },
    },
  });

  return 'error' in result
    ? { error: result.error }
    : { message: `Published version ${result.version.version}.` };
}

export default function BrandKit() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  if (data.error || !data.kit) {
    return (
      <Page title="Brand Kit">
        <Banner tone="critical" title="The Brand Kit could not be seeded from the theme">
          <p>{data.error}</p>
          <p>
            It is seeded from the generated theme profile rather than typed in, so that the
            storefront and the social output are provably one brand. Nothing is invented in its
            place.
          </p>
        </Banner>
      </Page>
    );
  }

  const { kit } = data;

  return (
    <Page title="Brand Kit" subtitle={`Version ${kit.version} · derived from ${kit.seededFrom}`}>
      <Layout>
        {result && 'error' in result && result.error ? (
          <Layout.Section>
            <Banner tone="critical">
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

        {!kit.readiness.usable ? (
          <Layout.Section>
            <Banner tone="warning" title="This kit is not usable yet">
              <p>
                Waiting on: {kit.readiness.blocking.join(', ')}. Section 14 forbids inventing brand
                details, so these are seeded as placeholders rather than guessed — and the
                responsible-consumption compliance check cannot pass until the line is confirmed.
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Derived from the live theme
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Colour', 'Hex', 'Use']}
                rows={kit.content.colours.map((colour) => [colour.name, colour.hex, colour.use])}
              />
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Role', 'Family', 'Weights']}
                rows={kit.content.typography.map((face) => [
                  face.role,
                  face.family,
                  face.weights.join(', '),
                ])}
              />
              <Text as="p" tone="subdued">
                Theme {kit.content.derivedFrom.shop ?? 'unknown'}, last updated{' '}
                {kit.content.derivedFrom.themeUpdatedAt ?? 'unknown'}. Regenerate the theme profile
                when the theme changes; this kit does not follow it automatically.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Rules that bind generation
              </Text>
              <Text as="h3" variant="headingSm">
                Product presentation
              </Text>
              <List>
                {kit.content.productPresentationRules.map((rule) => (
                  <List.Item key={rule}>{rule}</List.Item>
                ))}
              </List>
              <Text as="h3" variant="headingSm">
                Prohibited phrases
              </Text>
              <List>
                {kit.content.prohibitedPhrases.map((phrase) => (
                  <List.Item key={phrase}>&ldquo;{phrase}&rdquo;</List.Item>
                ))}
              </List>
              <Text as="p" tone="subdued">
                &ldquo;Drink responsibly&rdquo; is on that list deliberately: it is the phrase every
                regulator has seen used as a fig leaf. The real line has to be written and
                confirmed.
              </Text>
              <Text as="h3" variant="headingSm">
                Approved brand variations
              </Text>
              <Text as="p">
                {kit.content.approvedBrandVariations.length === 0
                  ? 'None. SPIRITHAUS only — a separated spelling belongs to a different business.'
                  : kit.content.approvedBrandVariations.join(', ')}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {data.canEdit ? (
          <Layout.Section>
            <Card>
              <Form method="post">
                <FormLayout>
                  <Text as="h2" variant="headingMd">
                    Confirm the placeholders
                  </Text>
                  <Text as="p" tone="subdued">
                    Publishing writes a new version. Nothing edits a published one, so every asset
                    can name the kit it was made under.
                  </Text>
                  <TextField
                    label="Responsible-consumption line"
                    name="responsibleConsumptionLine"
                    autoComplete="off"
                    value={kit.content.responsibleConsumptionLine ?? undefined}
                    helpText="The exact wording campaigns will carry. A compliance decision, not a copy one."
                  />
                  <FormLayout.Group>
                    <TextField
                      label="Liquor licence number"
                      name="licenceNumber"
                      autoComplete="off"
                      value={kit.content.business.licenceNumber ?? undefined}
                    />
                    <TextField
                      label="Licensed premises"
                      name="licensedPremises"
                      autoComplete="off"
                      value={kit.content.business.licensedPremises ?? undefined}
                      helpText="The storefront policy pages and the Shopify account currently name different suburbs."
                    />
                  </FormLayout.Group>
                  <TextField
                    label="Approved brand variations"
                    name="approvedBrandVariations"
                    autoComplete="off"
                    helpText="Comma separated. Leave empty unless a variation is genuinely wanted."
                  />
                  <Button submit variant="primary">
                    Publish the next version
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Version history
              </Text>
              <DataTable
                columnContentTypes={['numeric', 'text', 'numeric', 'text']}
                headings={['Version', 'Published', 'Outstanding placeholders', 'Note']}
                rows={data.history.map((version) => [
                  String(version.version),
                  version.publishedAt,
                  <Badge
                    key={version.version}
                    tone={version.outstanding === 0 ? 'success' : 'attention'}
                  >
                    {String(version.outstanding)}
                  </Badge>,
                  version.note ?? '',
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
