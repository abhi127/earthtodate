import styles from './VendorResultsList.module.css';

export default function VendorResultsList({ results, hoveredId, pinnedIds, previewIds, onHover, onTogglePin, onTogglePreview, onOpenDetail }) {
  return (
    <div className={styles.list}>
      {results.map(r => {
        const isHovered = hoveredId === r.id;
        const isPinned = pinnedIds.includes(r.id);
        const isPreviewing = previewIds.includes(r.id);
        const hasPreview = !!r.previewUrl;
        return (
          <div
            key={r.id}
            className={`${styles.item} ${isHovered ? styles.hovered : ''} ${isPinned ? styles.pinned : ''}`}
            onMouseEnter={() => onHover(r.id)}
            onMouseLeave={() => onHover(null)}
          >
            <div className={styles.info}>
              <span className={styles.title} title={r.title}>{r.title}</span>
              <span className={styles.date}>{formatDate(r.acquisitionDate)} · {r.sensor || '—'}</span>
              <div className={styles.metaRow}>
                <div className={styles.metaGrid}>
                  <span className={styles.meta} title="Cloud cover"><span className={styles.metaIcon}>☁</span> <strong>{r.cloudCover != null ? `${r.cloudCover.toFixed(1)}%` : '—'}</strong></span>
                  <span className={styles.meta} title="Resolution"><span className={styles.metaIcon}>◈</span> <strong>{r.resolution != null ? `${r.resolution.toFixed(2)}m` : '—'}</strong></span>
                  <span className={styles.meta} title="Off-nadir angle"><span className={styles.metaIcon}>∠</span> <strong>{r.offNadirAngle != null ? `${r.offNadirAngle.toFixed(1)}°` : '—'}</strong></span>
                  <span className={styles.meta} title="Collection">{r.id?.slice(-6) || ''}</span>
                </div>
                <div className={styles.iconBtns}>
                  <button
                    className={`${styles.iconBtn} ${isPinned ? styles.iconActive : ''}`}
                    onClick={() => onTogglePin(r.id)}
                    title={isPinned ? 'Release footprint' : 'Hold footprint on map'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 22 8.5 18 22 6 22 2 8.5" /></svg>
                  </button>
                  <button
                    className={`${styles.iconBtn} ${isPreviewing ? styles.iconActive : ''}`}
                    onClick={() => hasPreview && onTogglePreview(r.id)}
                    disabled={!hasPreview}
                    title={hasPreview ? (isPreviewing ? 'Hide preview image' : 'Load preview image on map') : 'No preview available'}
                  >
                    🖼️
                  </button>
                </div>
              </div>
            </div>
            <button className={styles.detailBtn} onClick={() => onOpenDetail(r)}>
              Details
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
