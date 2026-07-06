import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type ThemeName =
  | 'light'
  | 'dark'
  | 'solarized'
  | 'anime'
  | 'anime-night'
  | 'cinnamoroll'
  | 'cinnamoroll-night'
  | 'kuromi'
  | 'kuromi-night'
  | 'melody'
  | 'melody-night'
  | 'totoro'
  | 'totoro-night'
  | 'ink'
  | 'ink-night';
/** kept as an alias — day/night variants are now picked explicitly in Settings */
export type ResolvedTheme = ThemeName;

const THEME_NAMES: ThemeName[] = [
  'light',
  'dark',
  'solarized',
  'anime',
  'anime-night',
  'cinnamoroll',
  'cinnamoroll-night',
  'kuromi',
  'kuromi-night',
  'melody',
  'melody-night',
  'totoro',
  'totoro-night',
  'ink',
  'ink-night',
];

interface ThemeContextValue {
  theme: ThemeName;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'fish-notes-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (saved && THEME_NAMES.includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const resolvedTheme: ResolvedTheme = theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
