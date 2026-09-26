import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import type { Platform } from '@spirithaus/domain';
import { PLATFORMS } from '@spirithaus/domain';
import { OCCASION_PRESETS } from '@spirithaus/content';
import { requireSection } from '../lib/principal.server.js';
import { createCampaign } from '../lib/campaign.server.js';
import { buildFactSheetFor } from '../lib/research.server.js';

const OBJECTIVES = [
  'PRODUCT_AWARENESS',
  'LAUNCH',
  'SALES_CONVERSION',
  'COLLECTION_PROMOTION',
  'LIMITED_TIME_OFFER',
  'BACK_IN_STOCK',
  'CLEARANCE',
  'PREMIUM_STORYTELLING',
  'GIFTING',
  'COCKTAIL_INSPIRATION',
  'FOOD_PAIRING',
  'EDUCATION',
  'ENGAGEMENT',
  'ORGANIC_GROWTH',
  'RETARGETING',
  'SEASONAL',
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop } = await requireSection(request, 'campaign:create');

  const products = await prisma.shopifyProduct.findMany({
    where: { shopId: shop.id, status: 'ACTIVE' },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, productType: true },
    take: 250,
  });

  // Passed through the loader rather than imported by the component: a shared package
  // reaching the browser bundle is how the domain barrel dragged node:crypto into it.
  return { products, occasions: OCCASION_PRESETS, platforms: [...PLATFORMS] };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'campaign:create');
  const form = await request.formData();

  const productIds = form.getAll('productIds').map(String).filter(Boolean);
  const platforms = form.getAll('platforms').map(String).filter(Boolean) as Platform[];
  const name = String(form.get('name') ?? '').trim();

  if (name.length === 0) return { error: 'Give the campaign a name.' };
  if (productIds.length === 0) return { error: 'Choose at least one product.' };
  if (platforms.length === 0) return { error: 'Choose at least one platform.' };

  // Shown before generation, because a campaign built with nothing approved can only
  // restate Shopify data, and the author should know that before they read the copy.
  const factSheet = await buildFactSheetFor(shop.id, productIds);

  const result = await createCampaign({
    shopId: shop.id,
    actor: principal,
    name,
    objective: String(form.get('objective') ?? 'PRODUCT_AWARENESS'),
    productIds,
    platforms,
    occasion: (form.get('occasion') as string) || null,
    offerTerms: (form.get('offerTerms') as string) || null,
  });

  if (!result.ok) return { error: result.error, approvedFacts: factSheet.facts.length };
  return redirect(`/app/campaigns/${result.campaignId}`);
}

export default function Create() {
  const { products, occasions, platforms: available } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [objective, setObjective] = useState('PRODUCT_AWARENESS');
  const [occasion, setOccasion] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(available);

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <Page title="Create" subtitle="One strategy, six independently derived platform variants.">
      <Layout>
        {result && 'error' in result && result.error ? (
          <Layout.Section>
            <Banner tone="critical" title="Nothing was created">
              <p>{result.error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <Form method="post">
              <FormLayout>
                <TextField label="Campaign name" name="name" autoComplete="off" />
                <FormLayout.Group>
                  <Select
                    label="Objective"
                    name="objective"
                    value={objective}
                    onChange={setObjective}
                    options={OBJECTIVES.map((value) => ({
                      label: value.toLowerCase().replace(/_/g, ' '),
                      value,
                    }))}
                  />
                  <Select
                    label="Occasion (optional)"
                    name="occasion"
                    value={occasion}
                    onChange={setOccasion}
                    options={[
                      { label: 'No occasion', value: '' },
                      ...occasions.map((preset) => ({
                        label: `${preset.label} — ${preset.window}`,
                        value: preset.key,
                      })),
                    ]}
                    helpText={
                      occasions.find((preset) => preset.key === occasion)?.note ??
                      'Australian presets, editable. Some carry a raised risk of excess framing.'
                    }
                  />
                </FormLayout.Group>

                <TextField
                  label="Offer terms (required if the copy claims a saving)"
                  name="offerTerms"
                  multiline={2}
                  autoComplete="off"
                  helpText="What the discount applies to, the period, and any exclusions. An unqualified saving claim is blocked."
                />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Products
                  </Text>
                  {products.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No active products in the mirror. Run a sync from Products first.
                    </Text>
                  ) : (
                    products
                      .slice(0, 40)
                      .map((product) => (
                        <Checkbox
                          key={product.id}
                          label={`${product.title}${product.productType ? ` — ${product.productType}` : ''}`}
                          checked={selected.includes(product.id)}
                          onChange={() => toggle(selected, product.id, setSelected)}
                        />
                      ))
                  )}
                  {selected.map((id) => (
                    <input key={id} type="hidden" name="productIds" value={id} />
                  ))}
                </BlockStack>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Platforms
                  </Text>
                  {available.map((platform) => (
                    <Checkbox
                      key={platform}
                      label={platform}
                      checked={platforms.includes(platform)}
                      onChange={() => toggle(platforms, platform, setPlatforms)}
                    />
                  ))}
                  {platforms.map((platform) => (
                    <input key={platform} type="hidden" name="platforms" value={platform} />
                  ))}
                </BlockStack>

                <Button submit variant="primary" loading={navigation.state === 'submitting'}>
                  Build the campaign
                </Button>
                <Text as="p" tone="subdued">
                  Generation uses only approved research claims and Shopify product data. With no
                  claims approved, the copy can restate nothing beyond title, type, vendor, price
                  and availability — and the compliance engine blocks any figure that is not in the
                  fact sheet.
                </Text>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
