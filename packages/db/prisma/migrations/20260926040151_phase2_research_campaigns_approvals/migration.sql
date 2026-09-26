-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimKind" AS ENUM ('VERIFIED', 'INFERRED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFLICTED');

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('PRODUCT_AWARENESS', 'LAUNCH', 'SALES_CONVERSION', 'COLLECTION_PROMOTION', 'LIMITED_TIME_OFFER', 'BACK_IN_STOCK', 'CLEARANCE', 'PREMIUM_STORYTELLING', 'GIFTING', 'COCKTAIL_INSPIRATION', 'FOOD_PAIRING', 'EDUCATION', 'ENGAGEMENT', 'ORGANIC_GROWTH', 'PAID_CREATIVE', 'RETARGETING', 'SEASONAL');

-- CreateEnum
CREATE TYPE "CampaignState" AS ENUM ('DRAFT', 'RESEARCH_REVIEW', 'COMPLIANCE_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('UNSUBMITTED', 'PENDING', 'APPROVED', 'INVALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckSeverity" AS ENUM ('BLOCKING', 'ADVISORY', 'INFO');

-- CreateEnum
CREATE TYPE "CheckOutcome" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('ORGANIC_PUBLICATION', 'HIGH_RISK_CONTENT', 'PAID_BUDGET', 'BUDGET_SCALING', 'COMPETITION', 'COMPLIANCE_EXCEPTION');

-- CreateEnum
CREATE TYPE "ApprovalOutcome" AS ENUM ('PENDING', 'GRANTED', 'REJECTED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "product_research" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_claim" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" "ClaimKind" NOT NULL DEFAULT 'VERIFIED',
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(3,2) NOT NULL,
    "sourceId" TEXT,
    "conflictsWithId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_source" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "title" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'unknown',
    "excerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kit" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kit_version" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "brandKitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_kit_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "CampaignObjective" NOT NULL,
    "state" "CampaignState" NOT NULL DEFAULT 'DRAFT',
    "brandKitVersionId" TEXT,
    "awarenessObjectiveApprovedBy" TEXT,
    "landingUrl" TEXT,
    "offerTerms" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_product" (
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "campaign_product_pkey" PRIMARY KEY ("campaignId","productId")
);

-- CreateTable
CREATE TABLE "campaign_brief" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "strategy" JSONB NOT NULL,
    "factSheet" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_variant" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "content" JSONB NOT NULL,
    "primaryCopy" TEXT NOT NULL,
    "callToAction" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "altText" TEXT,
    "destinationUrl" TEXT,
    "contentHash" TEXT,
    "approvalState" "ApprovalState" NOT NULL DEFAULT 'UNSUBMITTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "generation" JSONB,
    "qualityScores" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_similarity_record" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hash" BYTEA NOT NULL,
    "bucket0" INTEGER NOT NULL,
    "bucket1" INTEGER NOT NULL,
    "bucket2" INTEGER NOT NULL,
    "bucket3" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_similarity_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_check" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "variantId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "CheckSeverity" NOT NULL,
    "outcome" "CheckOutcome" NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB,
    "suggestion" TEXT,
    "reviewerDecision" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "variantId" TEXT,
    "kind" "ApprovalKind" NOT NULL,
    "requiredKeys" INTEGER NOT NULL DEFAULT 1,
    "outcome" "ApprovalOutcome" NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "budgetAud" DECIMAL(12,2),
    "scheduledFrom" TIMESTAMP(3),
    "scheduledTo" TIMESTAMP(3),
    "requestedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_key" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyIndex" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "signedHash" TEXT NOT NULL,
    "note" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_research_productId_key" ON "product_research"("productId");

-- CreateIndex
CREATE INDEX "product_research_shopId_status_idx" ON "product_research"("shopId", "status");

-- CreateIndex
CREATE INDEX "research_claim_shopId_researchId_status_idx" ON "research_claim"("shopId", "researchId", "status");

-- CreateIndex
CREATE INDEX "research_claim_shopId_field_idx" ON "research_claim"("shopId", "field");

-- CreateIndex
CREATE INDEX "research_source_shopId_researchId_idx" ON "research_source"("shopId", "researchId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kit_shopId_key" ON "brand_kit"("shopId");

-- CreateIndex
CREATE INDEX "brand_kit_version_shopId_idx" ON "brand_kit_version"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kit_version_brandKitId_version_key" ON "brand_kit_version"("brandKitId", "version");

-- CreateIndex
CREATE INDEX "campaign_shopId_state_updatedAt_idx" ON "campaign"("shopId", "state", "updatedAt");

-- CreateIndex
CREATE INDEX "campaign_product_shopId_productId_idx" ON "campaign_product"("shopId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_brief_campaignId_key" ON "campaign_brief"("campaignId");

-- CreateIndex
CREATE INDEX "content_variant_shopId_approvalState_idx" ON "content_variant"("shopId", "approvalState");

-- CreateIndex
CREATE UNIQUE INDEX "content_variant_campaignId_platform_key" ON "content_variant"("campaignId", "platform");

-- CreateIndex
CREATE INDEX "content_similarity_record_shopId_kind_bucket0_idx" ON "content_similarity_record"("shopId", "kind", "bucket0");

-- CreateIndex
CREATE INDEX "content_similarity_record_shopId_kind_bucket1_idx" ON "content_similarity_record"("shopId", "kind", "bucket1");

-- CreateIndex
CREATE INDEX "content_similarity_record_shopId_kind_bucket2_idx" ON "content_similarity_record"("shopId", "kind", "bucket2");

-- CreateIndex
CREATE INDEX "content_similarity_record_shopId_kind_bucket3_idx" ON "content_similarity_record"("shopId", "kind", "bucket3");

-- CreateIndex
CREATE INDEX "compliance_check_shopId_campaignId_outcome_idx" ON "compliance_check"("shopId", "campaignId", "outcome");

-- CreateIndex
CREATE INDEX "compliance_check_shopId_severity_outcome_idx" ON "compliance_check"("shopId", "severity", "outcome");

-- CreateIndex
CREATE INDEX "approval_shopId_outcome_createdAt_idx" ON "approval"("shopId", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "approval_key_shopId_userId_idx" ON "approval_key"("shopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_key_approvalId_userId_key" ON "approval_key"("approvalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_key_approvalId_keyIndex_key" ON "approval_key"("approvalId", "keyIndex");

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shopify_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_claim" ADD CONSTRAINT "research_claim_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "product_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_claim" ADD CONSTRAINT "research_claim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "research_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_source" ADD CONSTRAINT "research_source_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "product_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kit" ADD CONSTRAINT "brand_kit_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kit_version" ADD CONSTRAINT "brand_kit_version_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_brandKitVersionId_fkey" FOREIGN KEY ("brandKitVersionId") REFERENCES "brand_kit_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_product" ADD CONSTRAINT "campaign_product_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_product" ADD CONSTRAINT "campaign_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shopify_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_brief" ADD CONSTRAINT "campaign_brief_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_variant" ADD CONSTRAINT "content_variant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_similarity_record" ADD CONSTRAINT "content_similarity_record_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "content_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_check" ADD CONSTRAINT "compliance_check_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_check" ADD CONSTRAINT "compliance_check_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "content_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "content_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_key" ADD CONSTRAINT "approval_key_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
