import { prisma } from '@spirithaus/db';
import type { MappedCollection, MappedProduct } from './mapping.js';
import type { ProductStore } from './sync.js';

/**
 * The Prisma implementation of the sync's ProductStore port. It is the only writer of
 * the Shopify mirror (docs/social-studio/02-architecture.md).
 */
export class PrismaProductStore implements ProductStore {
  constructor(private readonly shopId: string) {}

  async upsertProduct(product: MappedProduct): Promise<void> {
    const row = await prisma.shopifyProduct.upsert({
      where: { shopId_gid: { shopId: this.shopId, gid: product.gid } },
      create: {
        shopId: this.shopId,
        gid: product.gid,
        handle: product.handle,
        title: product.title,
        descriptionHtml: product.descriptionHtml,
        productType: product.productType,
        vendor: product.vendor,
        tags: product.tags,
        status: product.status,
        featuredImageUrl: product.featuredImageUrl,
        onlineStoreUrl: product.onlineStoreUrl,
        publishedAt: product.publishedAt,
        shopifyUpdatedAt: product.shopifyUpdatedAt,
      },
      update: {
        handle: product.handle,
        title: product.title,
        descriptionHtml: product.descriptionHtml,
        productType: product.productType,
        vendor: product.vendor,
        tags: product.tags,
        status: product.status,
        featuredImageUrl: product.featuredImageUrl,
        onlineStoreUrl: product.onlineStoreUrl,
        publishedAt: product.publishedAt,
        shopifyUpdatedAt: product.shopifyUpdatedAt,
        syncedAt: new Date(),
      },
    });

    for (const variant of product.variants) {
      await prisma.shopifyVariant.upsert({
        where: { shopId_gid: { shopId: this.shopId, gid: variant.gid } },
        create: {
          shopId: this.shopId,
          productId: row.id,
          gid: variant.gid,
          sku: variant.sku,
          title: variant.title,
          position: variant.position,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          currency: variant.currency,
          unitCost: variant.unitCost,
          inventoryQuantity: variant.inventoryQuantity,
          inventoryPolicy: variant.inventoryPolicy,
          availableForSale: variant.availableForSale,
        },
        update: {
          productId: row.id,
          sku: variant.sku,
          title: variant.title,
          position: variant.position,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          currency: variant.currency,
          unitCost: variant.unitCost,
          inventoryQuantity: variant.inventoryQuantity,
          inventoryPolicy: variant.inventoryPolicy,
          availableForSale: variant.availableForSale,
          syncedAt: new Date(),
        },
      });
    }
  }

  async upsertCollection(collection: MappedCollection): Promise<void> {
    const row = await prisma.shopifyCollection.upsert({
      where: { shopId_gid: { shopId: this.shopId, gid: collection.gid } },
      create: {
        shopId: this.shopId,
        gid: collection.gid,
        handle: collection.handle,
        title: collection.title,
        descriptionHtml: collection.descriptionHtml,
        sortOrder: collection.sortOrder,
        productCount: collection.productCount,
      },
      update: {
        handle: collection.handle,
        title: collection.title,
        descriptionHtml: collection.descriptionHtml,
        sortOrder: collection.sortOrder,
        productCount: collection.productCount,
        syncedAt: new Date(),
      },
    });

    const products = await prisma.shopifyProduct.findMany({
      where: { shopId: this.shopId, gid: { in: collection.productGids } },
      select: { id: true },
    });

    // Membership is replaced, not merged: a product removed from a collection upstream
    // must stop being in it here.
    await prisma.shopifyCollectionProduct.deleteMany({ where: { collectionId: row.id } });
    if (products.length > 0) {
      await prisma.shopifyCollectionProduct.createMany({
        data: products.map((product) => ({
          shopId: this.shopId,
          collectionId: row.id,
          productId: product.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  async knownProductGids(): Promise<string[]> {
    const rows = await prisma.shopifyProduct.findMany({
      where: { shopId: this.shopId },
      select: { gid: true },
    });
    return rows.map((row) => row.gid);
  }

  /**
   * Section 31: revalidate, never reckless deletion. A product Shopify stopped
   * returning is archived in the mirror and its variants are marked unavailable, so
   * campaigns referencing it fail their preflight check rather than pointing at a row
   * that vanished.
   */
  async markMissing(gids: string[]): Promise<void> {
    if (gids.length === 0) return;
    await prisma.shopifyProduct.updateMany({
      where: { shopId: this.shopId, gid: { in: gids } },
      data: { status: 'ARCHIVED', syncedAt: new Date() },
    });
    const products = await prisma.shopifyProduct.findMany({
      where: { shopId: this.shopId, gid: { in: gids } },
      select: { id: true },
    });
    await prisma.shopifyVariant.updateMany({
      where: { shopId: this.shopId, productId: { in: products.map((p) => p.id) } },
      data: { availableForSale: false, inventoryQuantity: 0 },
    });
  }
}
