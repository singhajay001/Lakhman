-- AlterTable
ALTER TABLE "protected_product_asset" ADD COLUMN     "renditionOfId" TEXT;

-- CreateIndex
CREATE INDEX "protected_product_asset_renditionOfId_widthPx_idx" ON "protected_product_asset"("renditionOfId", "widthPx");

-- AddForeignKey
ALTER TABLE "protected_product_asset" ADD CONSTRAINT "protected_product_asset_renditionOfId_fkey" FOREIGN KEY ("renditionOfId") REFERENCES "protected_product_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
