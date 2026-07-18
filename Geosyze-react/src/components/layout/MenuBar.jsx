import { useState, useEffect, useRef } from 'react';
import styles from './MenuBar.module.css';

function Dropdown({ menu, items, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className={styles.menu} ref={ref}>
      <button className={styles.menuBtn} onClick={() => setOpen(o => !o)}>
        {menu}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.chevron}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} className={styles.separator} />
            ) : (
              <button key={i} className={styles.dropItem} onClick={() => { setOpen(false); onAction(item.action); }}>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function MenuBar({ onMenuAction }) {
  const menus = [
    {
      name: 'File',
      items: [
        { label: 'New Project', action: 'new-project' },
        { separator: true },
        { label: 'Export GeoJSON', action: 'export-geojson' },
        { label: 'Export KML', action: 'export-kml' },
        { separator: true },
        { label: 'Logout', action: 'logout' },
      ],
    },
    {
      name: 'View',
      items: [
        { label: 'OSM', action: 'basemap-osm' },
        { label: 'Satellite', action: 'basemap-satellite' },
        { label: 'Terrain', action: 'basemap-terrain' },
        { separator: true },
      ],
    },
    {
      name: 'Draw',
      items: [
        { label: 'Point', action: 'draw-point' },
        { label: 'Line', action: 'draw-line' },
        { label: 'Polygon', action: 'draw-polygon' },
        { separator: true },
        { label: 'Clear All', action: 'draw-clear' },
      ],
    },

    {
      name: 'Help',
      items: [
        { label: 'About GEOSYZE', action: 'help-about' },
        { label: 'Keyboard Shortcuts', action: 'help-shortcuts' },
      ],
    },
  ];

  return (
    <nav className={styles.bar}>
      {menus.map(m => (
        <Dropdown key={m.name} menu={m.name} items={m.items} onAction={onMenuAction} />
      ))}
    </nav>
  );
}
