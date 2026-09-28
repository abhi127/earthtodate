import { useState, useCallback } from 'react';
import { getVendorComponent } from './vendors/VendorRegistry';
import MgpProResultsList from './vendors/mgp-pro/MgpProResultsList';
import MgpProResultDetail from './vendors/mgp-pro/MgpProResultDetail';
import styles from './ArchivalSearchPanel.module.css';

export default function ArchivalSearchPanel({ mapRef, onClose, onResultsChange, hoveredId, pinnedIds, onHover, onTogglePin, onClearPins, hiddenIds, footprintsVisible, onToggleFootprint, onToggleFootprintsVisible }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailResult, setDetailResult] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError('');
    setResults([]);
    onClearPins?.();
    setHasSearched(true);
    setFiltersOpen(false);
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

  const vendor = getVendorComponent('mgp-pro');
  const SearchForm = vendor?.SearchForm;

  return (
    <div className={styles.panel}>
      {hasSearched && (
        <button
          type="button"
          className={styles.filterToggle}
          onClick={() => setFiltersOpen(o => !o)}
        >
          <span>{filtersOpen ? '▾' : '▸'} Search Filters</span>
          {results.length > 0 && <span className={styles.filterCount}>{results.length} found</span>}
        </button>
      )}

      {(!hasSearched || filtersOpen) && SearchForm && (
        <SearchForm mapRef={mapRef} onSearch={handleSearch} loading={loading} />
      )}

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
        <div className={styles.resultsWrap}>
          <div className={styles.resultsBar}>
            <span className={styles.count}>{results.length} image{results.length === 1 ? '' : 's'} found</span>
            <button
              type="button"
              className={`${styles.layerToggle} ${footprintsVisible ? styles.layerToggleOn : ''}`}
              onClick={onToggleFootprintsVisible}
              title={footprintsVisible ? 'Hide all footprints' : 'Show all footprints'}
            >
              {footprintsVisible ? '◉' : '○'} Footprints
            </button>
          </div>
          <MgpProResultsList
            results={results}
            hoveredId={hoveredId}
            pinnedIds={pinnedIds || []}
            hiddenIds={hiddenIds || []}
            onHover={onHover}
            onTogglePin={onTogglePin}
            onToggleFootprint={onToggleFootprint}
            onOpenDetail={setDetailResult}
          />
        </div>
      )}

      {detailResult && (
        <MgpProResultDetail result={detailResult} onClose={() => setDetailResult(null)} />
      )}
    </div>
  );
}
