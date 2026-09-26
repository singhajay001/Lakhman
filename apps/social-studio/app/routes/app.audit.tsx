import { BlockStack, Card, DataTable, EmptyState, Layout, Page, Text } from '@shopify/polaris';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { prisma } from '@spirithaus/db';
import { formatInZone } from '@spirithaus/domain';
import { requireSection } from '../lib/principal.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop } = await requireSection(request, 'audit:read');

  const events = await prisma.auditEvent.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { email: true, name: true } } },
  });

  return {
    timezone: shop.timezone,
    events: events.map((event) => ({
      id: event.id,
      at: formatInZone(event.createdAt, shop.timezone),
      action: event.action,
      target: `${event.targetType}${event.targetId ? ` · ${event.targetId.slice(0, 10)}` : ''}`,
      actor: event.actor?.name ?? event.actor?.email ?? 'system',
      after: event.after ? JSON.stringify(event.after) : '',
    })),
  };
}

export default function AuditLog() {
  const { events, timezone } = useLoaderData<typeof loader>();

  return (
    <Page title="Audit Log" subtitle={`Times shown in ${timezone}. Append-only.`}>
      <Layout>
        <Layout.Section>
          <Card>
            {events.length === 0 ? (
              <EmptyState heading="No events recorded yet" image="">
                <Text as="p">
                  Installing the app, assigning a role and running a sync all write here.
                </Text>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['When', 'Action', 'Target', 'Actor', 'Detail']}
                  rows={events.map((event) => [
                    event.at,
                    event.action,
                    event.target,
                    event.actor,
                    event.after,
                  ])}
                />
                <Text as="p" tone="subdued">
                  The database rejects UPDATE and DELETE on this table, so nothing here can be
                  rewritten by a later feature.
                </Text>
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
