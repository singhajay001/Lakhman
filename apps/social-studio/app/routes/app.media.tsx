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
  Page,
  Text,
} from '@shopify/polaris';
import {
  Form,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { prisma } from '@spirithaus/db';
import { formatInZone, requirePermission } from '@spirithaus/domain';
import { PLATFORM_PROFILE_VERSION } from '@spirithaus/media-geometry';
import { CALIBRATION_NOTE } from '@spirithaus/protected-assets';
import { readSelections } from '@spirithaus/providers';
import { requireSection } from '../lib/principal.server.js';
import { cancelRender, queueComposite, queueRender } from '@spirithaus/media-pipeline';

export async function loader({ request }: LoaderFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'media:read');

  const [assets, composites, renders] = await Promise.all([
    prisma.protectedProductAsset.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { masks: true, licence: true, product: { select: { title: true } } },
    }),
    prisma.mediaAsset.findMany({
      where: { shopId: shop.id, kind: 'COMPOSITE_STILL' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.renderJob.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ]);

  const selections = readSelections();
  const imageEdit = selections.find((s) => s.contract === 'ImageEditingProvider');
  const voice = selections.find((s) => s.contract === 'VoiceProvider');

  return {
    canGenerate: principal.roles.some((role) => ['creator', 'campaign_manager'].includes(role)),
    profileVersion: PLATFORM_PROFILE_VERSION,
    calibration: CALIBRATION_NOTE,
    providers: {
      imageEditConfigured: imageEdit?.configured ?? false,
      voiceConfigured: voice?.configured ?? false,
    },
    assets: assets.map((asset) => {
      const truth = asset.groundTruth as { labelText?: string } | null;
      return {
        id: asset.id,
        product: asset.product?.title ?? 'unlinked',
        status: asset.status,
        dimensions: `${asset.widthPx}×${asset.heightPx}`,
        digest: asset.masterDigest.slice(0, 12),
        masks: asset.masks.map(
          (mask) => `${mask.kind.toLowerCase()} v${mask.version} (+${mask.dilatePx}px)`,
        ),
        licence: `${asset.licence.kind.toLowerCase()} · ${asset.licence.holder}`,
        // Where the bytes came from. A storefront read is never shown as an Admin read.
        source: asset.sourceKind,
        // Reasons a person has to look before this artwork is staged. Shown rather than
        // counted, because "3 issues" is not something anybody can act on.
        reviewReasons: asset.reviewReasons,
        // Missing when OCR could not read the label; that asset waits for someone to draw a
        // region, and saying so is more use than an empty cell.
        labelText: truth?.labelText ?? null,
        needsLabelRegion: !asset.masks.some((mask) => mask.kind === 'LABEL'),
        createdAt: formatInZone(asset.createdAt, shop.timezone),
      };
    }),
    composites: composites.map((media) => {
      const report = media.verificationReport as {
        checks: { check: string; outcome: string; detail: string }[];
      } | null;
      const geometry = media.geometry as {
        verdict: string;
        worstViewport: string;
        viewports: { viewport: string; verdict: string }[];
      } | null;
      return {
        id: media.id,
        key: media.objectKey,
        dimensions: `${media.widthPx}×${media.heightPx}`,
        verification: media.verification,
        failedChecks: (report?.checks ?? []).filter((check) => check.outcome === 'FAIL'),
        unavailableChecks: (report?.checks ?? []).filter(
          (check) => check.outcome === 'UNAVAILABLE',
        ),
        geometryVerdict: geometry?.verdict ?? null,
        worstViewport: geometry?.worstViewport ?? null,
        viewports: geometry?.viewports ?? [],
      };
    }),
    renders: renders.map((job) => ({
      id: job.id,
      kind: job.kind,
      composition: job.compositionId,
      state: job.state,
      progress: job.progress,
      renderMs: job.renderMs,
      error: job.error,
      createdAt: formatInZone(job.createdAt, shop.timezone),
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { shop, principal } = await requireSection(request, 'media:read');
  const form = await request.formData();
  const intent = String(form.get('intent'));

  if (intent === 'cancel') {
    requirePermission(principal, 'media:generate');
    const cancelled = await cancelRender(shop.id, String(form.get('renderJobId')));
    return cancelled
      ? { message: 'Cancelled. The worker stops at its next progress check.' }
      : { error: 'That render has already finished, so there is nothing to cancel.' };
  }

  if (intent === 'composite') {
    requirePermission(principal, 'media:generate');
    // Enqueued, never run here. Compositing decodes a master, builds masks and reads the label
    // twice with OCR; a loader holding a response open for that is a gateway timeout waiting to
    // happen (ADR 0012). The request returns a job id and ends.
    const result = await queueComposite({
      shopId: shop.id,
      actor: principal,
      assetId: String(form.get('assetId')),
      platform: String(form.get('platform')) as never,
      format: String(form.get('format')) as never,
    });
    if (!result.ok) return { error: result.error };
    return {
      message: result.queued
        ? 'Queued. The worker composites it and the four checks run there; this page shows the job below.'
        : 'Already queued: the same asset, platform, format and environment is idempotent, so nothing was composited twice.',
    };
  }

  if (intent === 'render') {
    requirePermission(principal, 'media:generate');
    const result = await queueRender({
      shopId: shop.id,
      actor: principal,
      compositionId: String(form.get('compositionId')),
      props: JSON.parse(String(form.get('props') ?? '{}')) as Record<string, unknown>,
    });
    if (!result.ok) return { error: result.error };
    return {
      message: result.queued
        ? 'Queued.'
        : 'Already queued: the same composition with the same props is idempotent, so nothing was rendered twice.',
    };
  }

  return { error: 'Unknown action.' };
}

const VERIFICATION_TONE: Record<string, 'success' | 'critical' | 'attention' | undefined> = {
  PASSED: 'success',
  FAILED: 'critical',
  INCOMPLETE: 'attention',
  PENDING: undefined,
  NOT_APPLICABLE: undefined,
};

export default function MediaStudio() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  return (
    <Page
      title="Media Studio"
      subtitle="The bottle is photographed. Only the room around it is generated."
    >
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

        {!data.providers.imageEditConfigured ? (
          <Layout.Section>
            <Banner tone="info" title="No image provider is configured">
              <p>
                Environment generation needs a provider that honours a mask — the pipeline hands it
                the inverse of a dilated product mask so it cannot paint within a few pixels of the
                bottle. Without one, a composite can still be built from an environment supplied by
                hand, and the four protection checks run either way.
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Protected product assets
              </Text>
              {data.assets.length === 0 ? (
                <EmptyState heading="No protected assets yet" image="">
                  <BlockStack gap="200">
                    <Text as="p">
                      A master arrives with a licence record and a product mask from its alpha. No
                      licence, no ingestion.
                    </Text>
                    <Text as="p" tone="subdued">
                      Run <code>pnpm sync:shopify-assets</code> to ingest real packshots from the
                      Shopify catalogue, or upload a master and draw its label region here.
                    </Text>
                  </BlockStack>
                </EmptyState>
              ) : (
                <BlockStack gap="300">
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                    headings={['Product', 'Status', 'Master', 'Digest', 'Masks', 'Source']}
                    rows={data.assets.map((asset) => [
                      asset.product,
                      <Badge
                        key={asset.id}
                        tone={
                          asset.status === 'APPROVED'
                            ? 'success'
                            : asset.reviewReasons.length > 0
                              ? 'attention'
                              : undefined
                        }
                      >
                        {asset.reviewReasons.length > 0 ? 'needs review' : asset.status}
                      </Badge>,
                      asset.dimensions,
                      asset.digest,
                      asset.masks.join(', '),
                      asset.source ?? asset.licence,
                    ])}
                  />

                  {data.assets.some(
                    (asset) => asset.reviewReasons.length > 0 || asset.needsLabelRegion,
                  ) ? (
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">
                          Waiting on a person
                        </Text>
                        <Text as="p" tone="subdued">
                          These masters are held, digested and masked to their silhouette. They are
                          not staged, because something about them could not be settled
                          automatically.
                        </Text>
                        {data.assets
                          .filter(
                            (asset) => asset.reviewReasons.length > 0 || asset.needsLabelRegion,
                          )
                          .map((asset) => (
                            <BlockStack gap="100" key={`review-${asset.id}`}>
                              <Text as="p" fontWeight="semibold">
                                {asset.product === 'unlinked'
                                  ? (asset.labelText ?? asset.digest)
                                  : asset.product}
                              </Text>
                              {asset.needsLabelRegion ? (
                                <Text as="p" tone="subdued">
                                  No label region: nothing to measure a colour against or read text
                                  in. Draw one to make this asset stageable.
                                </Text>
                              ) : null}
                              {asset.reviewReasons.map((reason) => (
                                <Text as="p" tone="subdued" key={reason}>
                                  {reason}
                                </Text>
                              ))}
                            </BlockStack>
                          ))}
                      </BlockStack>
                    </Card>
                  ) : null}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Composites, and what the four checks found
              </Text>
              {data.composites.length === 0 ? (
                <Text as="p" tone="subdued">
                  Nothing composited yet.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {data.composites.map((media) => (
                    <Card key={media.id}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="h3" variant="headingSm">
                            {media.key}
                          </Text>
                          <InlineStack gap="200">
                            <Badge tone={VERIFICATION_TONE[media.verification]}>
                              {media.verification}
                            </Badge>
                            {media.geometryVerdict ? (
                              <Badge
                                tone={
                                  media.geometryVerdict === 'pass'
                                    ? 'success'
                                    : media.geometryVerdict === 'warn'
                                      ? 'attention'
                                      : 'critical'
                                }
                              >
                                {`geometry ${media.geometryVerdict}`}
                              </Badge>
                            ) : null}
                          </InlineStack>
                        </InlineStack>

                        {media.failedChecks.length > 0 ? (
                          <DataTable
                            columnContentTypes={['text', 'text']}
                            headings={['Failed check', 'What it found']}
                            rows={media.failedChecks.map((check) => [check.check, check.detail])}
                          />
                        ) : (
                          <Text as="p" tone="subdued">
                            All four protection checks passed. That is not an approval.
                          </Text>
                        )}

                        {media.unavailableChecks.length > 0 ? (
                          <Banner tone="warning" title="A check could not run">
                            {media.unavailableChecks.map((check) => (
                              <p key={check.check}>{check.detail}</p>
                            ))}
                          </Banner>
                        ) : null}

                        {media.viewports.length > 0 ? (
                          <Text as="p" tone="subdued">
                            Measured per viewport:{' '}
                            {media.viewports.map((v) => `${v.viewport} ${v.verdict}`).join(' · ')}
                            {media.worstViewport
                              ? `. Verdict is the worst of them: ${media.worstViewport}.`
                              : ''}
                          </Text>
                        ) : null}
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>
              )}
              <Text as="p" tone="subdued">
                {data.calibration}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Render queue
              </Text>
              {data.renders.length === 0 ? (
                <Text as="p" tone="subdued">
                  No renders queued. A render is a durable background job: it survives a worker
                  restart, reports progress, and can be cancelled while it runs.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'text', 'text']}
                  headings={['Composition', 'State', 'Progress', 'Time', '']}
                  rows={data.renders.map((job) => [
                    job.composition,
                    <Badge
                      key={job.id}
                      tone={
                        job.state === 'SUCCEEDED'
                          ? 'success'
                          : job.state === 'FAILED'
                            ? 'critical'
                            : job.state === 'RUNNING'
                              ? 'attention'
                              : undefined
                      }
                    >
                      {job.state}
                    </Badge>,
                    `${job.progress}%`,
                    job.renderMs ? `${(job.renderMs / 1000).toFixed(1)}s` : job.createdAt,
                    data.canGenerate && (job.state === 'QUEUED' || job.state === 'RUNNING') ? (
                      <Form method="post" key={`${job.id}-cancel`}>
                        <input type="hidden" name="intent" value="cancel" />
                        <input type="hidden" name="renderJobId" value={job.id} />
                        <Button submit size="slim">
                          Cancel
                        </Button>
                      </Form>
                    ) : (
                      (job.error ?? '')
                    ),
                  ])}
                />
              )}
              <Text as="p" tone="subdued">
                Platform geometry profile {data.profileVersion}. Every inset and safe zone in it is
                unverified, for the same reason as every other platform figure in this build.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
