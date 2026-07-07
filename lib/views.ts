// Full "view" catalog for the Earth to Date API.
// The `view` path parameter is shared across every tile / download endpoint.
// `family` drives the procedural colormap in the mock tile engine and the UI badge.

export type Family =
  | "tci"
  | "bandviz"
  | "index"
  | "sar"
  | "nightlight"
  | "pollution"
  | "dem"
  | "analytics"
  | "scl"
  | "flood"
  | "changes"
  | "mineral";

export interface ViewDef {
  id: string;
  label: string;
  group: string;
  family: Family;
  resolution?: string;
  notes?: string;
  gated?: boolean;
}

// ---- Sentinel-2 sensor grammar: {sensor}_{suffix} --------------------------

interface Sensor {
  id: string;
  res: string;
  notes: string;
  visual: boolean; // supports tci + band visualizations
  spectral: boolean; // supports spectral indices
}

const SENSORS: Sensor[] = [
  { id: "s2", res: "10m", notes: "Sentinel-2 native L2A", visual: true, spectral: true },
  { id: "s2r2m", res: "2m", notes: "Reconstructed (fused + deterministic 2× upscale)", visual: true, spectral: true },
  { id: "sr", res: "50cm", notes: "Super-resolution", visual: true, spectral: true },
  { id: "s2dr", res: "2m", notes: "Derived-Resolution (spectral only)", visual: false, spectral: true },
  { id: "s2rr", res: "1m", notes: "Refined Reality (visual only)", visual: true, spectral: false },
  { id: "s2r5m", res: "5m", notes: "Derived 5m", visual: true, spectral: true },
];

// Band visualizations (RGB combinations) — suffix -> [label, bands]
const BAND_VIZ: [string, string, string][] = [
  ["natural", "Natural color", "Red-Green-Blue"],
  ["veganalysis", "Vegetation analysis", "NIR-Red-Green"],
  ["cropsoil", "Crop / soil moisture", "NIR-SWIR-Red"],
  ["vegstress", "Vegetation stress", "SWIR-NIR-Red"],
  ["vegmoisture", "Vegetation + moisture", "SWIR-NIR-Green"],
  ["geology", "Geological features", "SWIR-NIR-Blue"],
  ["urban", "Urban / rock", "NIR-SWIR-Blue"],
  ["water", "Water bodies", "NIR-Red-Blue"],
  ["watercontent", "Water content", "SWIR-Red-Green"],
  ["atmosphere", "Atmospheric haze", "NIR-Green-Blue"],
  ["burnscar", "Burn scars", "SWIR2-NIR-Red"],
  ["snow", "Snow / ice", "SWIR-Red-Green"],
  ["bathymetric", "Bathymetric", "Red-Green-Blue"],
  ["drought", "Drought", "SWIR2-SWIR1-Red"],
];

// Spectral indices (single-band scalar maps) — suffix -> [label, description]
const INDICES: [string, string, string][] = [
  ["ndvi", "NDVI", "Vegetation health"],
  ["ndwi", "NDWI", "Surface water content"],
  ["ndmi", "NDMI", "Canopy moisture"],
  ["savi", "SAVI", "Soil-adjusted vegetation"],
  ["msavi", "MSAVI", "Modified SAVI"],
  ["msavi2", "MSAVI2", "Second-order MSAVI"],
  ["osavi", "OSAVI", "Optimized SAVI"],
  ["tsavi", "TSAVI", "Transformed SAVI"],
  ["evi", "EVI", "Enhanced vegetation"],
  ["evi2", "EVI2", "Two-band EVI"],
  ["nbr", "NBR", "Burn ratio"],
  ["nbr2", "NBR2", "Alternative burn ratio"],
  ["ndre", "NDRE", "Red-edge NDVI"],
  ["ndre2", "NDRE2", "Red-edge variant"],
  ["ndre3", "NDRE3", "Red-edge variant"],
  ["rendvi", "RENDVI", "Red-edge normalized difference"],
  ["cire", "CIRE", "Chlorophyll index, red-edge"],
  ["cire2", "CIRE2", "Chlorophyll variant"],
  ["cire3", "CIRE3", "Chlorophyll variant"],
  ["cig", "CIG", "Chlorophyll index, green"],
  ["gndvi", "GNDVI", "Green NDVI"],
  ["rvi", "RVI", "Ratio VI (NIR/Red)"],
  ["dvi", "DVI", "Difference VI"],
  ["rdvi", "RDVI", "Renormalized DVI"],
  ["pvi", "PVI", "Perpendicular VI"],
  ["ipvi", "IPVI", "Infrared percentage VI"],
  ["grvi", "GRVI", "Green-Red VI"],
  ["sr", "SR", "Simple ratio"],
  ["sr2", "SR2", "Simple ratio variant"],
  ["sipi", "SIPI", "Structure-insensitive pigment"],
  ["ari", "ARI", "Anthocyanin reflectance"],
  ["cri1", "CRI1", "Carotenoid reflectance"],
  ["cri2", "CRI2", "Carotenoid variant"],
  ["mcari", "MCARI", "Modified chlorophyll absorption"],
  ["tcari", "TCARI", "Transformed chlorophyll absorption"],
  ["mre", "MRE", "Modified red edge"],
  ["tre", "TRE", "Transformed red edge"],
  ["mtvi", "MTVI", "Modified triangular VI"],
  ["mtvi2", "MTVI2", "Modified triangular VI 2"],
  ["tvi", "TVI", "Triangular VI"],
  ["ndsi", "NDSI", "Normalized difference soil"],
  ["bsi", "BSI", "Bare soil"],
  ["lai", "LAI", "Leaf area index"],
  ["cwc", "CWC", "Canopy water content (g/m²)"],
];

function s2Views(): ViewDef[] {
  const out: ViewDef[] = [];
  for (const s of SENSORS) {
    const groupName = `Sentinel-2 · ${s.id} (${s.res})`;
    // tci
    if (s.visual) {
      out.push({
        id: `${s.id}_tci`,
        label: `${s.id} · True color (TCI)`,
        group: groupName,
        family: "tci",
        resolution: s.res,
        notes: s.notes,
      });
      for (const [suf, label, bands] of BAND_VIZ) {
        out.push({
          id: `${s.id}_${suf}`,
          label: `${s.id} · ${label}`,
          group: groupName,
          family: "bandviz",
          resolution: s.res,
          notes: `${bands} — ${s.notes}`,
        });
      }
    }
    if (s.spectral) {
      for (const [suf, name, desc] of INDICES) {
        out.push({
          id: `${s.id}_${suf}`,
          label: `${s.id} · ${name}`,
          group: groupName,
          family: "index",
          resolution: s.res,
          notes: `${name} — ${desc}`,
          gated: suf === "mineralclass",
        });
      }
      // permission-gated mineral classification lives on the index endpoint
      out.push({
        id: `${s.id}_mineralclass`,
        label: `${s.id} · Mineral classification`,
        group: groupName,
        family: "mineral",
        resolution: s.res,
        notes: "Mineral classification (permission-gated)",
        gated: true,
      });
    }
  }
  return out;
}

// ---- Other platforms -------------------------------------------------------

const LANDSAT: ViewDef[] = [
  { id: "ls15_tci", label: "Landsat · Pansharpened (15m)", group: "Landsat", family: "tci", resolution: "15m", notes: "Pansharpened Landsat" },
  { id: "ls5_tci", label: "Landsat · Upscaled (5m)", group: "Landsat", family: "tci", resolution: "5m", notes: "Upscaled from 15m" },
];

const COMBINED: ViewDef[] = [
  { id: "r5m_tci", label: "S2+Landsat · 5m auto-select", group: "Combined S2 + Landsat", family: "tci", resolution: "5m", notes: "Auto-selects S2 (5m) or Landsat (5m) per date for best temporal coverage" },
];

const PLANETSCOPE: ViewDef[] = [
  { id: "ps_tci", label: "PlanetScope · Native (3m)", group: "PlanetScope", family: "tci", resolution: "3m", notes: "Native PlanetScope tile" },
  { id: "psrr_tci", label: "PlanetScope · Refined Reality (1.9m)", group: "PlanetScope", family: "tci", resolution: "1.9m", notes: "Refined Reality super-res ×2" },
];

const SAR: ViewDef[] = [
  { id: "s1vv_tci", label: "Sentinel-1 · VV (10m)", group: "Sentinel-1 SAR", family: "sar", resolution: "10m", notes: "VV polarization · native raw" },
  { id: "s1vh_tci", label: "Sentinel-1 · VH (10m)", group: "Sentinel-1 SAR", family: "sar", resolution: "10m", notes: "VH polarization · native raw" },
  { id: "s1vvsr_tci", label: "Sentinel-1 · VV super-res (1m)", group: "Sentinel-1 SAR", family: "sar", resolution: "1m", notes: "VV · super-resolved" },
  { id: "s1vhsr_tci", label: "Sentinel-1 · VH super-res (1m)", group: "Sentinel-1 SAR", family: "sar", resolution: "1m", notes: "VH · super-resolved" },
];

const NIGHTLIGHT: ViewDef[] = [
  { id: "nightlight25m_tci", label: "Night light · 25m intensity", group: "Night light (VIIRS)", family: "nightlight", resolution: "25m", notes: "Grayscale light intensity" },
  { id: "nightlight25m_darkened", label: "Night light · 25m darkened", group: "Night light (VIIRS)", family: "nightlight", resolution: "25m", notes: "Terrain darkened where no light" },
  { id: "nightlight25m_lighted", label: "Night light · 25m lighted", group: "Night light (VIIRS)", family: "nightlight", resolution: "25m", notes: "Golden highlights where lights are" },
  { id: "nightlight500m_tci", label: "Night light · 500m intensity", group: "Night light (VIIRS)", family: "nightlight", resolution: "500m", notes: "Grayscale light intensity" },
  { id: "nightlight500m_darkened", label: "Night light · 500m darkened", group: "Night light (VIIRS)", family: "nightlight", resolution: "500m", notes: "Terrain darkened where no light" },
  { id: "nightlight500m_lighted", label: "Night light · 500m lighted", group: "Night light (VIIRS)", family: "nightlight", resolution: "500m", notes: "Golden highlights where lights are" },
];

const ANALYTICS: ViewDef[] = [
  { id: "s2r2m_soilsalinity", label: "Soil salinity score (0–100)", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Soil salinity score" },
  { id: "s2r2m_soilsalinityclass", label: "Soil salinity classes", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Categorical salinity classes" },
  { id: "s2r2m_soilsalinityconfidence", label: "Soil salinity confidence", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Model confidence for salinity estimate" },
  { id: "s2r2m_biomassgrassland", label: "Grassland biomass (kg/ha)", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Pasture / rangeland biomass" },
  { id: "s2r2m_soilmoisture", label: "Surface soil moisture", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Surface soil-moisture estimate" },
  { id: "s2r2m_bgwaterleak", label: "Background water-leak warnings", group: "Analytics (2m reconstructed)", family: "analytics", resolution: "2m", notes: "Subsurface / background water-leak warnings" },
  { id: "s2r2m_mineralmap", label: "Mineral map", group: "Analytics (2m reconstructed)", family: "mineral", resolution: "2m", notes: "Mineral map (permission-gated)", gated: true },
  { id: "s2r2m_mineralclass", label: "Mineral classification", group: "Analytics (2m reconstructed)", family: "mineral", resolution: "2m", notes: "Mineral classification (permission-gated)", gated: true },
];

const OTHER: ViewDef[] = [
  { id: "dem", label: "Elevation (DEM)", group: "Elevation & other", family: "dem", resolution: "1m", notes: "ETD elevation dataset · 0.5–1m vertical accuracy" },
  { id: "flood", label: "Flood simulation", group: "Elevation & other", family: "flood", notes: "Flood simulation" },
  { id: "s2_scl", label: "Scene Classification (SCL)", group: "Elevation & other", family: "scl", notes: "Cloud / shadow / etc classification" },
  { id: "changes_tci", label: "Change detection", group: "Elevation & other", family: "changes", notes: "Change detection between two dates" },
];

const POLLUTION: ViewDef[] = [
  { id: "pollution", label: "Pollution overlay", group: "Pollution", family: "pollution", notes: "Air-quality pollution overlay" },
];

export const VIEWS: ViewDef[] = [
  ...s2Views(),
  ...LANDSAT,
  ...COMBINED,
  ...PLANETSCOPE,
  ...SAR,
  ...NIGHTLIGHT,
  ...ANALYTICS,
  ...OTHER,
  ...POLLUTION,
];

const BY_ID = new Map(VIEWS.map((v) => [v.id, v]));

export function getView(id: string): ViewDef | undefined {
  return BY_ID.get(id);
}

// Family inference for arbitrary view strings (mock tile route accepts any).
export function familyForView(id: string): Family {
  const known = BY_ID.get(id);
  if (known) return known.family;
  const suffix = id.split("_").slice(1).join("_") || id;
  if (id.startsWith("s1")) return "sar";
  if (id.startsWith("nightlight")) return "nightlight";
  if (id === "dem") return "dem";
  if (id === "flood") return "flood";
  if (id.includes("scl")) return "scl";
  if (id.includes("changes")) return "changes";
  if (id.includes("mineral")) return "mineral";
  if (id.startsWith("pollution")) return "pollution";
  if (id.includes("soil") || id.includes("biomass") || id.includes("waterleak")) return "analytics";
  if (INDICES.some(([s]) => s === suffix)) return "index";
  if (BAND_VIZ.some(([s]) => s === suffix)) return "bandviz";
  return "tci";
}

export const VIEW_GROUPS = Array.from(
  VIEWS.reduce((m, v) => {
    if (!m.has(v.group)) m.set(v.group, []);
    m.get(v.group)!.push(v);
    return m;
  }, new Map<string, ViewDef[]>())
).map(([group, views]) => ({ group, views }));
