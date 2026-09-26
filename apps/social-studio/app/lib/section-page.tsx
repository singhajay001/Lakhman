import { BlockStack, Card, EmptyState, Layout, Page, Text } from '@shopify/polaris';
import type { Section } from './sections.js';

/**
 * The honest placeholder. A section that is not built yet says which phase builds it
 * and what it will do, rather than showing an empty table that looks like a bug or a
 * button that does nothing (section 43).
 */
export function NotBuiltYet({ section }: { section: Section }) {
  return (
    <Page title={section.label}>
      <Layout>
        <Layout.Section>
          <Card>
            <EmptyState heading={`${section.label} is built in Phase ${section.phase}`} image="">
              <BlockStack gap="300">
                <Text as="p">{section.summary}</Text>
                <Text as="p" tone="subdued">
                  Nothing here is a stub of a working feature — this screen has no hidden
                  functionality, and the phase plan in docs/social-studio/10-delivery-plan.md says
                  what its exit gate will be.
                </Text>
              </BlockStack>
            </EmptyState>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
