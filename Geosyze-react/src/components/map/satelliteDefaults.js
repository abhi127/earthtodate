// Location used when the satellite panel opens and for its one-time default
// date lookup. The lookup intentionally stays here after the map moves.
export const SATELLITE_PANEL_START = Object.freeze({
  lat: 9.288526538492734,
  lon: 79.31664088146607,
});

// Resolution (m/px) the map settles at whenever the satellite panel opens.
export const SATELLITE_OPEN_RESOLUTION = 3.8;
