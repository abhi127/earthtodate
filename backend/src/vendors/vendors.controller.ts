import { Body, Controller, Get, Param, Post, BadGatewayException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorSearchParams } from './adapters/vendor.adapter.interface';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  listVendors() {
    return this.vendorsService.listVendors();
  }

  @Post(':vendorId/search')
  async search(@Param('vendorId') vendorId: string, @Body() params: VendorSearchParams) {
    try {
      const results = await this.vendorsService.search(vendorId, params);
      return { results };
    } catch (e: any) {
      const message = e.message || '';
      if (message.includes('VENDOR_AUTH_ERROR')) {
        throw new BadGatewayException({ error: 'VENDOR_AUTH_ERROR', results: [] });
      }
      if (message.includes('VENDOR_UNAVAILABLE')) {
        throw new BadGatewayException({ error: 'VENDOR_UNAVAILABLE', results: [] });
      }
      throw e;
    }
  }
}
