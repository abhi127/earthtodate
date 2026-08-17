// ponytail: static simplified boundary (preprocessed with mapshaper, 10.7MB -> 749KB)
const URL = 'geojson-dataset/india-composite-simplified.geojson';
const Z_INDEX = 1000;

const style = () => new window.ol.style.Style({
  stroke: new window.ol.style.Stroke({ color: '#585858', width: 1.5 }),
  fill: new window.ol.style.Fill({ color: 'rgba(0,0,0,0)' }),
});

export async function loadIndiaCompositeLayer(map) {
  const ol = window.ol;
  if (!ol || !map) return null;
  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(res.statusText);
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(await res.json(), { featureProjection: 'EPSG:3857' }),
      }),
      zIndex: Z_INDEX,
      style,
    });
    map.addLayer(layer);
    return layer;
  } catch (err) {
    console.warn('Failed to load India composite layer:', err);
    return null;
  }
}