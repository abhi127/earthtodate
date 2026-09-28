import { useState, useCallback } from 'react';
import { getVendorComponent } from './vendors/VendorRegistry';
import MgpProResultsList from './vendors/mgp-pro/MgpProResultsList';
import MgpProResultDetail from './vendors/mgp-pro/MgpProResultDetail';
import styles from './ArchivalSearchPanel.module.css';

export default function ArchivalSearchPanel({ mapRef, onClose, onResultsChange }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [detailResult, setDetailResult] = useState(null);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError('');
    setResults([]);
    setPinnedIds([]);
    onResultsChange?.([]);
    try {
      const res = await fetch('/api/vendors/mgp-pro/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error === 'VENDOR_AUTH_ERROR' ? 'Archive search unavailable — contact admin' : 'Archive provider busy — try again shortly');
      } else {
        setResults(data.results || []);
        onResultsChange?.(data.results || []);
      }
    } catch {
      setError('Network error — check connection');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTogglePin = useCallback((id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const vendor = getVendorComponent('mgp-pro');
  const SearchForm = vendor?.SearchForm;

  return (
    <div className={styles.panel}>
      {SearchForm && <SearchForm mapRef={mapRef} onSearch={handleSearch} loading={loading} />}

      {error && <p className={styles.error}>{error}</p>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Searching archive…</span>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <p className={styles.empty}>No imagery found for this AOI and filters.<br />Try a different area or date range.</p>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className={styles.count}>{results.length} image{results.length === 1 ? '' : 's'} found</p>
          <MgpProResultsList
            results={results}
            hoveredId={hoveredId}
            pinnedIds={pinnedIds}
            onHover={setHoveredId}
            onTogglePin={handleTogglePin}
            onOpenDetail={setDetailResult}
          />
        </>
      )}

      {detailResult && (
        <MgpProResultDetail result={detailResult} onClose={() => setDetailResult(null)} />
      )}
    </div>
  );
}
