import { useState, useCallback } from 'react';
import { getVendorComponent, getVendorList } from './vendors/VendorRegistry';
import VendorResultsList from './vendors/VendorResultsList';
import VendorResultDetail from './vendors/VendorResultDetail';
import styles from './ArchivalSearchPanel.module.css';

export default function ArchivalSearchPanel({ mapRef, onClose, onResultsChange, hoveredId, pinnedIds, previewIds, onHover, onTogglePin, onClearPins, onTogglePreview }) {
  const [vendorId, setVendorId] = useState('mgp-pro');
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
      const res = await fetch(`/api/vendors/${vendorId}/search`, {
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
  }, [vendorId, onClearPins, onResultsChange]);

  const handleVendorSwitch = useCallback((id) => {
    setVendorId(id);
    setResults([]);
    setError('');
    setDetailResult(null);
    setHasSearched(false);
    setFiltersOpen(true);
    onClearPins?.();
    onResultsChange?.([]);
  }, [onClearPins, onResultsChange]);

  const vendor = getVendorComponent(vendorId);
  const SearchForm = vendor?.SearchForm;

  return (
    <div className={styles.panel}>
      <div className={styles.vendorTabs} role="tablist" aria-label="Archive vendors">
        {getVendorList().map(v => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vendorId === v.id}
            className={`${styles.vendorTab} ${vendorId === v.id ? styles.vendorTabActive : ''}`}
            onClick={() => handleVendorSwitch(v.id)}
          >
            {v.displayName}
          </button>
        ))}
      </div>

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
          <VendorResultsList
            results={results}
            hoveredId={hoveredId}
            pinnedIds={pinnedIds || []}
            previewIds={previewIds || []}
            onHover={onHover}
            onTogglePin={onTogglePin}
            onTogglePreview={onTogglePreview}
            onOpenDetail={setDetailResult}
          />
        </div>
      )}

      {detailResult && (
        <VendorResultDetail result={detailResult} onClose={() => setDetailResult(null)} />
      )}
    </div>
  );
}
