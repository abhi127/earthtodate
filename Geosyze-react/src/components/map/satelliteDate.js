// Default-date rule for satellite panels: the most recent date with cloud
// cover at most 2% (closest to today). Falls back to the least cloudy date
// when nothing qualifies, and to null when there are no dates (caller keeps
// the current date).
// Each entry is [dateStr 'YYYY-MM-DD', clouds] where clouds parses as float.
export const MAX_DEFAULT_CLOUDS = 2;

export function pickBestDate(dates) {
  const qualifying = (dates || [])
    .filter(d => parseFloat(d[1]) <= MAX_DEFAULT_CLOUDS)
    .sort((a, b) => b[0].localeCompare(a[0]));
  if (qualifying.length) return qualifying[0][0];
  const sorted = [...(dates || [])].sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
  return sorted.length ? sorted[0][0] : null;
}
