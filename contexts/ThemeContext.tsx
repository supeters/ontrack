'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getTheme } from '@/lib/themes';
import type { Theme } from '@/lib/themes';

interface ThemeContextType {
  theme: Theme;
  currentTheme: string;
  changeTheme: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: getTheme('ocean'),
  currentTheme: 'ocean',
  changeTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Get theme from localStorage or default to 'ocean'
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ontrack-theme') || 'ocean';
    }
    return 'ocean';
  });

  const theme = getTheme(currentTheme);

  const changeTheme = (themeName: string) => {
    setCurrentTheme(themeName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ontrack-theme', themeName);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
