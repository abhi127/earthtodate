import { VendorsService } from './vendors.service';
import { VendorAdapter, VendorSearchParams, VendorSearchResult } from './adapters/vendor.adapter.interface';

function stubAdapter(id: string, results: VendorSearchResult[] | Error, calls: string[]): VendorAdapter {
  return {
    getId: () => id,
    getDisplayName: () => id,
    search: async (_params: VendorSearchParams) => {
      calls.push(id);
      if (results instanceof Error) throw results;
      return results;
    },
  };
}

function result(id: string, vendor: string, date: string | null): VendorSearchResult {
  return {
    id, vendor, title: id, thumbnailUrl: null,
    footprint: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    acquisitionDate: date, cloudCover: null, offNadirAngle: null,
    resolution: null, sensor: null, price: null, previewUrl: null, rawProperties: {},
  };
}

describe('VendorsService.searchAll', () => {
  const params: VendorSearchParams = { aoi: { type: 'BBox', bbox: [0, 0, 1, 1] } };

  function serviceWith(calls: string[], a: VendorSearchResult[] | Error, b: VendorSearchResult[] | Error) {
    const svc = new VendorsService();
    (svc as any).adapters = new Map<string, VendorAdapter>([
      ['a', stubAdapter('a', a, calls)],
      ['b', stubAdapter('b', b, calls)],
    ]);
    return svc;
  }

  it('merges results from all vendors sorted newest-first', async () => {
    const calls: string[] = [];
    const svc = serviceWith(calls,
      [result('a1', 'a', '2024-01-01T00:00:00Z')],
      [result('b1', 'b', '2025-06-01T00:00:00Z'), result('b2', 'b', null)],
    );

    const { results, errors } = await svc.searchAll(params);

    expect(errors).toEqual([]);
    expect(results.map(r => r.id)).toEqual(['b1', 'a1', 'b2']);
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  it('returns partial results when one vendor fails', async () => {
    const calls: string[] = [];
    const svc = serviceWith(calls,
      [result('a1', 'a', '2024-01-01T00:00:00Z')],
      new Error('VENDOR_UNAVAILABLE: boom'),
    );

    const { results, errors } = await svc.searchAll(params);

    expect(results.map(r => r.id)).toEqual(['a1']);
    expect(errors).toHaveLength(1);
    expect(errors[0].vendor).toBe('b');
  });

  it('caches repeat searches and does not re-hit vendors', async () => {
    const calls: string[] = [];
    const svc = serviceWith(calls, [result('a1', 'a', null)], []);

    await svc.searchAll(params);
    const second = await svc.searchAll(params);

    expect(calls).toEqual(['a', 'b']);
    expect(second.results.map(r => r.id)).toEqual(['a1']);
  });
});
