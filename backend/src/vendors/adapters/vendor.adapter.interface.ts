export interface VendorSearchParams {
  aoi: { type: 'Polygon'; coordinates: number[][][] } | { type: 'BBox'; bbox: number[] };
  dateRange?: { start: string; end: string };
  cloudMax?: number;
  collections?: string[];
}

export interface VendorSearchResult {
  id: string;
  vendor: string;
  title: string;
  thumbnailUrl: string | null;
  footprint: { type: 'Polygon'; coordinates: number[][][] };
  acquisitionDate: string | null;
  cloudCover: number | null;
  offNadirAngle: number | null;
  resolution: number | null;
  sensor: string | null;
  price: number | null;
  previewUrl: string | null;
  rawProperties: Record<string, any>;
}

export interface VendorAdapter {
  getId(): string;
  getDisplayName(): string;
  search(params: VendorSearchParams): Promise<VendorSearchResult[]>;
}
