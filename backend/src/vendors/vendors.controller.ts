import { Body, Controller, Get, Param, Post, Query, Res, BadGatewayException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { VendorsService } from './vendors.service';
import { VendorSearchParams } from './adapters/vendor.adapter.interface';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  listVendors() {
    return this.vendorsService.listVendors();
  }

  @Get(':vendorId/browse')
  async proxyBrowse(
    @Param('vendorId') vendorId: string,
    @Query('url') assetUrl: string,
    @Res() res: Response,
  ) {
    if (!assetUrl) {
      throw new BadRequestException('Missing url query parameter');
    }
    try {
      const { body, contentType } = await this.vendorsService.proxyAsset(vendorId, assetUrl);
      res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
      res.send(body);
    } catch (e: any) {
      const message = e.message || '';
      if (message.includes('VENDOR_AUTH_ERROR')) {
        throw new BadGatewayException({ error: 'VENDOR_AUTH_ERROR' });
      }
      if (message.includes('VENDOR_BAD_REQUEST')) {
        throw new BadRequestException({ error: 'VENDOR_BAD_REQUEST' });
      }
      throw new BadGatewayException({ error: 'VENDOR_UNAVAILABLE' });
    }
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
