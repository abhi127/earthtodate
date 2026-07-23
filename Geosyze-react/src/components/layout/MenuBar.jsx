import { useState, useEffect, useRef } from 'react';
import styles from './MenuBar.module.css';

function Dropdown({ menu, items, onAction }) {
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSubOpen(null); }
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
            ) : item.submenu ? (
              <div key={i} className={styles.submenuWrap}
                onMouseEnter={() => setSubOpen(i)}
                onMouseLeave={() => setSubOpen(null)}>
                <button className={styles.dropItem} onClick={() => setSubOpen(subOpen === i ? null : i)}>
                  <span>{item.label}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.subChevron}>
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                </button>
                {subOpen === i && (
                  <div className={styles.submenu}>
                    {item.submenu.map((sub, j) =>
                      sub.separator ? (
                        <div key={j} className={styles.separator} />
                      ) : (
                        <button key={j} className={styles.dropItem} onClick={() => { setOpen(false); setSubOpen(null); onAction(sub.action); }}>
                          {sub.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
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
        {
          label: 'Export',
          submenu: [
            { label: 'GeoJSON', action: 'export-geojson' },
            { label: 'KML', action: 'export-kml' },
            { label: 'GPX', action: 'export-gpx' },
            { label: 'CSV', action: 'export-csv' },
            { label: 'WKT', action: 'export-wkt' },
            { separator: true },
            { label: 'Shapefile (.zip)', action: 'export-shapefile' },
          ],
        },
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
