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
          gsd: 0.5,
          platform: 'wv02',
        },
        assets: {
          thumbnail: { href: 'https://example.com/thumb.jpg' },
          preview: { href: 'https://example.com/preview.jpg' },
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
    expect(results[0].cloudCover).toBe(5.0);
    expect(results[0].offNadirAngle).toBe(12.5);
    expect(results[0].resolution).toBe(0.5);
    expect(results[0].sensor).toBe('wv02');
    expect(results[0].thumbnailUrl).toBe('https://example.com/thumb.jpg');
    expect(results[0].previewUrl).toBe('https://example.com/preview.jpg');
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
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new MgpProAdapter(fetchMock);
    await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      dateRange: { start: '2025-01-01', end: '2025-12-31' },
      cloudMax: 15,
      collections: ['wv02'],
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
