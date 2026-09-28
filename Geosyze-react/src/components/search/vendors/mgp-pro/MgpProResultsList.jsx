import styles from './MgpProResultsList.module.css';

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
              <span className={styles.title}>{r.title}</span>
              <span className={styles.meta}>{r.acquisitionDate?.split('T')[0] || '—'}</span>
              <span className={styles.meta}>{r.sensor || '—'}</span>
              <span className={styles.meta}>{r.cloudCover != null ? `${r.cloudCover}% cloud` : '—'}</span>
              <span className={styles.meta}>{r.resolution != null ? `${r.resolution}m` : '—'}</span>
              <span className={styles.meta}>{r.offNadirAngle != null ? `${r.offNadirAngle}° off-nadir` : '—'}</span>
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
