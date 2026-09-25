import { SATELLITE_PANEL_START } from './satelliteDefaults.js';
export const SATELLITE_MIN_ZOOM = 12;
export const SATELLITE_MAX_ZOOM = 21;
export function isSatelliteAllowed(zoom) { return (zoom ?? 0) >= SATELLITE_MIN_ZOOM; }
export function disposeRequestContext(contextRef) {
  const context = contextRef?.current;
  if (!context) return;
  context.active = false;
  context.controllers.forEach((c) => c.abort());
  context.controllers.clear();
  contextRef.current = null;
}
export async function resolveR5mViewtype(viewtype, date, r5mRef) {
  if (viewtype !== 'r5m_tci') return viewtype;
  const { lat, lon } = SATELLITE_PANEL_START;
  const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  try {
    const [s2Resp, lsResp] = await Promise.all([
      fetch(`/api/tiles/dates/${location}/s2r5m_tci/${date}/365/100`).then((r) => r.json()).catch(() => []),
      fetch(`/api/tiles/dates/${location}/ls5_tci/${date}/365/100`).then((r) => r.json()).catch(() => []),
    ]);
    const merged = {};
    (s2Resp || []).forEach((d) => { merged[d[0]] = { date: d[0], source: 's2r5m_tci', clouds: parseFloat(d[1]) }; });
    (lsResp || []).forEach((d) => {
      if (!merged[d[0]] || parseFloat(d[1]) < merged[d[0]].clouds)
        merged[d[0]] = { date: d[0], source: 'ls5_tci', clouds: parseFloat(d[1]) };
    });
    const sorted = Object.values(merged).sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length > 0) { r5mRef.current = sorted[0].source; return sorted[0].source; }
  } catch { /* fallback below */ }
  r5mRef.current = 's2r5m_tci';
  return 's2r5m_tci';
}
