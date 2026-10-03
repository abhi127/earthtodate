import { useState, useCallback } from 'react';
import VendorSearchForm from './vendors/VendorSearchForm';
import { getVendorComponent } from './vendors/VendorRegistry';
import VendorResultsList from './vendors/VendorResultsList';
import VendorResultDetail from './vendors/VendorResultDetail';
import styles from './ArchivalSearchPanel.module.css';

export default function ArchivalSearchPanel({ mapRef, onClose, onResultsChange, hoveredId, pinnedIds, previewIds, onHover, onTogglePin, onClearPins, onTogglePreview }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [detailResult, setDetailResult] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError('');
    setWarnings([]);
    setResults([]);
    onClearPins?.();
    setHasSearched(true);
    setFiltersOpen(false);
    onResultsChange?.([]);
    try {
      // One combined search across all vendors — no vendor switching.
      const res = await fetch('/api/vendors/search', {
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
        if (data.errors?.length) {
          setWarnings(data.errors.map((e) => {
            const name = getVendorComponent(e.vendor)?.displayName || e.vendor;
            return `${name} unavailable — showing partial results`;
          }));
        }
      }
    } catch {
      setError('Network error — check connection');
    } finally {
      setLoading(false);
    }
  }, [onClearPins, onResultsChange]);

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

      {/* The form stays mounted when collapsed (hidden via CSS) so the
          AOI, dates and filters survive across searches. Unmounting here
          would wipe the AOI and force re-drawing on every search. */}
      <div className={!hasSearched || filtersOpen ? styles.formWrap : styles.formHidden}>
        <VendorSearchForm mapRef={mapRef} onSearch={handleSearch} loading={loading} />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {warnings.map((w, i) => <p key={i} className={styles.warning}>{w}</p>)}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Searching archives…</span>
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
