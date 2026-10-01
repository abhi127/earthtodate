import { BlackSkyAdapter } from './blacksky.adapter';

describe('BlackSkyAdapter', () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env = { ...origEnv };
  });

  const STAC_RESPONSE = {
    type: 'Collection',
    features: [
      {
        type: 'Feature',
        id: 'BSG-113-20230102-180537-57031794',
        geometry: { type: 'Polygon', coordinates: [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]] },
        properties: {
          datetime: '2023-01-02T18:05:37Z',
          vendorId: 'bsg',
          sensorId: 'global',
          offNadirAngle: 33.11487,
          sunAzimuth: 165.24736,
          sunElevation: 11.643179,
          gsd: 1.8967029,
          cloudPercent: 31.396051,
          productType: 'STANDARD',
          orthorectified: true,
          georeferenced: true,
        },
        assets: {
          browseUrl: { href: 'https://api.blacksky.com/v1/browse/BSG-113-20230102-180537-57031794.png', title: 'BrowseUrl' },
        },
      },
      {
        type: 'Feature',
        id: 'BSG-113-20230102-180550-57031795',
        geometry: { type: 'Polygon', coordinates: [[[77.2, 28.2], [77.3, 28.2], [77.3, 28.3], [77.2, 28.3], [77.2, 28.2]]] },
        properties: {
          datetime: '2023-01-02T18:05:50Z',
          vendorId: 'bsg',
          sensorId: 'global',
          offNadirAngle: null,
          gsd: 1.1,
          cloudPercent: null,
          productType: 'STANDARD',
        },
        assets: {},
      },
    ],
  };

  it('normalizes BlackSky STAC features to VendorSearchResult', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(STAC_RESPONSE), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    const results = await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      dateRange: { start: '2023-01-01', end: '2023-12-31' },
      cloudMax: 40,
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('BSG-113-20230102-180537-57031794');
    expect(results[0].vendor).toBe('blacksky');
    expect(results[0].cloudCover).toBe(31.396051);
    expect(results[0].offNadirAngle).toBe(33.11487);
    expect(results[0].resolution).toBe(1.8967029);
    expect(results[0].sensor).toBe('global');
    expect(results[0].previewUrl).toBe('https://api.blacksky.com/v1/browse/BSG-113-20230102-180537-57031794.png');
    expect(results[0].thumbnailUrl).toBe('https://api.blacksky.com/v1/browse/BSG-113-20230102-180537-57031794.png');
  });

  it('handles null optional fields gracefully', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(STAC_RESPONSE), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    const results = await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } });

    expect(results[1].cloudCover).toBeNull();
    expect(results[1].offNadirAngle).toBeNull();
    expect(results[1].previewUrl).toBeNull();
  });

  it('sends raw API key in Authorization header with correct query params', async () => {
    process.env.BLACKSKY_API_KEY = 'bs-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'Collection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    await adapter.search({
      aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] },
      dateRange: { start: '2023-01-01', end: '2023-12-31' },
      cloudMax: 40,
    });

    const mock = fetchMock as unknown as jest.Mock;
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('api.blacksky.com/v1/catalog/stac/search');
    expect(String(url)).toContain('bbox=77%2C28%2C77.3%2C28.3');
    expect(String(url)).toContain('time=2023-01-01%2F2023-12-31');
    expect(String(url)).toContain('cloudPercentTo=40');
    expect(String(url)).toContain('limit=50');
    expect((init as any).headers['Authorization']).toBe('bs-key');
  });

  it('converts polygon AOI to bbox', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'Collection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    await adapter.search({
      aoi: { type: 'Polygon', coordinates: [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]] },
    });

    const mock = fetchMock as unknown as jest.Mock;
    const [url] = mock.mock.calls[0];
    expect(String(url)).toContain('bbox=77%2C28%2C77.1%2C28.1');
  });

  it('omits cloudPercentTo when cloudMax is unset', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ type: 'Collection', features: [] }), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    await adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } });

    const mock = fetchMock as unknown as jest.Mock;
    const [url] = mock.mock.calls[0];
    expect(String(url)).not.toContain('cloudPercentTo');
  });

  it('proxies browse assets with the API key', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const pngBytes = Buffer.from([137, 80, 78, 71]);
    const fetchMock = jest.fn(async () => new Response(pngBytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    const result = await adapter.proxyAsset('https://api.blacksky.com/v1/browse/SCENE123.png');

    expect(result.body).toEqual(pngBytes);
    expect(result.contentType).toBe('image/png');
    expect(result.status).toBe(200);
    const mock = fetchMock as unknown as jest.Mock;
    expect((mock.mock.calls[0][1] as any).headers['Authorization']).toBe('test-key');
  });

  it('rejects non-BlackSky asset URLs', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response('x', { status: 200 })) as unknown as typeof fetch;

    const adapter = new BlackSkyAdapter(fetchMock);
    await expect(adapter.proxyAsset('https://evil.com/steal.png'))
      .rejects.toThrow('VENDOR_BAD_REQUEST');
  });

  it('throws VENDOR_AUTH_ERROR on 401', async () => {
    process.env.BLACKSKY_API_KEY = 'bad-key';
    const fetchMock = jest.fn(async () => new Response('Unauthorized', { status: 401 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    await expect(adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } }))
      .rejects.toThrow('VENDOR_AUTH_ERROR');
  });

  it('throws VENDOR_UNAVAILABLE on 429', async () => {
    process.env.BLACKSKY_API_KEY = 'test-key';
    const fetchMock = jest.fn(async () => new Response('Too Many Requests', { status: 429 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const adapter = new BlackSkyAdapter(fetchMock);
    await expect(adapter.search({ aoi: { type: 'BBox', bbox: [77.0, 28.0, 77.3, 28.3] } }))
      .rejects.toThrow('VENDOR_UNAVAILABLE');
  });
});
