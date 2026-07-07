# Earth to Date — Satellite Imagery App (standalone)

A **map-first**, fully **standalone** web app for the *Earth to Date* satellite
imagery API. Every documented endpoint is implemented as a **mock** that runs
locally with **no external services and no credentials** — the tiles are
generated procedurally on the server, so the map shows continuous, seamless
"multispectral" imagery offline.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind + MapLibre GL**.

> This app was built to the *Earth to Date* OpenAPI 3.1 spec. It reuses the
> dark, refined aesthetic direction of the design handoff in the parent folder
> but with a fresh, map-centric layout suited to satellite imagery (rather than
> the ForgeCadNeo CAD screens, which are a different product).

---

## Run it

```bash
cd earth-to-date
npm install
npm run dev        # http://localhost:3000
# or a production build:
npm run build && npm run start
```

Open the app, pick a layer from the left catalog, and click the map to inspect.

---

## What's in it

### Map & layers
- Full-bleed MapLibre map with a dark base and a procedural raster imagery layer.
- **Complete `view` catalog** from the spec — searchable and grouped:
  - Sentinel-2 sensors (`s2`, `s2r2m`, `sr`, `s2dr`, `s2rr`, `s2r5m`) × TCI,
    14 band visualizations, and 40+ spectral indices.
  - Landsat (`ls15_tci`, `ls5_tci`), combined `r5m_tci`.
  - PlanetScope (`ps_tci`, `psrr_tci`).
  - Sentinel-1 SAR (`s1vv/s1vh` native + super-res).
  - Night lights (VIIRS) 25m / 500m × intensity / darkened / lighted.
  - High-value analytics (soil salinity/class/confidence, grassland biomass,
    soil moisture, background water-leak) and permission-gated mineral products.
  - Elevation (`dem`), `flood`, `s2_scl`, `changes_tci`, pollution overlay.
- Each view family has a distinct, physically-suggestive **colormap** and legend.
- Opacity slider + toggleable pollution overlay.

### Tools (right dock)
- **Inspect** — click the map to read elevation (DEM), air quality (AQI + PM/NO₂/O₃),
  and a place name for that point.
- **Dates** — available acquisition dates for the map center + active view,
  filtered by cloud cover.
- **Sightline** — pick two points to trace a terrain profile and test
  inter-visibility (line of sight), with an elevation chart.
- **AOI** — click two corners to define an area of interest, then download the
  imagery PNG or a GeoJSON shapefile-equivalent.
- **Mineral** — demonstrates the permission gate (403 → unlock with demo key).
- **Place search** in the top bar (forward geocode → fly to).

---

## Mock API (all endpoints from the spec)

Mounted under `/api`. Path/verb match the spec 1:1.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v2/{view}/{zoom}/{tile_x}/{tile_y}` | Imagery tile (PNG) — **Get Tile V2** |
| GET | `/api/pollution/{view}/{zoom}/{tile_x}/{tile_y}` | Pollution overlay tile |
| GET | `/api/pollution_value?lat_lon=LAT,LON` | AQI + pollutant readout |
| GET | `/api/pollution_geocode?q=NAME` \| `?lat_lon=LAT,LON` | Forward / reverse geocode |
| GET | `/api/dem_at_lat_lon?lat_lon=LAT,LON` | Elevation at a point |
| GET | `/api/los?p1=LAT,LON&p2=LAT,LON&obs_h=&tgt_h=` | Line of sight profile |
| GET | `/api/history_snapshot?lat_lon=&view=&zoom=` | Snapshot thumbnail (PNG) |
| GET | `/api/dates/{lat_lon}/{view}/{date_str}/{days_back}/{max_clouds}` | Available dates |
| GET | `/api/v2/download_aoi/{bbox}/{date}/{days_back}/{max_clouds}/{view}` | AOI imagery (PNG) |
| POST | `/api/download_shapefile/{date}/{days_back}/{max_clouds}/{view}` | GeoJSON export |
| GET | `/api/mineralmap` | Permission-gated (403; `?api_key=demo-mineral-access` to unlock) |

`bbox` = `minLat,minLon,maxLat,maxLon`.

### How the imagery is generated
`lib/tilegen.ts` samples a deterministic fractal-noise "world" (`lib/noise.ts`)
on absolute web-mercator pixel coordinates, so adjacent tiles are seamless and
panning/zooming reveals a continuous globe. Fields (elevation, vegetation,
moisture, city-lights) are mapped to a per-family colormap, then encoded to PNG
with a tiny dependency-free encoder (`lib/png.ts`, Node `zlib`). The DEM,
pollution, dates and line-of-sight endpoints sample the **same** world, so map
imagery and numeric readouts stay consistent.

---

## Project layout

```
app/
  page.tsx                 # map-first UI orchestrator
  layout.tsx, globals.css  # theme (Inter + JetBrains Mono, "Deep Field" palette)
  api/...                  # all mock endpoints (Node runtime)
components/
  MapCanvas.tsx            # MapLibre wrapper (imagery + overlays + markers)
  LayerCatalog.tsx         # searchable/grouped view catalog
  ToolDock.tsx             # inspect / dates / sightline / aoi / mineral
  Legend.tsx               # per-family legend
lib/
  views.ts                 # full view catalog + family inference
  tilegen.ts, noise.ts, png.ts   # procedural tile engine
  geo.ts, dates.ts         # geocode / pollution / dates helpers
```

All imagery is **synthetic** — geographic coordinates map to a procedural world,
not real places. Swap the `/api` routes for the real Earth to Date base URL to
go live.
