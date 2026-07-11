import styles from './ResultsTab.module.css';

const MOCK_RESULTS = [
  { id: 1, date: '2026-06-28', cloud: 12, resolution: 'High (<1m)', sensor: 'Optical', thumbnail: null },
  { id: 2, date: '2026-06-15', cloud: 5, resolution: 'High (<1m)', sensor: 'Optical', thumbnail: null },
  { id: 3, date: '2026-05-30', cloud: 35, resolution: 'Medium (1-5m)', sensor: 'SAR', thumbnail: null },
  { id: 4, date: '2026-05-12', cloud: 8, resolution: 'High (<1m)', sensor: 'Multispectral', thumbnail: null },
];

export default function ResultsTab({ results = MOCK_RESULTS }) {
  if (!results.length) {
    return (
      <div className={styles.empty}>
        <p>No results yet.</p>
        <p className={styles.hint}>Draw an AOI and run a search to find imagery.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {results.map(r => (
        <div key={r.id} className={styles.item}>
          <div className={styles.thumb}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2"/>
              <circle cx="8" cy="8" r="2"/>
              <path d="m22 14-5-5-8 8-4-4-3 3"/>
            </svg>
          </div>
          <div className={styles.info}>
            <span className={styles.date}>{r.date}</span>
            <span className={styles.meta}>{r.cloud}% cloud · {r.resolution}</span>
            <span className={styles.meta}>{r.sensor}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
