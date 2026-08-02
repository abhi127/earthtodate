import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import MenuBar from './MenuBar';
import ThemeToggle from './ThemeToggle';
import styles from './TopBar.module.css';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleInput = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${NOMINATIM}?q=${encodeURIComponent(val)}&format=json&limit=5`);
        if (!res.ok) return;
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {}
    }, 300);
  }, []);

  const handleSelect = useCallback((r) => {
    setQuery(r.display_name.split(',')[0]);
    setOpen(false);
    setResults([]);
    onSearch?.([parseFloat(r.lon), parseFloat(r.lat)], 16);
  }, [onSearch]);

  return (
    <div className={styles.searchWrap} ref={ref}>
      <span className={styles.searchIcon}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <input className={styles.searchInput} type="text" placeholder="Search places…" value={query} onChange={handleInput} />
      {open && (
        <div className={styles.searchDropdown}>
          {results.map((r, i) => (
            <button key={i} className={styles.searchResult} onClick={() => handleSelect(r)}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ onToggleSidebar, onMenuAction, compareMode, setCompareMode, satelliteActive, onSearch }) {
  const { logout } = useAuth();
  const brand = useTheme();

  function handleCompareToggle() {
    if (compareMode) {
      setCompareMode(null);
    } else {
      setCompareMode('compare');
    }
  }

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.hamburger} onClick={onToggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <svg className={styles.logoIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className={styles.brand}> {brand?.name || 'GEOSYZE'}</span>
        <SearchBar onSearch={onSearch} />
        <MenuBar onMenuAction={onMenuAction} satelliteActive={satelliteActive} />
        <button className={`${styles.compareBtn} ${compareMode ? styles.compareActive : ''}`} onClick={handleCompareToggle} title={compareMode ? 'Exit compare mode' : 'Compare basemaps'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
        </button>
      </div>
      <div className={styles.right}>
        <ThemeToggle />
        <div className={styles.avatar} title="admin user">A</div>
        <button className={styles.logoutBtn} onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
