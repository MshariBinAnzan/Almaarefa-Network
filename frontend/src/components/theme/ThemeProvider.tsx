'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/utils/validators';

export type ThemeId = 'light' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Warm sand & Almaarefa teal — low eye strain for reading',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Obsidian dark theme for night study & OLED screens',
    icon: Moon,
  },
];

const STORAGE_KEY = 'almaarefa-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function normalizeSavedTheme(value: string | null): ThemeId | null {
  if (value === 'light' || value === 'paper' || value === 'day') return 'light';
  if (value === 'dark' || value === 'night') return 'dark';
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('light');

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const saved = normalizeSavedTheme(raw);
    if (saved) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
      localStorage.setItem(STORAGE_KEY, saved);
      return;
    }
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial: ThemeId = prefersDark ? 'dark' : 'light';
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Accessible Light / Dark theme switcher for the navbar & auth pages.
 * Renders a 2-way segmented pill on sm+ screens and a compact toggle button on mobile.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const currentMeta = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const CurrentIcon = currentMeta.icon;

  return (
    <div className={cn('inline-flex items-center shrink-0', className)}>
      {/* Compact single-tap toggle button on mobile */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Theme: ${currentMeta.label}. Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme.`}
        title={`${currentMeta.label} — ${currentMeta.description}`}
        className="sm:hidden inline-flex items-center gap-1.5 px-2.5 min-h-9 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <CurrentIcon className="w-4 h-4 text-brand-600" aria-hidden="true" />
        <span>{currentMeta.label}</span>
      </button>

      {/* Segmented Light / Dark pill on sm+ screens */}
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="hidden sm:inline-flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200"
      >
        {THEMES.map((item) => {
          const Icon = item.icon;
          const active = theme === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(item.id)}
              title={`${item.label} — ${item.description}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                active
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
