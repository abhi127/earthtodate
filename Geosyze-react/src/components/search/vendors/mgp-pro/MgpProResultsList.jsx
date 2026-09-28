import styles from './MgpProResultsList.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MgpProResultsList({ results, hoveredId, pinnedIds, onHover, onTogglePin, onOpenDetail }) {
  return (
    <div className={styles.list}>
      {results.map(r => {
        const isHovered = hoveredId === r.id;
        const isPinned = pinnedIds.includes(r.id);
        return (
          <div
            key={r.id}
            className={`${styles.item} ${isHovered ? styles.hovered : ''} ${isPinned ? styles.pinned : ''}`}
            onMouseEnter={() => onHover(r.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onTogglePin(r.id)}
            onDoubleClick={() => onOpenDetail(r)}
          >
            <div className={styles.thumb}>
              {r.thumbnailUrl ? (
                <img src={r.thumbnailUrl} alt={r.title} className={styles.thumbImg} />
              ) : (
                <div className={styles.thumbPlaceholder}>No preview</div>
              )}
            </div>
            <div className={styles.info}>
              <span className={styles.title} title={r.title}>{r.title}</span>
              <span className={styles.date}>{formatDate(r.acquisitionDate)} · {r.sensor || '—'}</span>
              <div className={styles.metaGrid}>
                <span className={styles.meta} title="Cloud cover"><span className={styles.metaIcon}>☁</span> <strong>{r.cloudCover != null ? `${r.cloudCover.toFixed(1)}%` : '—'}</strong></span>
                <span className={styles.meta} title="Resolution"><span className={styles.metaIcon}>◈</span> <strong>{r.resolution != null ? `${r.resolution.toFixed(2)}m` : '—'}</strong></span>
                <span className={styles.meta} title="Off-nadir angle"><span className={styles.metaIcon}>∠</span> <strong>{r.offNadirAngle != null ? `${r.offNadirAngle.toFixed(1)}°` : '—'}</strong></span>
                <span className={styles.meta} title="Collection">{r.id?.slice(-6) || ''}</span>
              </div>
            </div>
            <button className={styles.detailBtn} onClick={(e) => { e.stopPropagation(); onOpenDetail(r); }}>
              Details
            </button>
          </div>
        );
      })}
    </div>
  );
}
