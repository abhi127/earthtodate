import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import brand from '../config/brand';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('geosyze_theme') || 'dark'; }
    catch { return 'dark'; }
  });

  const applyTheme = useCallback((themeMode) => {
    const root = document.documentElement;
    const { colors, fonts } = brand;
    const palette = colors[themeMode] || colors.dark;
    // Shared tokens
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primaryDark', colors.primaryDark);
    root.style.setProperty('--primaryLight', colors.primaryLight);
    root.style.setProperty('--error', colors.error);
    root.style.setProperty('--errorBg', colors.errorBg);
    root.style.setProperty('--errorBorder', colors.errorBorder);
    // Mode-specific tokens
    Object.entries(palette).forEach(([key, val]) => {
      root.style.setProperty(`--${key}`, val);
    });
    // Data attribute for CSS selectors
    root.setAttribute('data-theme', themeMode);
    root.style.setProperty('--font-body', fonts.body);
    root.style.setProperty('--font-heading', fonts.heading);
  }, []);

  useEffect(() => {
    applyTheme(mode);
  }, [mode, applyTheme]);

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('geosyze_theme', next); } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ ...brand, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
