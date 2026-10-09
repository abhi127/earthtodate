// Pure panel-switching rules shared by MapPage and tests. Satellite
// categories (e2d/ai/analytics) drive the satellite overlay; every other
// rail entry drives the side panel. The two are mutually exclusive: moving
// to a side-panel menu turns the satellite panel off, and moving to a
// satellite category closes any side panel.
export const SAT_PANEL_CATEGORY = { e2d: 'visual', ai: 'ai', analytics: 'analytics' };

export function resolvePanelSelect(state, id) {
  const cat = SAT_PANEL_CATEGORY[id];
  if (cat) {
    if (state.satelliteOpen && state.satCategory === cat) {
      return { ...state, satelliteOpen: false };
    }
    return { ...state, satCategory: cat, satelliteOpen: true, activePanel: null };
  }
  return {
    ...state,
    activePanel: state.activePanel === id ? null : id,
    satelliteOpen: false,
  };
}
