import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import {
  Form,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import { requirePermission } from '@spirithaus/domain';
import { assessPromotability } from '@spirithaus/shopify';
import { requireSection } from '../lib/principal.server.js';
import { enqueueSync } from '../lib/sync.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'products:read');

  const products = await prisma.shopifyProduct.findMany({
    where: { shopId: shop.id },
    orderBy: { title: 'asc' },
    take: 250,
    include: { variants: { orderBy: { position: 'asc' } } },
  });

  return {
    canSync: principal.roles.some(
      (role) => role === 'administrator' || role === 'campaign_manager',
    ),
    currency: shop.currency,
    products: products.map((product) => {
      const promotability = assessPromotability({
        status: product.status,
        onlineStoreUrl: product.onlineStoreUrl,
        variants: product.variants.map((variant) => ({
          availableForSale: variant.availableForSale,
          inventoryQuantity: variant.inventoryQuantity,
        })),
      });
      const cheapest = product.variants[0];
      return {
        id: product.id,
        title: product.title,
        status: product.status,
        vendor: product.vendor,
        price: cheapest ? cheapest.price.toString() : null,
        unitCost: cheapest?.unitCost ? cheapest.unitCost.toString() : null,
        stock: product.variants.reduce((total, variant) => total + variant.inventoryQuantity, 0),
        promotable: promotability.promotable,
        reasons: promotability.promotable ? [] : promotability.reasons,
      };
    }),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'products:read');
  requirePermission(principal, 'products:sync');

  const result = await enqueueSync({
    shopId: shop.id,
    shopDomain: shop.domain,
    kind: 'FULL',
    trigger: 'manual',
    actorUserId: principal.userId,
  });

  return result;
}

export default function Products() {
  const { products, canSync, currency } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const rows = products.map((product) => [
    product.title,
    product.vendor ?? '—',
    product.status,
    product.price ? `${currency} ${product.price}` : '—',
    // COGS drives contribution margin, and its absence is shown rather than assumed.
    product.unitCost ? `${currency} ${product.unitCost}` : 'not set',
    String(product.stock),
    product.promotable ? (
      <Badge tone="success" key={product.id}>
        Promotable
      </Badge>
    ) : (
      <Badge tone="attention" key={product.id}>
        {product.reasons[0] ?? 'blocked'}
      </Badge>
    ),
  ]);

  return (
    <Page
      title="Products"
      subtitle="The mirror of the Shopify catalogue, and whether each product may be promoted."
      primaryAction={
        canSync ? (
          <Form method="post">
            <Button submit loading={navigation.state === 'submitting'}>
              Sync now
            </Button>
          </Form>
        ) : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            {products.length === 0 ? (
              <EmptyState heading="Nothing has been synchronised yet" image="">
                <BlockStack gap="200">
                  <Text as="p">
                    Run a sync to mirror products, variants, inventory and unit cost. With a mocked
                    Shopify, the fixture catalogue is used and the screen says so.
                  </Text>
                </BlockStack>
              </EmptyState>
            ) : (
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
                  'Product',
                  'Vendor',
                  'Status',
                  'Price',
                  'Unit cost',
                  'Stock',
                  'Promotable',
                ]}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
