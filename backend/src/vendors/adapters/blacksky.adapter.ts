import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './vendor.adapter.interface';

const BLACKSKY_TIMEOUT_MS = 30_000;
const BLACKSKY_LIMIT = 50;

export class BlackSkyAdapter implements VendorAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(private fetchFn: typeof fetch = globalThis.fetch) {
    this.apiKey = process.env.BLACKSKY_API_KEY || '';
    this.baseUrl = process.env.BLACKSKY_BASE_URL || 'https://api.blacksky.com/v1';
  }

  getId(): string {
    return 'blacksky';
  }

  getDisplayName(): string {
    return 'BlackSky Spectra';
  }

  async search(params: VendorSearchParams): Promise<VendorSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('VENDOR_AUTH_ERROR: BLACKSKY_API_KEY not configured');
    }

    const url = this.buildSearchUrl(params);
    let response;
    try {
      response = await this.fetchFn(url, {
        headers: { Authorization: this.apiKey },
        signal: AbortSignal.timeout(BLACKSKY_TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new Error(`VENDOR_UNAVAILABLE: ${e.message}`);
    }

    if (response.status === 401) throw new Error('VENDOR_AUTH_ERROR: Invalid API key');
    if (response.status === 429) throw new Error('VENDOR_UNAVAILABLE: Rate limited');
    if (!response.ok) throw new Error(`VENDOR_UNAVAILABLE: HTTP ${response.status}`);

    let stac;
    try {
      stac = await response.json();
    } catch {
      throw new Error('VENDOR_UNAVAILABLE: Invalid response from BlackSky API');
    }

    return (stac?.features || []).map((f: any) => this.normalizeFeature(f));
  }

  private buildSearchUrl(params: VendorSearchParams): string {
    const searchParams = new URLSearchParams();

    searchParams.set('bbox', this.aoiToBbox(params.aoi));

    if (params.dateRange) {
      searchParams.set('time', `${params.dateRange.start}/${params.dateRange.end}`);
    }

    if (params.cloudMax != null) {
      searchParams.set('cloudPercentTo', String(params.cloudMax));
    }

    searchParams.set('limit', String(BLACKSKY_LIMIT));
    searchParams.set('sort', '-timestamp');

    return `${this.baseUrl}/catalog/stac/search?${searchParams.toString()}`;
  }

  private aoiToBbox(aoi: VendorSearchParams['aoi']): string {
    if (aoi.type === 'BBox') return aoi.bbox.join(',');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of aoi.coordinates) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    return [minX, minY, maxX, maxY].join(',');
  }

  private normalizeFeature(feature: any): VendorSearchResult {
    const props = feature.properties || {};
    const assets = feature.assets || {};
    // Browse assets are PNGs keyed by varying names (browseUrl in docs);
    // prefer the documented key, fall back to any thumbnail-role asset.
    const browseHref =
      assets.browseUrl?.href ||
      assets.thumbnail?.href ||
      assets.preview?.href ||
      (Object.values(assets) as any[]).find((a) => a?.roles?.includes('thumbnail'))?.href ||
      null;

    return {
      id: feature.id,
      vendor: 'blacksky',
      title: feature.id,
      thumbnailUrl: browseHref,
      footprint: feature.geometry,
      acquisitionDate: props.datetime || null,
      cloudCover: props.cloudPercent ?? null,
      offNadirAngle: props.offNadirAngle ?? null,
      resolution: props.gsd ?? null,
      sensor: props.sensorId || props.vendorId || null,
      price: props.price ?? null,
      previewUrl: browseHref,
      rawProperties: props,
    };
  }

  /**
   * Proxy a vendor asset (e.g. the PNG browse image) so the browser can load
   * it without holding the API key. Only BlackSky asset URLs are allowed.
   */
  async proxyAsset(
    assetUrl: string,
    range?: string,
  ): Promise<{ body: Buffer; contentType: string; status: number; contentRange?: string; contentLength?: number }> {
    if (!this.apiKey) {
      throw new Error('VENDOR_AUTH_ERROR: BLACKSKY_API_KEY not configured');
    }
    if (!assetUrl.startsWith('https://api.blacksky.com/')) {
      throw new Error('VENDOR_BAD_REQUEST: asset URL must be an api.blacksky.com URL');
    }

    const headers: Record<string, string> = { Authorization: this.apiKey };
    if (range) headers['Range'] = range;

    let response;
    try {
      response = await this.fetchFn(assetUrl, {
        headers,
        signal: AbortSignal.timeout(BLACKSKY_TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new Error(`VENDOR_UNAVAILABLE: ${e.message}`);
    }

    if (response.status === 401) throw new Error('VENDOR_AUTH_ERROR: Invalid API key');
    if (response.status === 416) throw new Error('VENDOR_BAD_REQUEST: unsatisfiable range');
    if (response.status !== 200 && response.status !== 206) {
      throw new Error(`VENDOR_UNAVAILABLE: HTTP ${response.status}`);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentRange = response.headers.get('content-range') || undefined;
    const lengthHeader = response.headers.get('content-length');
    return {
      body: buf,
      contentType,
      status: response.status,
      contentRange,
      contentLength: lengthHeader ? Number(lengthHeader) : buf.length,
    };
  }
}
