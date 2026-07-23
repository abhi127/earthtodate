# Draw Interaction Pill & Export Feature

## Overview
Add a center-top pill notification when a draw interaction is active, with export functionality accessible from both the pill and the MenuBar. Coordinate between Draw and Measure interactions so only one is active at a time.

## Design

### Architecture
```
MapPage (routes menu actions)
  └── MapView.jsx
        ├── drawType state (null | 'point' | 'line' | 'polygon')
        ├── deactivateDraw() extracted from useImperativeHandle
        ├── cancelMeasureRef (ref set by MeasureTool)
        ├── Pill JSX (conditional on drawType)
        │     ├── Label: "Drawing {Type}"
        │     ├── Export ▼ dropdown (6 formats)
        │     └── × button → calls deactivateDraw()
        ├── MeasureTool.jsx (receives coord props)
        └── MapControls.jsx
```

### Files Changed
| File | Change |
|------|--------|
| `MapView.jsx` | Add pill UI, export function, extracted deactivateDraw, coordination with MeasureTool |
| `MapView.module.css` | Pill + export dropdown styles |
| `MeasureTool.jsx` | Accept `measureCancelRef` + `onBeforeMeasureStart` props |
| `MapPage.jsx` | Wire export menu actions |
| `MenuBar.jsx` | Expand Export submenu to 6 formats |
| `package.json` | Add `jszip` dependency |

### Pill UI
```
┌──────────────────────────────────────┐
│  Drawing Polygon    Export ▼    ×    │
└──────────────────────────────────────┘
```
- Centered at top of map (absolute, left:50%, translateX(-50%))
- Dark surface bg matching existing overlay style
- Export ▼ opens inline dropdown with format list
- × removes draw interaction + hides pill
- Visible only while drawType is non-null

### Export Formats
| Format | Implementation | External Deps |
|--------|---------------|---------------|
| GeoJSON | `ol.format.GeoJSON().writeFeatures()` | Built-in OL |
| KML | `ol.format.KML().writeFeatures()` | Built-in OL |
| GPX | `ol.format.GPX().writeFeatures()` | Built-in OL |
| CSV | Manual: header row + WKT geometry column | Zero |
| WKT | `ol.format.WKT().writeFeatures()` | Built-in OL |
| Shapefile (.zip) | Write .shp/.shx/.dbf/.prj, zip with jszip | `jszip` |

All formats share a single `exportFeatures(format)` function that reads from `vectorSource.current`.

### Draw ↔ Measure Coordination
- **Draw starts while measuring**: `activateDraw()` calls `cancelMeasureRef.current?.()` first
- **Measure starts while drawing**: MeasureTool calls `onBeforeMeasureStart()` at top of `startMeasuring()`, which deactivates any active draw

### MenuBar Export Structure
```
File > Export
  ├─ GeoJSON
  ├─ KML
  ├─ GPX
  ├─ CSV
  ├─ WKT
  └─ Shapefile (.zip)
```

### Edge Cases
| Scenario | Behavior |
|----------|----------|
| Double-click same draw type | Interaction replaced, pill stays |
| Switch draw types (Point→Line) | Old interaction removed, label updates |
| Draw active + X clicked | Interaction removed, pill gone |
| Draw active + Measure clicked | Draw cancelled, pill gone, measure starts |
| Measure active + Draw clicked | Measure cancelled, draw starts, pill shows |
| Export with no features | No-op (null check on empty source) |
| Shapefile export | Trigger download of .zip |
