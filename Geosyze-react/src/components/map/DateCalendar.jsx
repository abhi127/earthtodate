import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './DateCalendar.module.css';

const API_URL = '/api/tiles/dates';

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getCloudColor(cloudPct) {
  if (cloudPct <= 20) return 'var(--primary, #22C55E)';
  if (cloudPct <= 50) return 'var(--warning, #FBBF24)';
  return 'var(--error, #EF4444)';
}

// 4-month block end dates: Apr 30, Aug 31, Dec 31
const BLOCK_END_DATES = [
  { month: 3, day: 30 },  // April 30 (0-indexed month 3)
  { month: 7, day: 31 },  // August 31
  { month: 11, day: 31 }, // December 31
];

// Stable "today" reference - only computed once
const TODAY = new Date();
const CURRENT_YEAR = TODAY.getFullYear();

export default function DateCalendar({
  isOpen,
  onClose,
  onDateSelect,
  lat,
  lon,
  viewtype,
  selectedDate,
}) {
  const [year, setYear] = useState(() => {
    return selectedDate ? parseDateKey(selectedDate).getFullYear() : CURRENT_YEAR;
  });
  const [datesMap, setDatesMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const isCurrentYear = year === CURRENT_YEAR;

  // Always fetch every block, but clamp each end date to today
  const blocksToFetch = useMemo(() => {
    const seen = new Set();
    const blocks = [];
    BLOCK_END_DATES.forEach((block, i) => {
      const rawEnd = new Date(year, block.month, block.day);
      const endDate = rawEnd > TODAY ? TODAY : rawEnd;
      const key = formatDateKey(endDate);
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push({ index: i, endDate });
    });
    return blocks;
  }, [year]);

  // Fetch dates for a year (3 blocks max, 122 days each)
  const fetchYearDates = useCallback(async () => {
    if (!lat || !lon || !viewtype || blocksToFetch.length === 0) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const merged = new Map();

      for (const { index, endDate } of blocksToFetch) {
        const endStr = formatDateKey(endDate);
        const url = `${API_URL}/${lat.toFixed(4)},${lon.toFixed(4)}/${viewtype}/${endStr}/122/100`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) continue;
        const data = await res.json();

        (data || []).forEach(([dateKey, cloud]) => {
          const pct = Math.round(parseFloat(cloud));
          if (!merged.has(dateKey) || pct < merged.get(dateKey)) {
            merged.set(dateKey, pct);
          }
        });
      }

      if (!controller.signal.aborted) {
        setDatesMap(merged);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError('Failed to load available dates');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [lat, lon, viewtype, blocksToFetch]);

  // Fetch on open or when year/params change
  useEffect(() => {
    if (isOpen) {
      fetchYearDates();
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [isOpen, fetchYearDates]);

  // Keyboard: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Click outside to close
  const overlayRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Generate month data for the year grid
  const months = Array.from({ length: 12 }, (_, m) => {
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sun
    const weeks = [];
    let current = new Date(firstDay);
    current.setDate(current.getDate() - startDay);
    
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
      if (current.getMonth() !== m && w > 3) break;
    }
    return { month: m, firstDay, lastDay, weeks, monthName: firstDay.toLocaleString('default', { month: 'short' }) };
  });

  const selectedKey = selectedDate || '';
  const todayKey = formatDateKey(TODAY);

  const handleDateClick = (date) => {
    const key = formatDateKey(date);
    if (datesMap.has(key)) {
      onDateSelect(key);
      onClose();
    }
  };

  const isMonthFuture = (m) => {
    if (year < CURRENT_YEAR) return false;
    return m > TODAY.getMonth();
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
  };

  const availableYears = Array.from({ length: CURRENT_YEAR - 2020 + 1 }, (_, i) => CURRENT_YEAR - i);

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.yearSelect}>
            <label htmlFor="yearSelect" className={styles.yearLabel}>Year</label>
            <select
              id="yearSelect"
              className={styles.yearDropdown}
              value={year}
              onChange={e => handleYearChange(Number(e.target.value))}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className={styles.loading}>Loading dates…</div>}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.yearGrid}>
          {months.map(({ month, monthName, weeks, firstDay, lastDay }) => {
            const future = isMonthFuture(month);
            return (
              <div key={month} className={`${styles.monthCard} ${future ? styles.futureMonth : ''}`}>
                <div className={styles.monthHeader}>
                  <span className={styles.monthName}>{monthName}</span>
                  {future && <span className={styles.futureBadge}>No data</span>}
                </div>
                <div className={styles.monthGrid}>
                  <div className={styles.weekdays}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                      <div key={i} className={styles.weekday}>{d.slice(0, 1)}</div>
                    ))}
                  </div>
                  <div className={styles.weeks}>
                    {weeks.map((week, wi) => (
                      <div key={wi} className={styles.week}>
                        {week.map((day, di) => {
                          const key = formatDateKey(day);
                          const cloudPct = datesMap.get(key);
                          const isCurrentMonth = day.getMonth() === month;
                          const isSelected = key === selectedKey;
                          const isToday = key === todayKey && year === CURRENT_YEAR;
                          const hasData = cloudPct !== undefined;
                          const isFutureDate = day > TODAY;

                          return (
                            <button
                              key={`${wi}-${di}`}
                              className={`${styles.day} ${!isCurrentMonth ? styles.otherMonth : ''} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''} ${!hasData ? styles.noData : ''} ${isFutureDate ? styles.futureDate : ''}`}
                              onClick={() => handleDateClick(day)}
                              disabled={!hasData || !isCurrentMonth || isFutureDate}
                              style={hasData ? { '--cloud-color': getCloudColor(cloudPct) } : {}}
                              title={hasData ? `Cloud: ${cloudPct}%` : (isFutureDate ? 'Future date' : 'No imagery')}
                            >
                              <span className={styles.dayNumber}>{day.getDate()}</span>
                              {hasData && (
                                <span className={styles.cloudPct}>{cloudPct}%</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.legend}>
          <span>Cloud coverage:</span>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--primary, #22C55E)' }} /> \u226420%</div>
            <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--warning, #FBBF24)' }} /> 20\u201350%</div>
            <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--error, #EF4444)' }} /> \u003E50%</div>
          </div>
        </div>
      </div>
    </div>
  );
}