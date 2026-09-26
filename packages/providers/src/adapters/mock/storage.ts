import { err } from '@spirithaus/domain';
import { MockAdapter } from './base.js';
import { providerError } from '../../contracts/common.js';
import type { ObjectStorageProvider, ProviderResult } from '../../contracts/index.js';

/** In-memory object store for development and tests. */
export class MockObjectStorageProvider extends MockAdapter implements ObjectStorageProvider {
  readonly contract = 'ObjectStorageProvider' as const;
  private readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<ProviderResult<{ key: string }>> {
    this.objects.set(key, { bytes, contentType });
    return this.success({ key }, { gb_months: bytes.byteLength / 1e9 });
  }

  async get(key: string): Promise<ProviderResult<{ bytes: Uint8Array; contentType: string }>> {
    const found = this.objects.get(key);
    if (!found)
      return err(providerError('invalid_input', `no object at ${key}`, { retryable: false }));
    return this.success(found);
  }

  async signedUrl(
    key: string,
    ttlSeconds: number,
  ): Promise<ProviderResult<{ url: string; expiresAt: string }>> {
    if (!this.objects.has(key)) {
      return err(providerError('invalid_input', `no object at ${key}`, { retryable: false }));
    }
    return this.success({
      url: `mock://object/${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  }

  async delete(key: string): Promise<ProviderResult<{ deleted: boolean }>> {
    return this.success({ deleted: this.objects.delete(key) });
  }
}
