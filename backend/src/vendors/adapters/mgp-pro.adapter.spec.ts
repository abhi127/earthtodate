import { MgpProAdapter } from './mgp-pro.adapter';

describe('MgpProAdapter', () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env = { ...origEnv };
  });

  const STAC_RESPONSE = {
    type: 'FeatureCollection',
    features: [
      {
        id: 'test-id-1',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]] },
        properties: {
          datetime: '2025-06-15T10:30:00Z',
          'eo:cloud_cover': 5.0,
          'view:off_nadir': 12.5,
          'area:cloud_cover_percentage': 3.2,
          'area:avg_off_nadir_angle': 11.8,
          gsd: 0.5,
          platform: 'wv02',
        },
        assets: {
          browse: { href: 'https://api.maxar.com/discovery/v1/browse/test-id-1.tif' },
        },
      },
      {
        id: 'test-id-2',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[77.2, 28.2], [77.3, 28.2], [77.3, 28.3], [77.2, 28.3], [77.2, 28.2]]] },
        properties: {
          datetime: '2025-07-20T11:00:00Z',
          'eo:cloud_cover': null,
          'view:off_nadir': null,
          gsd: 0.3,
          platform: 'wv03',
        },
        assets: {},
      },
    ],
  };

  it('normalizes STAC features to VendorSearchResult', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(STAC_RESPONSE), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    const results = await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      dateRange: { start: '2025-01-01', end: '2025-12-31' },
      cloudMax: 20,
      collections: ['wv02', 'wv03'],
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('test-id-1');
    expect(results[0].vendor).toBe('mgp-pro');
    // Area-based values take precedence over whole-strip values
    expect(results[0].cloudCover).toBe(3.2);
    expect(results[0].offNadirAngle).toBe(11.8);
    expect(results[0].resolution).toBe(0.5);
    expect(results[0].sensor).toBe('wv02');
    expect(results[0].thumbnailUrl).toBeNull();
    expect(results[0].previewUrl).toBe('https://api.maxar.com/discovery/v1/browse/test-id-1.tif');
    expect(results[0].rawProperties).toHaveProperty('eo:cloud_cover', 5.0);
  });

  it('handles null optional fields gracefully', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(STAC_RESPONSE), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    const results = await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } });

    expect(results[1].cloudCover).toBeNull();
    expect(results[1].offNadirAngle).toBeNull();
    expect(results[1].thumbnailUrl).toBeNull();
    expect(results[1].previewUrl).toBeNull();
  });

  it('sends maxar-api-key header and correct STAC params', async () => {
    process.env.MGP_API_KEY = 'secret-key';
    process.env.MGP_COLLECTIONS = 'wv02';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      dateRange: { start: '2025-01-01', end: '2025-12-31' },
      cloudMax: 15,
    });

    const mock = fetchMock as unknown as jest.Mock;
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('api.maxar.com/discovery/v1/catalogs/imagery/search');
    expect(String(url)).toContain('bbox=77%2C28%2C77.3%2C28.3');
    expect(String(url)).toContain('datetime=2025-01-01%2F2025-12-31');
    expect(String(url)).toContain('collections=wv02');
    expect(String(url)).toContain('filter=eo%3Acloud_cover+%3C+15');
    expect(String(url)).toContain('area-based-calc=true');
    expect((init as any).headers['maxar-api-key']).toBe('secret-key');
  });

  it('uses MGP_COLLECTIONS env as the collections filter', async () => {
    process.env.MGP_API_KEY = 'test-key';
    process.env.MGP_COLLECTIONS = 'wv02, wv03';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } });

    const mock = fetchMock as unknown as jest.Mock;
    const [url] = mock.mock.calls[0];
    expect(String(url)).toContain('collections=wv02%2Cwv03');
  });

  it('omits collections param when MGP_COLLECTIONS is unset', async () => {
    process.env.MGP_API_KEY = 'test-key';
    delete process.env.MGP_COLLECTIONS;
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } });

    const mock = fetchMock as unknown as jest.Mock;
    const [url] = mock.mock.calls[0];
    expect(String(url)).not.toContain('collections=');
  });

  it('ignores frontend-supplied collections in favor of backend config', async () => {
    process.env.MGP_API_KEY = 'test-key';
    process.env.MGP_COLLECTIONS = 'ge01';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      collections: ['wv02'],
    });

    const mock = fetchMock as unknown as jest.Mock;
    const [url] = mock.mock.calls[0];
    expect(String(url)).toContain('collections=ge01');
    expect(String(url)).not.toContain('wv02');
  });

  it('falls back to whole-strip values when area-based values are missing', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const noAreaResponse = {
      type: 'FeatureCollection',
      features: [
        {
          id: 'test-id-3',
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]] },
          properties: {
            datetime: '2025-08-01T10:00:00Z',
            'eo:cloud_cover': 7.5,
            'view:off_nadir': 14.0,
            gsd: 0.5,
            platform: 'wv02',
          },
          assets: {},
        },
      ],
    };
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(noAreaResponse), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    const results = await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.1, 28.1] } });

    expect(results).toHaveLength(1);
    expect(results[0].cloudCover).toBe(7.5);
    expect(results[0].offNadirAngle).toBe(14.0);
  });

  it('proxies vendor assets through the API key', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const tiffBytes = Buffer.from([73, 73, 42, 0]);
    const fetchMock = jest.fn(async () => new Response(tiffBytes, {
      status: 200,
      headers: { 'content-type': 'image/tiff; application=geotiff' },
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    const result = await adapter.proxyAsset('https://api.maxar.com/discovery/v1/browse/test.tif');

    expect(result.body).toEqual(tiffBytes);
    expect(result.contentType).toBe('image/tiff; application=geotiff');
    expect(result.status).toBe(200);
    const mock = fetchMock as unknown as jest.Mock;
    expect((mock.mock.calls[0][1] as any).headers['maxar-api-key']).toBe('test-key');
  });

  it('forwards byte-range requests and relays 206 responses', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const slice = Buffer.from([1, 2, 3, 4]);
    const fetchMock = jest.fn(async () => new Response(slice, {
      status: 206,
      headers: {
        'content-type': 'image/tiff; application=geotiff',
        'content-range': 'bytes 0-3/1318886',
        'content-length': '4',
      },
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    const result = await adapter.proxyAsset(
      'https://api.maxar.com/discovery/v1/browse/test.tif',
      'bytes=0-3',
    );

    const mock = fetchMock as unknown as jest.Mock;
    expect((mock.mock.calls[0][1] as any).headers['Range']).toBe('bytes=0-3');
    expect(result.status).toBe(206);
    expect(result.contentRange).toBe('bytes 0-3/1318886');
    expect(result.body).toEqual(slice);
  });

  it('rejects non-MGP asset URLs', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response('x', { status: 200 })) as unknown as typeof fetch;

    const adapter = new MgpProAdapter(fetchMock);
    await expect(adapter.proxyAsset('https://evil.com/steal.tif'))
      .rejects.toThrow('VENDOR_BAD_REQUEST');
  });

  it('throws VENDOR_AUTH_ERROR on 401', async () => {
    process.env.MGP_API_KEY = 'bad-key';
    const fetchMock = jest.fn(async () => new Response('Unauthorized', { status: 401 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await expect(adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } }))
      .rejects.toThrow('VENDOR_AUTH_ERROR');
  });

  it('throws VENDOR_UNAVAILABLE on 429', async () => {
    process.env.MGP_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response('Too Many Requests', { status: 429 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await expect(adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } }))
      .rejects.toThrow('VENDOR_UNAVAILABLE');
  });
});
