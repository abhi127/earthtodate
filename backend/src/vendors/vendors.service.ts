import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './adapters/vendor.adapter.interface';
import { MgpProAdapter } from './adapters/mgp-pro.adapter';

@Injectable()
export class VendorsService {
  private adapters = new Map<string, VendorAdapter>();

  constructor() {
    this.register(new MgpProAdapter());
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
}
