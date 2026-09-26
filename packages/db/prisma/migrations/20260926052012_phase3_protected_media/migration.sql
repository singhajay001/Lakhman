-- CreateEnum
CREATE TYPE "AssetLicenceKind" AS ENUM ('OWNED', 'COMMISSIONED', 'LICENSED', 'OPEN_FONT');

-- CreateEnum
CREATE TYPE "ProtectedAssetStatus" AS ENUM ('INGESTED', 'MASKED', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "MaskKind" AS ENUM ('PRODUCT', 'LABEL');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('COMPOSITE_STILL', 'ENVIRONMENT', 'VIDEO', 'AUDIO', 'MASK_PREVIEW', 'DIFF_OVERLAY');

-- CreateEnum
CREATE TYPE "MediaVerification" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'INCOMPLETE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RenderState" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VoiceKind" AS ENUM ('LICENSED_SYNTHETIC', 'CLONED');

-- CreateEnum
CREATE TYPE "ConsentState" AS ENUM ('GRANTED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "asset_licence" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" "AssetLicenceKind" NOT NULL,
    "holder" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "permittedUses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protected_product_asset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "licenceId" TEXT NOT NULL,
    "status" "ProtectedAssetStatus" NOT NULL DEFAULT 'INGESTED',
    "masterKey" TEXT NOT NULL,
    "masterDigest" TEXT NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "colourReference" JSONB,
    "minUsableWidthPx" INTEGER NOT NULL DEFAULT 0,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protected_product_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_mask" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "MaskKind" NOT NULL,
    "maskKey" TEXT NOT NULL,
    "regionDigest" TEXT NOT NULL,
    "bounds" JSONB NOT NULL,
    "dilatePx" INTEGER NOT NULL DEFAULT 3,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_mask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "variantId" TEXT,
    "sourceAssetId" TEXT,
    "licenceId" TEXT,
    "kind" "MediaKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "durationMs" INTEGER,
    "bytes" INTEGER,
    "compositeSpec" JSONB,
    "verification" "MediaVerification" NOT NULL DEFAULT 'PENDING',
    "verificationReport" JSONB,
    "generation" JSONB,
    "geometry" JSONB,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_job" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "variantId" TEXT,
    "mediaAssetId" TEXT,
    "compositionId" TEXT NOT NULL,
    "props" JSONB NOT NULL,
    "state" "RenderState" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostAud" DECIMAL(12,4),
    "actualCostAud" DECIMAL(12,4),
    "renderMs" INTEGER,
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerVoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VoiceKind" NOT NULL DEFAULT 'LICENSED_SYNTHETIC',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_consent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerContact" TEXT,
    "evidenceUrl" TEXT NOT NULL,
    "identityVerifiedBy" TEXT,
    "permittedUses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" "ConsentState" NOT NULL DEFAULT 'GRANTED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,

    CONSTRAINT "voice_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_asset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "voiceProfileId" TEXT,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "text" TEXT,
    "alignment" JSONB,
    "licenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_licence_shopId_expiresAt_idx" ON "asset_licence"("shopId", "expiresAt");

-- CreateIndex
CREATE INDEX "protected_product_asset_shopId_status_idx" ON "protected_product_asset"("shopId", "status");

-- CreateIndex
CREATE INDEX "asset_mask_shopId_assetId_idx" ON "asset_mask"("shopId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_mask_assetId_kind_version_key" ON "asset_mask"("assetId", "kind", "version");

-- CreateIndex
CREATE INDEX "media_asset_shopId_kind_createdAt_idx" ON "media_asset"("shopId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "media_asset_shopId_verification_idx" ON "media_asset"("shopId", "verification");

-- CreateIndex
CREATE INDEX "media_asset_shopId_campaignId_idx" ON "media_asset"("shopId", "campaignId");

-- CreateIndex
CREATE INDEX "render_job_shopId_state_createdAt_idx" ON "render_job"("shopId", "state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "render_job_shopId_idempotencyKey_key" ON "render_job"("shopId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "voice_profile_shopId_provider_providerVoiceId_key" ON "voice_profile"("shopId", "provider", "providerVoiceId");

-- CreateIndex
CREATE INDEX "voice_consent_shopId_state_idx" ON "voice_consent"("shopId", "state");

-- CreateIndex
CREATE INDEX "audio_asset_shopId_createdAt_idx" ON "audio_asset"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "asset_licence" ADD CONSTRAINT "asset_licence_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protected_product_asset" ADD CONSTRAINT "protected_product_asset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protected_product_asset" ADD CONSTRAINT "protected_product_asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shopify_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protected_product_asset" ADD CONSTRAINT "protected_product_asset_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "asset_licence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mask" ADD CONSTRAINT "asset_mask_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "protected_product_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "protected_product_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "asset_licence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profile" ADD CONSTRAINT "voice_profile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_consent" ADD CONSTRAINT "voice_consent_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_asset" ADD CONSTRAINT "audio_asset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_asset" ADD CONSTRAINT "audio_asset_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
