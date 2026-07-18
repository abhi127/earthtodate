import { useState } from 'react';
import FiltersTab from './FiltersTab';
import ResultsTab from './ResultsTab';
import styles from './SearchPanel.module.css';

export default function SearchPanel({ isOpen }) {
  const [activeTab, setActiveTab] = useState('filters');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  function handleSearch(params) {
    setLoading(true);
    setActiveTab('results');
    // Stub: simulate API call with delay
    setTimeout(() => {
      setResults([
        { id: 1, date: '2026-06-28', cloud: 12, resolution: 'High (<1m)', sensor: 'Optical', thumbnail: null },
        { id: 2, date: '2026-06-15', cloud: 5, resolution: 'High (<1m)', sensor: 'Optical', thumbnail: null },
        { id: 3, date: '2026-05-30', cloud: 35, resolution: 'Medium (1-5m)', sensor: 'SAR', thumbnail: null },
        { id: 4, date: '2026-05-12', cloud: 8, resolution: 'High (<1m)', sensor: 'Multispectral', thumbnail: null },
      ]);
      setLoading(false);
    }, 800);
  }

  return (
    <div className={`${styles.panel} ${!isOpen ? styles.closed : ''}`}>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'filters' ? styles.active : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Filters
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`}
          onClick={() => setActiveTab('results')}
        >
          Results
          {results.length > 0 && <span className={styles.badge}>{results.length}</span>}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'filters' ? (
          <FiltersTab onSearch={handleSearch} />
        ) : (
          loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Searching...</p>
            </div>
          ) : (
            <ResultsTab results={results} />
          )
        )}
      </div>
    </div>
  );
}
