// Verifies the satellite z12 floor against the installed OpenLayers version.
// Source minZoom clamps lower map zooms to z12; the layer floor must keep that
// clamped tile out of the render queue while still allowing z12 itself.
import assert from 'node:assert/strict';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import { inView } from 'ol/layer/Layer.js';
import XYZ from 'ol/source/XYZ.js';

const SATELLITE_MIN_ZOOM = 12;
const view = new View({ center: [0, 0], zoom: 9.9 });
const source = new XYZ({
  url: '/api/tiles/v2/{z}/{x}/{y}',
  minZoom: SATELLITE_MIN_ZOOM,
  maxZoom: 21,
});
const grid = source.getTileGridForProjection(view.getProjection());

// This clamp is the original bug: z9.9 does not hide the source, it selects z12.
assert.equal(grid.getZForResolution(view.getResolution()), SATELLITE_MIN_ZOOM);

const layer = new TileLayer({
  source,
  // Layer minZoom is exclusive; this keeps z12 itself renderable.
  minZoom: SATELLITE_MIN_ZOOM - 0.001,
});
assert.equal(inView(layer.getLayerState(true), view.getState()), false);

view.setZoom(SATELLITE_MIN_ZOOM);
assert.equal(inView(layer.getLayerState(true), view.getState()), true);

console.log('satellite zoom floor: OK');
