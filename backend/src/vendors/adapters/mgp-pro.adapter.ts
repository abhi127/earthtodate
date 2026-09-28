import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './vendor.adapter.interface';

const MGP_BASE_URL = 'https://api.maxar.com/discovery/v1';
const MGP_TIMEOUT_MS = 30_000;

export class MgpProAdapter implements VendorAdapter {
  private apiKey: string;

  constructor(private fetchFn: typeof fetch = globalThis.fetch) {
    this.apiKey = process.env.MGP_API_KEY || '';
  }

  getId(): string {
    return 'mgp-pro';
  }

  getDisplayName(): string {
    return 'MGP Pro (Maxar)';
  }

  async search(params: VendorSearchParams): Promise<VendorSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('VENDOR_AUTH_ERROR: MGP_API_KEY not configured');
    }

    const url = this.buildSearchUrl(params);

    let response;
    try {
      response = await this.fetchFn(url, {
        headers: { 'maxar-api-key': this.apiKey },
        signal: AbortSignal.timeout(MGP_TIMEOUT_MS),
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
      throw new Error('VENDOR_UNAVAILABLE: Invalid response from MGP API');
    }

    return (stac?.features || []).map((f: any) => this.normalizeFeature(f));
  }

  private buildSearchUrl(params: VendorSearchParams): string {
    const searchParams = new URLSearchParams();

    if (params.aoi.type === 'BBox') {
      searchParams.set('bbox', params.aoi.bbox.join(','));
    } else {
      searchParams.set('intersects', JSON.stringify(params.aoi));
    }

    if (params.dateRange) {
      searchParams.set('datetime', `${params.dateRange.start}/${params.dateRange.end}`);
    }

    if (params.collections?.length) {
      searchParams.set('collections', params.collections.join(','));
    }

    if (params.cloudMax != null) {
      searchParams.set('filter', `eo:cloud_cover < ${params.cloudMax}`);
    }

    searchParams.set('sortby', 'datetime');
    searchParams.set('area-based-calc', 'true');
    searchParams.set('limit', '50');

    return `${MGP_BASE_URL}/catalogs/imagery/search?${searchParams.toString()}`;
  }

  private normalizeFeature(feature: any): VendorSearchResult {
    const props = feature.properties || {};
    const assets = feature.assets || {};

    // MGP Pro provides a `browse` GeoTIFF asset; fall back to generic
    // thumbnail/preview keys for forward compatibility with other catalogs.
    const previewUrl =
      assets.browse?.href ||
      assets.preview?.href ||
      assets.thumbnail?.href ||
      null;

    // Prefer AOI-specific area calculations (returned because we search
    // with area-based-calc=true) over whole-strip values.
    const cloudCover =
      props['area:cloud_cover_percentage'] ??
      props['eo:cloud_cover'] ??
      null;
    const offNadirAngle =
      props['area:avg_off_nadir_angle'] ??
      props['view:off_nadir'] ??
      null;

    return {
      id: feature.id,
      vendor: 'mgp-pro',
      title: props.title || feature.id,
      thumbnailUrl: assets.thumbnail?.href || null,
      footprint: feature.geometry,
      acquisitionDate: props.datetime || null,
      cloudCover,
      offNadirAngle,
      resolution: props.gsd ?? null,
      sensor: props.platform || feature.collection || null,
      price: props.price ?? null,
      previewUrl,
      rawProperties: props,
    };
  }

  /**
   * Proxy a vendor asset (e.g. the browse GeoTIFF) so the browser can load
   * it without holding the API key. Only MGP asset URLs are allowed.
   * Forwards byte-range requests so GeoTIFF/COG readers can fetch partial
   * content (206 Partial Content) instead of the whole file.
   */
  async proxyAsset(
    assetUrl: string,
    range?: string,
  ): Promise<{ body: Buffer; contentType: string; status: number; contentRange?: string; contentLength?: number }> {
    if (!this.apiKey) {
      throw new Error('VENDOR_AUTH_ERROR: MGP_API_KEY not configured');
    }
    if (!assetUrl.startsWith('https://api.maxar.com/')) {
      throw new Error('VENDOR_BAD_REQUEST: asset URL must be an api.maxar.com URL');
    }

    const headers: Record<string, string> = { 'maxar-api-key': this.apiKey };
    if (range) headers['Range'] = range;

    let response;
    try {
      response = await this.fetchFn(assetUrl, {
        headers,
        signal: AbortSignal.timeout(MGP_TIMEOUT_MS),
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
