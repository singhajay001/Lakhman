# 5 — Providers and cost drivers

§28 requires one provider per overlapping category for the initial release, administrator
enablement, reviewed data-sharing terms and usage budgets. §37 requires an estimated cost
shown before expensive media work.

## No prices in this document, on purpose

Every provider's per-unit price is a number that changes and that I cannot check from here.
Writing "$0.04 per image" into a design document produces a figure that is wrong within
months and that someone will later budget against.

Instead: each provider has a **metered unit**, and the rate for that unit lives in a
`ProviderConfig.rateCard` an administrator fills in at enablement, with the date it was
read and the source URL. `estimateCost()` multiplies measured units by the configured rate.
An unconfigured rate card yields an estimate of *unknown*, which blocks any operation with a
budget ceiling rather than silently costing nothing. That is the honest version of §37.

## Choices

| Contract | Default | Metered unit / cost driver | Why this one |
| --- | --- | --- | --- |
| `TextGenerationProvider` | Anthropic | input + output tokens, per model | Three tiers map cleanly onto the work: the strongest model for campaign strategy, a mid model for the six platform variants, the cheapest for classification and inbox triage. The bulk of spend is platform variants, so variant count × platforms is the driver to watch |
| `ResearchProvider` | Search API + first-party fetcher | queries; fetched bytes | §9 wants primary sources — producer sites, distributor technical sheets. A search API finds them; our own SSRF-guarded fetcher reads them, which keeps extraction and provenance in our code where §9's claim/source/confidence model lives |
| `TrendIntelligenceProvider` | **none configured** | — | Phase 6. Shipping an adapter with no credible permitted data source would be §3's honest-capability rule broken on day one. The adapter exists and reports *no provider configured* |
| `CopyScoringProvider` | first-party explainable scorer | tokens for the LLM-judged dimensions | §13 requires reasons per dimension and §27 requires external scores labelled as provider estimates and compared against actuals. A first-party scorer we can explain beats a vendor number we cannot. Anyword remains an optional second opinion |
| `ImageGenerationProvider` `ImageEditingProvider` | fal.ai — FLUX Fill + depth/edge conditioning | images, by megapixel and step count | The protected-product pipeline needs **mask-conditioned inpainting** and structural conditioning, not text-to-image. That requirement, not model taste, picks the provider. Blocking question 4 |
| `VideoRenderProvider` | Remotion, self-hosted | render-seconds × concurrency | Deterministic, which §16 requires. Remotion Lambda is the scale path and is the same adapter |
| `VideoGenerationProvider` | **off by default** | video-seconds | Generative video cannot be constrained to leave a real label alone across frames. Enabled only for b-roll that contains no product |
| `VoiceProvider` | ElevenLabs, cloning disabled | characters synthesised | §17. Word-level alignment is what drives caption timing, and it is the reason to pick a provider that returns it |
| `AvatarVideoProvider` | **off by default** | video-minutes | §18. One provider chosen after evaluation, Phase 7 at the earliest |
| `ModerationProvider` | advisory only | requests | The ABAC engine is first-party. See [02](02-architecture.md#the-sixteen-provider-contracts) |
| `SocialPublishingProvider` | per-platform official APIs | API calls against each platform's quota | Five adapters + mock. The quota *is* the cost on YouTube |
| `SocialAnalyticsProvider` | per-platform official APIs | API calls; ingestion frequency | §23 requires recorded freshness, coverage and latency per platform because these differ wildly |
| `AttributionProvider` | first-party | — | Shopify Web Pixel plus our own event sink. No vendor sees customer events |
| `EmailMarketingProvider` | Klaviyo adapter, **off** | — | §25 says optional. Built to contract, mocked in tests, disabled |
| `ObjectStorageProvider` | S3-compatible, private | GB-months; egress | MinIO in dev, real bucket in prod. Signed URLs, short TTL, no public objects |

## OCR and similarity are not providers

Label verification (§15) uses Tesseract and `sharp`-computed perceptual hashes locally.
Sending protected product photography to a third-party vision API to ask whether it has
been altered adds a data-sharing relationship and a network dependency to a check that must
run on every composite. Local, deterministic, free, and it can be unit-tested against a
deliberately corrupted label — which §38 requires.

## Budget and cost control

Per §37, budgets at four levels: monthly, per provider, per campaign, per asset. Each has a
soft threshold that warns and a hard ceiling that refuses. `AIUsageRecord` rows carry
provider, model, prompt version, units, estimated cost, actual cost when the provider
reports it, campaign and asset. The gap between estimated and actual is itself a metric —
an estimator that drifts is a budget control that does not work.

Expensive operations (video render, batch image generation, avatar video) show the estimate
and require confirmation before enqueueing. Over the configured ceiling, an administrator
must approve, and the approval is an `AuditEvent`.

## Data sharing

§28 requires administrators to review data-sharing terms before enabling a provider. The
enablement screen is not a toggle: it records who enabled it, when, the terms URL and
version they reviewed, what categories of data the adapter may send, and the budget. §33's
rule that customer personal data is not sent to AI providers is enforced in the adapter
wrapper — a redaction pass that strips known PII field names from any payload and fails
closed on an unrecognised shape, not a guideline in a document.
