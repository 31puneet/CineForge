import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'dark' | 'cream';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('cineforge_theme') || localStorage.getItem('cineforge_landing_theme');
    return (saved as Theme) || 'dark';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('cineforge_theme', newTheme);
    localStorage.setItem('cineforge_landing_theme', newTheme);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'cream' : 'dark';
    setTheme(next);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.add('theme-dark');
      root.classList.remove('theme-cream');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.remove('theme-dark');
      root.classList.add('theme-cream');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
