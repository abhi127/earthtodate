// Default date range for the archival search form: end = the given day
// (defaults to today), start = exactly one calendar month earlier.
// Returned as local YYYY-MM-DD strings (UTC slicing would shift the day
// for timezones east of Greenwich). setMonth clamps month-end overflow
// (e.g. Mar 31 -> Feb 28) which is the desired behavior here.
export function defaultArchiveRange(now = new Date()) {
  const toISODate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Step back via the 1st to avoid setMonth overflow (Feb 31 -> Mar 3),
  // then clamp to the target month's last day (Mar 31 -> Feb 28).
  const start = new Date(now);
  const day = start.getDate();
  start.setDate(1);
  start.setMonth(start.getMonth() - 1);
  start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  return { start: toISODate(start), end: toISODate(now) };
}
