import { useState } from 'react';
import SearchPanel from '../search/SearchPanel';
import { BASEMAP_DEFS } from '../map/basemaps';
import { CATEGORY_ICONS } from '../map/satelliteCategories';
import styles from './Sidebar.module.css';

const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Rail order matches the order the client listed them. Earth to Date, AI and
// Analytics are the three Earth to Date product categories: they used to sit in
// a second icon rail of their own, and are now first-class rail entries.
const RAIL_ITEMS = [
  {
    id: 'search', label: 'Search', hidden: true,
    icon: <svg {...ICON}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  {
    id: 'basemap', label: 'Base Map',
    icon: <svg {...ICON}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  },
  {
    id: 'archive', label: 'Archive Search',
    icon: <svg {...ICON}><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  },
  {
    id: 'e2d', label: 'Earth to Date',
    icon: <svg {...ICON}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  },
  {
    id: 'analytics', label: 'Analytics',
    icon: CATEGORY_ICONS.analytics,
  },
  {
    id: 'ai', label: 'AI',
    icon: CATEGORY_ICONS.ai,
  },
  {
    id: 'blacksky', label: 'BlackSky',
    icon: <svg {...ICON}><path d="M12 2a10 10 0 1 0 10 10"/><circle cx="12" cy="12" r="3"/><path d="M17 3l4 4"/><path d="M21 3l-4 4"/></svg>,
  },
  {
    id: 'earthdelhi', label: 'Earth Delhi',
    icon: <svg {...ICON}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
  },
  {
    id: 'vantor', label: 'Vantor',
    icon: <svg {...ICON}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>,
  },
];

function PanelShell({ title, subtitle, onClose, children }) {
  return (
    <>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {subtitle && <p className={styles.panelSubtitle}>{subtitle}</p>}
        </div>
        <button className={styles.panelClose} onClick={onClose} title="Close panel" aria-label="Close panel">&times;</button>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </>
  );
}

function BasemapPanel({ activeBasemap, onSelect }) {
  return (
    <div className={styles.basemapGrid}>
      {BASEMAP_DEFS.map(bm => (
        <button
          key={bm.id}
          className={`${styles.thumb} ${activeBasemap === bm.id ? styles.thumbActive : ''}`}
          onClick={() => onSelect(bm.id)}
          title={bm.name}
          style={{ backgroundImage: `url(${bm.thumbnail})` }}
        >
          <span className={styles.thumbLabel}>{bm.name}</span>
          {activeBasemap === bm.id && <span className={styles.thumbCheck}>&#10003;</span>}
        </button>
      ))}
    </div>
  );
}

const BLACKSKY_KEY = 'geosyze.blacksky.apiKey';

function BlackSkyPanel() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem(BLACKSKY_KEY) || ''; } catch { return ''; }
  });
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    const val = draft.trim();
    if (!val) return;
    try { localStorage.setItem(BLACKSKY_KEY, val); } catch {}
    setApiKey(val);
    setDraft('');
    setSaved(true);
  }

  function clear() {
    try { localStorage.removeItem(BLACKSKY_KEY); } catch {}
    setApiKey('');
    setSaved(false);
  }

  return (
    <>
      {apiKey ? (
        <div className={styles.keyStored}>
          <p className={styles.keyStoredLabel}>API key stored</p>
          <code className={styles.keyMasked}>{'•'.repeat(Math.max(0, apiKey.length - 4))}{apiKey.slice(-4)}</code>
          <button className={styles.secondaryBtn} onClick={clear}>Remove key</button>
        </div>
      ) : (
        <form className={styles.keyForm} onSubmit={save}>
          <p className={styles.note}>BlackSky requires an API key before imagery can be requested. Paste the key issued for this account.</p>
          <label className={styles.keyLabel} htmlFor="blacksky-key">BlackSky API key</label>
          <input
            id="blacksky-key"
            className={styles.keyInput}
            type="password"
            autoComplete="off"
            placeholder="Paste API key"
            value={draft}
            onChange={e => { setDraft(e.target.value); setSaved(false); }}
          />
          <button className={styles.primaryBtn} type="submit" disabled={!draft.trim()}>Save key</button>
        </form>
      )}
      {saved && <p className={styles.savedNote}>Key saved locally. Imagery endpoints are not wired up yet.</p>}
      <p className={styles.placeholderNote}>Search and tasking for BlackSky will be enabled once the key is validated against the provider API.</p>
    </>
  );
}

function PlaceholderPanel({ note }) {
  return (
    <div className={styles.placeholder}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 3"/>
      </svg>
      <p className={styles.placeholderNote}>{note}</p>
    </div>
  );
}

// Earth to Date categories: these switch the satellite layer instead of opening
// a side panel.
const SAT_CATEGORY = { e2d: 'visual', ai: 'ai', analytics: 'analytics' };

export default function Sidebar({ activePanel, onSelectPanel, activeBasemap, onSelectBasemap, satelliteOpen, satCategory }) {
  const item = RAIL_ITEMS.find(i => i.id === activePanel);

  function renderPanel() {
    switch (activePanel) {
      case 'basemap':
        return <BasemapPanel activeBasemap={activeBasemap} onSelect={onSelectBasemap} />;
      case 'blacksky':
        return <BlackSkyPanel />;
      case 'earthdaily':
        return <PlaceholderPanel note="EarthDaily imagery is not connected yet. This panel is reserved for the EarthDaily catalogue and ordering flow." />;
      case 'archive':
        return <PlaceholderPanel note="Archive search against the Maxar Geospatial Platform (MGP Pro) is not connected yet." />;
      case 'vantor':
        return <PlaceholderPanel note="Vantor (formerly Maxar) tasking and related APIs are not connected yet. Credentials and endpoint details are pending." />;
      default:
        return null;
    }
  }

  const body = renderPanel();

  return (
    <div className={styles.sidebar}>
      <nav className={styles.rail}>
        {RAIL_ITEMS.filter(r => !r.hidden).map(railItem => {
          const cat = SAT_CATEGORY[railItem.id];
          const active = cat
            ? satelliteOpen && satCategory === cat
            : activePanel === railItem.id;
          return (
            <button
              key={railItem.id}
              className={`${styles.railBtn} ${active ? styles.railActive : ''}`}
              onClick={() => onSelectPanel(railItem.id)}
              title={railItem.label}
              aria-label={railItem.label}
              aria-pressed={active}
            >
              {railItem.icon}
            </button>
          );
        })}
      </nav>

      {activePanel === 'search' && <SearchPanel isOpen />}

      {body && (
        <div className={styles.panel}>
          <PanelShell
            title={item?.label}
            subtitle={activePanel === 'vantor' ? 'Tasking and other APIs' : null}
            onClose={() => onSelectPanel(activePanel)}
          >
            {body}
          </PanelShell>
        </div>
      )}
    </div>
  );
}
