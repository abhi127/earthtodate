# Dropdown System → ViewType Mapping

## Overview

The UI has a cascading dropdown system that produces a `viewtype` string. This string is the internal identifier used for tile fetching, URL serialization, and map rendering.

There are **two dropdown systems**:

1. **New system** (`createNewDropdownSystem`) — primary, shown to users
2. **Old system** (`viewoptions`/`resolutionSelect`) — hidden, kept for backward compatibility

This document covers only the **new system**.

---

## Dropdown Hierarchy

```
Product ─┬─ Visual ────────────── Sensor ──────────────► viewtype = <sensor>_tci
          ├─ Spectral ─────────── Sensor + Spectral ───► viewtype = <sensor><spectral>
          ├─ SAR ──────────────── SAR Subview ─────────► viewtype = s1<subview>_tci
          ├─ Night Light ──────── Night Light Res ─────► viewtype = <nightlight_opt>
          ├─ Soil Salinity ────── Salinity Type ───────► viewtype = s2r2m<salinity>
          ├─ Pollution ────────── Gas + Σ/Δ toggle ───► viewtype = pollution[gas][_delta]_overlay
          ├─ New Construction ─── Months ago ──────────► viewtype = newconstruction_tci
          ├─ Isometric ────────────────────────────────► viewtype = isometric
          ├─ Flood Simulation ─────────────────────────► viewtype = flood
          └─ (direct products, no sub-dropdown) ───────► viewtype = <product>
```

---

## Product → ViewType Mapping

### 1. Visual

| Sensor Key       | Sensor Label                        | Resulting ViewType     |
|------------------|-------------------------------------|------------------------|
| `s2rr`           | 1m Refined Reality                  | `s2rr_tci`             |
| `sr`             | 50cm super-res x2                   | `sr_tci`               |
| `r5m`            | 5m Combined                         | `r5m_tci`              |
| `s2r5m`          | 5m Sentinel-2                       | `s2r5m_tci`            |
| `s2`             | 10m Sentinel-2                      | `s2_tci`               |
| `ls15`           | 15m Landsat                         | `ls15_tci`             |
| `ls5`            | 5m Landsat                          | `ls5_tci`              |
| `ps`             | 3m PlanetScope                      | `ps_tci`               |
| `psrr`           | 1.9m PlanetScope Refined Reality    | `psrr_tci`             |
| `pssrx2`         | 1.5m PlanetScope x2 Super-Res       | `pssrx2_tci`           |
| `pssrx4`         | 0.75m PlanetScope x4 Super-Res      | `pssrx4_tci`           |
| `cbers4a`        | 2m CBERS-4A                         | `cbers4a_tci`          |
| `cbers4arr`      | 1m CBERS-4A Refined Reality         | `cbers4arr_tci`        |
| `<subdir>`       | Custom imagery subdirectory         | `<subdir>_tci`         |
| `<subdir>sr`     | Custom imagery Refined Reality      | `<subdir>sr_tci`       |

**Notes:**
- `r5m` (5m Combined) auto-selects between S2 and Landsat per date at tile-load time, tracked via `props._r5m_actual`.
- `s2dr` is hidden in Visual mode (spectral-only sensor).
- Default sensor when none selected: `s2`.

### 2. Spectral

| Sensor | Allowed? | Spectral Key    | Spectral Label                        | Resulting ViewType             |
|--------|----------|-----------------|---------------------------------------|--------------------------------|
| `s2`   | ✅       | `_ndvi`         | NDVI - Vegetation Health Index        | `s2_ndvi`                      |
| `s2`   | ✅       | `_ndwi`         | NDWI - Water Content Index            | `s2_ndwi`                      |
| `s2`   | ✅       | ... 50+ others  | (see spectralOptions in ui.js)        | `s2_<spectral>`                |
| `s2dr` | ✅       | `_ndvi`         | NDVI - Vegetation Health Index        | `s2dr_ndvi`                    |
| `s2dr` | ✅       | ...             |                                       | `s2dr_<spectral>`              |
| (any)  | ❌       | `_mineralclass` | Mineral Classification                | `s2r2m_mineralclass` (special) |

**Only `s2` and `s2dr` sensors are available in Spectral mode.** All other sensors are hidden.

The `_mineralclass` option ignores the sensor selection entirely and always uses `s2r2m`.

### 3. SAR (Sentinel-1 / NISAR)

| Subview Key     | Subview Label                          | Resulting ViewType         |
|-----------------|----------------------------------------|----------------------------|
| `vvsr`          | Sentinel-1 VV 2m SR (Beta)             | `s1vvsr_tci`               |
| `vhsr`          | Sentinel-1 VH 2m SR (Beta)             | `s1vhsr_tci`               |
| `vvdenoised`    | Sentinel-1 VV denoised (Beta)          | `s1vvdenoised_tci`         |
| `vhdenoised`    | Sentinel-1 VH denoised (Beta)          | `s1vhdenoised_tci`         |
| `vv`            | Sentinel-1 VV 10m (Beta)               | `s1vv_tci`                 |
| `vh`            | Sentinel-1 VH 10m (Beta)               | `s1vh_tci`                 |
| `nisar_hh`      | NISAR HH 5-10m (L-band, Beta)          | `nisar_hh_tci`             |
| `nisar_hv`      | NISAR HV 5-10m (L-band, Beta)          | `nisar_hv_tci`             |
| `shipdetection` | Ship Detection                         | `shipdetection_tci`        |

**Notes:**
- `vvdenoised` and `vhdenoised` are hidden from the dropdown (internal only).
- NISAR subviews use the `nisar_` prefix directly; others get `s1` prefix + `_tci` suffix.
- Ship detection is a standalone viewtype (not `s1`-prefixed).

### 4. Night Light

| Nightlight Option              | Resulting ViewType              |
|--------------------------------|---------------------------------|
| `nightlight25m_darkened`       | `nightlight25m_darkened`        |
| `nightlight25m_lighted`        | `nightlight25m_lighted`         |
| `nightlight25m_tci`            | `nightlight25m_tci`             |
| `nightlight500m_darkened`      | `nightlight500m_darkened`       |
| `nightlight500m_lighted`       | `nightlight500m_lighted`        |
| `nightlight500m_tci`           | `nightlight500m_tci`            |

The key IS the viewtype (no prefix/suffix transformation).

### 5. Soil Salinity

| Salinity Option              | Label                           | Resulting ViewType                 |
|------------------------------|---------------------------------|------------------------------------|
| `_soilsalinity`              | Soil Salinity Score (0-100)     | `s2r2m_soilsalinity`               |
| `_soilsalinityclass`         | Soil Salinity Categories        | `s2r2m_soilsalinityclass`          |
| `_soilsalinityconfidence`    | Soil Salinity Confidence        | `s2r2m_soilsalinityconfidence`     |

Fixed sensor: `s2r2m` always (no sensor dropdown shown).

### 6. Pollution (Sentinel-5P)

| Gas Key       | Gas Label          | Σ Mode (default)                | Δ Mode (toggle)                      |
|---------------|--------------------|----------------------------------|--------------------------------------|
| `_combined`   | Combined (all)     | `pollution_overlay`              | `pollution_delta_overlay`            |
| `_no2`        | NO₂                | `pollution_no2_overlay`          | `pollution_no2_delta_overlay`        |
| `_so2`        | SO₂                | `pollution_so2_overlay`          | `pollution_so2_delta_overlay`        |
| `_co`         | CO                 | `pollution_co_overlay`           | `pollution_co_delta_overlay`         |
| `_ch4`        | CH₄                | `pollution_ch4_overlay`          | `pollution_ch4_delta_overlay`        |
| `_hcho`       | HCHO               | `pollution_hcho_overlay`         | `pollution_hcho_delta_overlay`       |
| `_aer_ai`     | Aerosol Index      | `pollution_aer_ai_overlay`       | `pollution_aer_ai_delta_overlay`     |

Composite mode is toggled via `pollutionModeToggle` button (Σ ↔ Δ), controlled by `window.pollutionCompositeMode`.

### 7. Direct Products (no sub-dropdown)

| Product Key             | Product Label                              | Resulting ViewType          |
|-------------------------|--------------------------------------------|-----------------------------|
| `isometric`             | Isometric                                  | `isometric`                 |
| `changes_tci`           | Change Detection                           | `changes_tci`               |
| `_scl`                  | Scene Classification                       | `s2_scl`                    |
| `map`                   | Open Street Map                            | `map`                       |
| `aerial`                | Aerial                                     | `aerial`                    |
| `esriworldimagery`      | ESRI World Imagery                         | `esriworldimagery`          |
| `basemap`               | Basemap                                    | `basemap`                   |
| `dem`                   | Elevation Map                              | `dem`                       |
| `worldcover`            | WorldCover (ESA 2021)                      | `worldcover`                |
| `_soilmoisture`         | Soil Moisture                              | `s2r2m_soilmoisture`        |
| `_bgwaterleak`          | Water Leak Warnings                        | `s2r2m_bgwaterleak`         |
| `_biomassgrassland`     | Grassland Biomass                          | `s2r2m_biomassgrassland`    |
| `_lulc`                 | Land Cover Classification                  | `s2r2m_lulc`                |
| `_mineralmap`           | Mineral Map                                | `s2r2m_mineralmap`          |
| `newconstruction`       | New Construction                           | `newconstruction_tci`       |
| `flood`                 | Flood Simulation                           | `flood`                     |

**Notes:**
- Products prefixed with `_` (`_soilmoisture`, `_lulc`, etc.) always use `s2r2m` as the sensor — no sensor dropdown shown.
- `_scl` always uses `s2_scl` (not `s2r2m`).
- `newconstruction` additionally stores `props.months` (from the months-ago dropdown).

---

## ViewType → Dropdown Reverse Mapping

The function `setNewDropdownsFromViewtype(viewtype)` parses a viewtype string and sets all dropdowns to match. This is used on page load (deep-link URL restore) and when syncing views.

### Parsing Logic (in priority order)

| ViewType Pattern                     | Product         | Sub-dropdown(s) Set                      |
|--------------------------------------|-----------------|------------------------------------------|
| `pollution*_delta_overlay`           | `pollution`     | gas from middle segment, mode=delta      |
| `pollution*_overlay`                 | `pollution`     | gas from middle segment, mode=abs        |
| `shipdetection_tci`                  | `s1`            | subview=`shipdetection`                  |
| `s1*_tci`                            | `s1`            | subview = after `s1`, before `_tci`      |
| `nisar_*_tci`                        | `s1`            | subview = `nisar_*`                      |
| `changes_tci`                        | `changes_tci`   | —                                        |
| `s2_scl`                             | `_scl`          | —                                        |
| `map`                                | `map`           | —                                        |
| `aerial`                             | `aerial`        | —                                        |
| `esriworldimagery`                   | `esriworldimagery`| —                                      |
| `basemap`                            | `basemap`       | —                                        |
| `isometric`                          | `isometric`     | —                                        |
| `dem`                                | `dem`           | —                                        |
| `worldcover`                         | `worldcover`    | —                                        |
| `*_soilmoisture`                     | `_soilmoisture` | —                                        |
| `*_fieldanomaly`                     | `_fieldanomaly` | —                                        |
| `*_bgwaterleak`                      | `_bgwaterleak`  | —                                        |
| `flood`                              | `flood`         | —                                        |
| `nightlight*`                        | `nightlight`    | nightlight option = full viewtype        |
| `*_biomassgrassland`                 | `_biomassgrassland`| —                                      |
| `*_soilsalinity*`                    | `soilsalinity`  | salinity type = `_<rest>`                |
| `*_lulc`                             | `_lulc`         | —                                        |
| `newconstruction*`                   | `newconstruction`| months from `props.months`              |
| `*_mineralmap`                       | `_mineralmap`   | —                                        |
| `*_mineralclass`                     | `spectral`      | spectral=`_mineralclass`                 |
| `*_tci`                              | `visual`        | sensor = prefix before `_tci`            |
| (fallback) split on `_`, test parts  | `spectral` or `visual` | sensor + spectral parsed          |

---

## Sensor Options (full list for Visual mode)

From `sensorOptions` object + dynamic imagery subdirectories:

| Key           | Label                                | Available in Visual | Available in Spectral |
|---------------|--------------------------------------|---------------------|----------------------|
| `s2rr`        | 1m Refined Reality                   | ✅                  | ❌                   |
| `sr`          | 50cm super-res x2                    | ✅                  | ❌                   |
| `r5m`         | 5m Combined                          | ✅                  | ❌                   |
| `s2r5m`       | 5m Sentinel-2                        | ✅                  | ❌                   |
| `s2`          | 10m Sentinel-2                       | ✅                  | ✅                   |
| `s2dr`        | 2m Derived Resolution                | ❌                  | ✅                   |
| `ls15`        | 15m Landsat                          | ✅                  | ❌                   |
| `ls5`         | 5m Landsat                           | ✅                  | ❌                   |
| `ps`          | 3m PlanetScope                       | ✅                  | ❌                   |
| `psrr`        | 1.9m PlanetScope Refined Reality     | ✅                  | ❌                   |
| `pssrx2`      | 1.5m PlanetScope x2 Super-Res        | ✅                  | ❌                   |
| `pssrx4`      | 0.75m PlanetScope x4 Super-Res       | ✅                  | ❌                   |
| `cbers4a`     | 2m CBERS-4A                          | ✅                  | ❌                   |
| `cbers4arr`   | 1m CBERS-4A Refined Reality          | ✅                  | ❌                   |
| `<subdir>`    | (dynamic imagery subdirectories)     | ✅                  | ❌                   |
| `<subdir>sr`  | (dynamic imagery, Refined Reality)   | ✅                  | ❌                   |

---

## Per-Product Dropdown Visibility

| Product              | Sensor shown? | Spectral shown? | Sub-dropdown shown?         | Date controls shown? |
|----------------------|---------------|-----------------|-----------------------------|----------------------|
| `visual`             | ✅            | ❌              | —                           | ✅                    |
| `spectral`           | ✅ (filtered) | ✅              | —                           | ✅                    |
| `s1`                 | ❌            | ❌              | SAR subview                 | ✅                    |
| `nightlight`         | ❌            | ❌              | Nightlight res              | ✅                    |
| `soilsalinity`       | ❌            | ❌              | Salinity type               | ✅                    |
| `pollution`          | ❌            | ❌              | Gas + Σ/Δ toggle            | ❌ (hidden)           |
| `newconstruction`    | ❌            | ❌              | Months ago                  | ✅                    |
| `isometric`          | ❌            | ❌              | —                           | ✅                    |
| `flood`              | ❌            | ❌              | —                           | ✅                    |
| `_scl`, `map`, `aerial`, `esriworldimagery`, `basemap`, `dem`, `worldcover` | ❌ | ❌ | — | ❌ (hidden) |
| `_soilmoisture`, `_bgwaterleak`, `_biomassgrassland`, `_lulc`, `_mineralmap` | ❌ | ❌ | — | ✅ |

---

## Date Controls Visibility

| Condition                                  | Date controls shown? |
|--------------------------------------------|----------------------|
| Product is `map`, `aerial`, `esriworldimagery`, `basemap`, `dem`, `worldcover`, `pollution` | ❌ |
| Sensor is a custom imagery subdirectory (or its SR variant) | ❌ |
| Everything else (visual, spectral, SAR, etc.) | ✅ |

For external imagery, if the date is invalid (< 2000 or > 2030), it's coerced to today so the date picker stays usable when switching to a date-driven view.

---

## URL Serialization

Viewtypes are serialized in the URL path as:

```
/z<zoom>,<lat>,<lon>/<view1type>:<date>-<days_back>@<max_clouds>,<view2type>:<date>-<days_back>@<max_clouds>
```

Example:
```
/z14,46.49,6.4618/s2rr_tci:2024-11-20-365@10,ps_tci:2024-11-20-5@100
```

Special cases:
- **New Construction**: `months` is NOT serialized in URL (re-reads from dropdown).
- **Pollution mode** (Σ/Δ): NOT serialized in URL (uses `window.pollutionCompositeMode`).
- **Imagery subdirectories**: Date is coerced to today if invalid; the `sr` variant pairs with the base subdirectory across views.
