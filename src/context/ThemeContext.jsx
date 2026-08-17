import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, DEFAULT_THEME_MODE } from '../config/app.js';
import { resolveAppliedTheme, resolveSystemTheme } from '../config/themes.js';

const ThemeContext = createContext(null);

function readStoredMode() {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.THEME);
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);
  const [systemTheme, setSystemTheme] = useState(resolveSystemTheme);

  // Track OS-level scheme changes so "system" mode stays live.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const appliedTheme = mode === 'system' ? systemTheme : resolveAppliedTheme(mode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [appliedTheme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.THEME, mode);
    } catch {
      // Storage may be unavailable (private browsing, quota); theme still works for this session.
    }
  }, [mode]);

  const setThemeMode = useCallback((nextMode) => {
    setMode(nextMode);
  }, []);

  const cycleTheme = useCallback(() => {
    setMode((current) => {
      const order = ['dark', 'light', 'system'];
      const next = order[(order.indexOf(current) + 1) % order.length];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, appliedTheme, setThemeMode, cycleTheme }),
    [mode, appliedTheme, setThemeMode, cycleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
