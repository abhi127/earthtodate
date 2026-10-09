// Default basemap for extra compare maps. Additional maps always open on
// OpenStreetMap, regardless of their position or the main map's basemap.
// The main (left) map keeps initializing from the current basemap.
export function defaultExtraBasemap() {
  return 'osm';
}
