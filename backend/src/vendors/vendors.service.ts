import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './adapters/vendor.adapter.interface';
import { MgpProAdapter } from './adapters/mgp-pro.adapter';
import { BlackSkyAdapter } from './adapters/blacksky.adapter';

// Search fan-out cache: repeat searches with identical params reuse the
// merged vendor responses instead of re-hitting provider APIs.
const SEARCH_CACHE_TTL_MS = 3_600_000;
const SEARCH_CACHE_MAX = 200;

export interface VendorSearchError {
  vendor: string;
  error: string;
}

@Injectable()
export class VendorsService {
  private adapters = new Map<string, VendorAdapter>();
  private searchCache = new Map<string, { results: VendorSearchResult[]; errors: VendorSearchError[]; expiry: number }>();

  constructor() {
    this.register(new MgpProAdapter());
    this.register(new BlackSkyAdapter());
  }

  register(adapter: VendorAdapter): void {
    this.adapters.set(adapter.getId(), adapter);
  }

  listVendors() {
    return Array.from(this.adapters.values()).map(a => ({
      id: a.getId(),
      displayName: a.getDisplayName(),
    }));
  }

  async search(vendorId: string, params: VendorSearchParams): Promise<VendorSearchResult[]> {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) throw new NotFoundException(`Unknown vendor: ${vendorId}`);
    return adapter.search(params);
  }

  /**
   * Combined search across all registered vendors. Vendors are queried in
   * parallel; a failing vendor yields a partial result plus an entry in
   * `errors` instead of failing the whole search. Results are merged and
   * sorted newest-first (missing dates sort last). Identical repeat
   * searches are served from cache.
   */
  async searchAll(params: VendorSearchParams): Promise<{ results: VendorSearchResult[]; errors: VendorSearchError[] }> {
    const key = createHash('sha256').update(JSON.stringify(params)).digest('hex');
    const cached = this.searchCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return { results: cached.results, errors: cached.errors };
    }

    const settled = await Promise.allSettled(
      Array.from(this.adapters.values()).map((adapter) => adapter.search(params)),
    );

    const results: VendorSearchResult[] = [];
    const errors: VendorSearchError[] = [];
    const ids = Array.from(this.adapters.keys());
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        const message = outcome.reason?.message || String(outcome.reason);
        const code = message.includes('VENDOR_AUTH_ERROR') ? 'VENDOR_AUTH_ERROR' : 'VENDOR_UNAVAILABLE';
        errors.push({ vendor: ids[i], error: code });
      }
    });

    results.sort((a, b) => {
      const ta = a.acquisitionDate ? Date.parse(a.acquisitionDate) : NaN;
      const tb = b.acquisitionDate ? Date.parse(b.acquisitionDate) : NaN;
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });

    if (this.searchCache.size >= SEARCH_CACHE_MAX) {
      const oldest = [...this.searchCache.keys()][0];
      this.searchCache.delete(oldest);
    }
    this.searchCache.set(key, { results, errors, expiry: Date.now() + SEARCH_CACHE_TTL_MS });
    return { results, errors };
  }

  async proxyAsset(vendorId: string, assetUrl: string, range?: string): Promise<{ body: Buffer; contentType: string; status: number; contentRange?: string; contentLength?: number }> {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) throw new NotFoundException(`Unknown vendor: ${vendorId}`);
    if (typeof (adapter as any).proxyAsset !== 'function') {
      throw new NotFoundException(`Vendor ${vendorId} does not support asset proxying`);
    }
    return (adapter as any).proxyAsset(assetUrl, range);
  }
}
