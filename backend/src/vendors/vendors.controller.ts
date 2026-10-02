import { Body, Controller, Get, Param, Post, Query, Req, Res, BadGatewayException, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!assetUrl) {
      throw new BadRequestException('Missing url query parameter');
    }
    try {
      const { body, contentType, status, contentRange, contentLength } =
        await this.vendorsService.proxyAsset(vendorId, assetUrl, req.headers['range']);
      res.status(status);
      res.set({ 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
      if (contentRange) res.set({ 'Content-Range': contentRange });
      if (contentLength != null) res.set({ 'Content-Length': String(contentLength) });
      // Only cache full-file responses; partial content varies by range.
      if (status === 200) res.set({ 'Cache-Control': 'public, max-age=86400' });
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

  @Post('search')
  async searchAll(@Body() params: VendorSearchParams) {
    // Combined fan-out across all vendors. Partial vendor failures are
    // reported per vendor; only a total failure (no vendor reachable and
    // no results) maps to 502 — auth misconfiguration maps to 502 as well
    // so a missing key is never mistaken for empty coverage.
    const { results, errors } = await this.vendorsService.searchAll(params);
    if (results.length === 0 && errors.length > 0) {
      if (errors.some((e) => e.error === 'VENDOR_AUTH_ERROR')) {
        throw new BadGatewayException({ error: 'VENDOR_AUTH_ERROR', results: [] });
      }
      throw new BadGatewayException({ error: 'VENDOR_UNAVAILABLE', results: [] });
    }
    return { results, errors };
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
