# 3 — Data model and migrations

Prisma, PostgreSQL. §35 lists the entities; this says how they are keyed, what is
enforced by the database rather than by a service, and in what order the migrations land.

## Tenancy and conventions

Every table that is not global carries `shopId` as the first column of its primary index.
SPIRITHAUS is one shop today, but a Shopify app is multi-tenant by construction and
retrofitting a tenant key after the first million event rows is not a migration anyone
enjoys. Row-level security is enabled per shop as a second line behind the query layer.

- `id`: cuid2. `createdAt` / `updatedAt` on everything.
- Status is an explicit enum, never a string or a boolean pair.
- Soft delete (`deletedAt`) only where an audit trail requires the row to survive:
  campaigns, approvals, publications, assets, conversations. Everything else deletes.
- Money is `Decimal(12,4)` with an explicit currency column. Never a float.
- All timestamps stored UTC; `Shop.timezone` (`Australia/Sydney`) is display only. §38
  requires a timezone conversion test and it exists because DST in Sydney has already
  broken every scheduler ever written.

## Migration sequence

Ten migrations, each shipped with the phase that needs it. Splitting them this way keeps
every migration reversible on its own.

| # | Phase | Contents |
| --- | --- | --- |
| 1 | 1 | `Shop`, `User`, `Role`, `Permission`, `Session`, `AuditEvent`, `Notification`, `WebhookEvent` |
| 2 | 1 | `ShopifyProduct`, `ShopifyVariant`, `ShopifyCollection`, `SyncRun` |
| 3 | 1 | `ModelRegistry`, `PromptTemplate`, `PromptVersion`, `AIUsageRecord`, `ProviderConfig` |
| 4 | 2 | `ProductResearch`, `ResearchClaim`, `ResearchSource`, `BrandKit`, `BrandKitVersion` |
| 5 | 2 | `Campaign`, `CampaignProduct`, `CampaignBrief`, `ContentVariant`, `PlatformPost`, `ContentSimilarityRecord` |
| 6 | 2 | `ComplianceCheck`, `Approval`, `ApprovalKey` |
| 7 | 3 | `ProtectedProductAsset`, `AssetMask`, `MediaAsset`, `AssetLicence`, `Storyboard`, `RenderJob`, `TranscodeJob`, `VoiceProfile`, `VoiceConsent`, `AudioAsset` |
| 8 | 4 | `SocialConnection`, `PlatformCapability`, `PublicationJob`, `PublicationAttempt`, `ScheduleRecommendation`, `SchedulingDecision` |
| 9 | 5 | `MarketingIdentity`, `CustomerEvent`, `AttributionTouch`, `AttributedOrder`, `AudienceSegment`, `CommercialMetric`, `PlatformMetric` |
| 10 | 6–7 | `Competitor`, `IntelligenceObservation`, `TrendOpportunity`, `EvergreenAssessment`, `RecycleJob`, `Forecast`, `Experiment`, `CommunityConversation`, `CommunityMessage`, `MessageClassification`, `DraftReply` |

## The constraints that carry a rule

Eight places where the database enforces something the prompt requires, so that a future
feature cannot quietly route around it.

**1. Publication idempotency.**
`@@unique([shopId, idempotencyKey])` on `PublicationJob`, key =
`sha256(campaignId, contentVariantId, destinationId, approvalVersionId)`. A retry cannot
create a second job for a destination that already has one. §22.

**2. One success per destination.**
Partial unique index: `PublicationJob (shopId, contentVariantId, destinationId) WHERE
status = 'SUCCEEDED'`. This is the constraint that makes "never republish a successful job
during retries" true rather than intended.

**3. Dual control cannot be self-satisfied.**
`ApprovalKey @@unique([approvalId, userId])` stops one user signing twice, and a check
constraint requires `keyIndex` ∈ {1,2} with distinct users. `Approval.requiredKeys` is
computed from the action and the budget at creation, not chosen by the requester. §20.

**4. Approval binds to exact content.**
`Approval.contentHash` = sha256 over the canonicalised variant: copy fields, media asset
digests, destination set, schedule window, budget, product snapshot, Brand Kit version,
segment version. `ContentVariant` writes recompute the hash; a mismatch sets
`approvalState = INVALIDATED` in the same transaction as the edit. §20's "any material
edit invalidates approval" is a trigger, not a code path someone must remember to call.

**5. Webhook replay is free.**
`WebhookEvent @@unique([shopId, topic, shopifyEventId])`, processed before any handler
side effect. Shopify redelivers; §7 requires idempotency.

**6. Protected regions are immutable once approved.**
`ProtectedProductAsset.masterDigest` and `AssetMask.regionDigest` are write-once after
`status = APPROVED`; derivatives reference the mask version they were built against.
Changing a mask creates a new version and orphans nothing. §15.

**7. Brand Kit history is append-only.**
`BrandKitVersion` rows are immutable; `BrandKit.currentVersionId` moves. Every generated
asset stores `brandKitVersionId`. §14's "identify affected drafts without silently
modifying published history" is then a query, not an archaeology exercise.

**8. Event ingestion is idempotent.**
`CustomerEvent @@unique([shopId, eventId])` where `eventId` comes from the Web Pixel. A
pixel that fires twice on a flaky connection must not double-count a checkout. §26.

## Indexes that exist because a query will need them

`CustomerEvent (shopId, occurredAt)` and `(shopId, marketingIdentityId, occurredAt)` —
the attribution join walks a time window per identity, and this is the table that grows
without limit. Partitioned monthly from the start; retention is policy, and §33 requires
one.

`AttributionTouch (shopId, orderId)`, `(shopId, campaignId, occurredAt)`.
`PlatformPost (shopId, status, scheduledAt)` — the scheduler's only hot query.
`ContentSimilarityRecord (shopId, phash)` using a BK-tree-free approach: store the 64-bit
hash as `bytea` plus four 16-bit buckets as generated columns, index the buckets, and
filter candidates before computing Hamming distance. §24 needs near-duplicate detection
across the whole history, and a sequential scan over every asset ever published is not a
plan.

## What is deliberately not modelled

**No `Customer` table.** §25 says operate on aggregated segments and minimise personal
data. `AudienceSegment` stores the segment *definition* and version plus aggregate counts;
individual membership is never copied out of Shopify. `MarketingIdentity` is a
pseudonymous visitor chain, joined to an order at attribution time and holding no name,
email or address.

**No segment fields that could express a prohibited segment.** §25 forbids inferring
heavy-drinker, intoxication-frequency, vulnerability or health-related groups. The
mitigation is not a validation rule that a later migration can widen — `AudienceSegment`
has no free-form predicate column at all. Definitions are a closed enum of Shopify segment
references plus the permitted behavioural dimensions (recency, frequency, value, category,
brand, gift, consent state). Adding a dimension is a schema change and therefore a review.

**No plaintext token column anywhere.** `SocialConnection.encryptedToken` is bytea plus a
key id; the decrypt path is one function, audited, never called from a loader that renders.
