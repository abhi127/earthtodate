import { Controller, Get, Param, Query, Req, Res, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { TilesService } from './tiles.service';

@SkipThrottle()
@Controller('tiles')
export class TilesController {
  private readonly logger = new Logger(TilesController.name);

  constructor(private readonly tilesService: TilesService) {}

  private getForwardHeaders(req: Request): Record<string, string> {
    const h: Record<string, string> = {};
    const fwd = ['user-agent', 'accept', 'referer', 'accept-encoding', 'cookie', 'origin'];
    for (const key of fwd) {
      const val = req.headers[key];
      if (val) h[key] = Array.isArray(val) ? val[0] : val;
    }
    return h;
  }

  private async handleProxy(res: Response, req: Request, path: string, queryString: string, cacheTtlMs = 300_000) {
    try {
      const result = await this.tilesService.proxy(path, queryString, cacheTtlMs, this.getForwardHeaders(req));
      res.set({ 'Content-Type': result.contentType, 'Cache-Control': 'public, max-age=300' });
      res.send(result.body);
    } catch (e: any) {
      this.logger.error(`${e.message}`);
      res.status(502).json({ error: 'Tile server upstream error', detail: e.message });
    }
  }

  @Get('v2/:view/:z/:x/:y')
  getTile(
    @Param('view') view: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const qs = new URLSearchParams(query).toString();
    this.handleProxy(res, req, `/v2/${view}/${z}/${x}/${y}`, qs);
  }

  @Get('pollution/:view/:z/:x/:y')
  getPollutionTile(
    @Param('view') view: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.handleProxy(res, req, `/pollution/${view}/${z}/${x}/${y}`, '', 120_000);
  }

  @Get('dates/:lat_lon/:view/:date_str/:days_back/:max_clouds')
  getDates(
    @Param('lat_lon') latLon: string,
    @Param('view') view: string,
    @Param('date_str') dateStr: string,
    @Param('days_back') daysBack: string,
    @Param('max_clouds') maxClouds: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const qs = new URLSearchParams(query).toString();
    this.handleProxy(res, req, `/dates/${latLon}/${view}/${dateStr}/${daysBack}/${maxClouds}`, qs, 60_000);
  }

  @Get('dem')
  getDem(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!lat || !lon) { res.status(400).json({ error: 'lat and lon are required' }); return; }
    this.handleProxy(res, req, '/dem_at_lat_lon', `lat=${lat}&lon=${lon}`, 3_600_000);
  }

  @Get('download_aoi/:bbox/:date_str/:days_back/:max_clouds/:view')
  getDownloadAoi(
    @Param('bbox') bbox: string,
    @Param('date_str') dateStr: string,
    @Param('days_back') daysBack: string,
    @Param('max_clouds') maxClouds: string,
    @Param('view') view: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const qs = new URLSearchParams(query).toString();
    this.handleProxy(res, req, `/v2/download_aoi/${bbox}/${dateStr}/${daysBack}/${maxClouds}/${view}`, qs, 0);
  }

  @Get('admin/cache')
  getCacheStats() {
    return this.tilesService.getCacheStats();
  }
}
