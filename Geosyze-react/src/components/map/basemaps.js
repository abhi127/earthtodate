// Shared basemap definitions — used by MapView (layer switching) and the
// sidebar basemap panel (thumbnail gallery).
// ponytail: static tile URLs for thumbnails — same tile coords across all sources gives visual comparison
export const BASEMAP_DEFS = [
  { id: 'osm',       name: 'OSM',     thumbnail: 'https://a.tile.openstreetmap.org/3/4/2.png' },
  { id: 'satellite', name: 'Esri',    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/4/2' },
  { id: 'terrain',   name: 'Terrain', thumbnail: 'https://tile.opentopomap.org/3/4/2.png' },
  { id: 'light',     name: 'CARTO',   thumbnail: 'https://a.basemaps.cartocdn.com/light_all/3/4/2.png' },
  { id: 'streets',   name: 'Streets', thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/3/4/2' },
  { id: 'dark',      name: 'Dark',    thumbnail: 'https://a.basemaps.cartocdn.com/dark_all/3/4/2.png' },
  { id: 'sentinel',  name: 'Sentinel', thumbnail: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/3/4/2.jpg' },
];
