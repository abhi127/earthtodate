import { useState } from 'react';
import RangeSlider from './RangeSlider';
import styles from './FiltersTab.module.css';

const RESOLUTIONS = ['High (<1m)', 'Medium (1-5m)', 'Low (5-30m)', 'Mixed'];
const SENSORS = ['Optical', 'SAR', 'Multispectral'];

export default function FiltersTab({ onSearch }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cloudCover, setCloudCover] = useState(80);
  const [offNadir, setOffNadir] = useState(30);
  const [resolution, setResolution] = useState('Mixed');
  const [sensors, setSensors] = useState(['Optical']);

  function toggleSensor(name) {
    setSensors(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }

  function handleSearch() {
    onSearch({ dateFrom, dateTo, cloudCover, offNadir, resolution, sensors });
  }

  return (
    <div className={styles.tab}>
      {/* Date Range */}
      <div className={styles.field}>
        <span className={styles.label}>Date Range</span>
        <div className={styles.dateRow}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={styles.dateInput} placeholder="From" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={styles.dateInput} placeholder="To" />
        </div>
      </div>

      <RangeSlider label="Cloud Cover" value={cloudCover} onChange={setCloudCover} />
      <RangeSlider label="OFF-Nadir" min={0} max={45} value={offNadir} onChange={setOffNadir} unit="°" />

      {/* Resolution */}
      <div className={styles.field}>
        <span className={styles.label}>Resolution</span>
        <select value={resolution} onChange={e => setResolution(e.target.value)} className={styles.select}>
          {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Sensor Type */}
      <div className={styles.field}>
        <span className={styles.label}>Sensor Type</span>
        <div className={styles.sensorRow}>
          {SENSORS.map(s => (
            <label key={s} className={styles.chip}>
              <input type="checkbox" checked={sensors.includes(s)} onChange={() => toggleSensor(s)} />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <button className={styles.searchBtn} onClick={handleSearch}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        Search AOI
      </button>
    </div>
  );
}
