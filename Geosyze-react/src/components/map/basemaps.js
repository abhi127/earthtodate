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

const BASEMAP_NAMES = {
  osm: 'OSM', satellite: 'Esri', terrain: 'Terrain',
  light: 'CARTO', streets: 'Streets', dark: 'Dark', sentinel: 'Sentinel',
};
const BASEMAP_IDS = Object.keys(BASEMAP_NAMES);

function createBasemapSource(ol, id) {
  const map = {
    osm: () => new ol.source.OSM(),
    satellite: () => new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, attributions: '&copy; Esri',
    }),
    terrain: () => new ol.source.XYZ({
      url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17, attributions: '&copy; OpenTopoMap',
    }),
    light: () => new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      maxZoom: 19, attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
    }),
    streets: () => new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, attributions: '&copy; Esri',
    }),
    dark: () => new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      maxZoom: 19, attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
    }),
    sentinel: () => new ol.source.XYZ({
      url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
      maxZoom: 14,
      attributions: 'Sentinel-2 cloudless - <a href="https://s2maps.eu">EOX</a> (Contains modified Copernicus Sentinel data)',
    }),
  };
  return (map[id] || map.osm)();
}

export { BASEMAP_NAMES, BASEMAP_IDS, createBasemapSource };
