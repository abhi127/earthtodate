import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './adapters/vendor.adapter.interface';
import { MgpProAdapter } from './adapters/mgp-pro.adapter';
import { BlackSkyAdapter } from './adapters/blacksky.adapter';

@Injectable()
export class VendorsService {
  private adapters = new Map<string, VendorAdapter>();

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

  async proxyAsset(vendorId: string, assetUrl: string, range?: string): Promise<{ body: Buffer; contentType: string; status: number; contentRange?: string; contentLength?: number }> {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) throw new NotFoundException(`Unknown vendor: ${vendorId}`);
    if (typeof (adapter as any).proxyAsset !== 'function') {
      throw new NotFoundException(`Vendor ${vendorId} does not support asset proxying`);
    }
    return (adapter as any).proxyAsset(assetUrl, range);
  }
}
