// Coords used for /api/tiles/dates lookups: the map's current view center
// when available, else the fixed fallback (e.g. panel start location).
export function resolveDatesLocation(viewCenter, fallback) {
  if (
    viewCenter &&
    Number.isFinite(viewCenter.lat) &&
    Number.isFinite(viewCenter.lon)
  ) {
    return { lat: viewCenter.lat, lon: viewCenter.lon };
  }
  return { lat: fallback.lat, lon: fallback.lon };
}
