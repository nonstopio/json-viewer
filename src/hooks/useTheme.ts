import { useState, useEffect, useCallback } from 'react';
import { trackEvent } from '../utils/analytics';

export type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('json-viewer-theme');
    return (stored as Theme) || 'system';
  });

  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const getEffectiveTheme = useCallback((): 'light' | 'dark' => {
    return theme === 'system' ? getSystemTheme() : theme;
  }, [theme, getSystemTheme]);

  useEffect(() => {
    const effectiveTheme = getEffectiveTheme();
    const root = document.documentElement;
    
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Store theme preference
    localStorage.setItem('json-viewer-theme', theme);
  }, [theme, getEffectiveTheme]);

  useEffect(() => {
    // Listen for system theme changes when using system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        const effectiveTheme = getEffectiveTheme();
        const root = document.documentElement;
        
        if (effectiveTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, getEffectiveTheme]);

  const toggleTheme = useCallback(() => {
    const currentEffective = getEffectiveTheme();
    const newTheme = currentEffective === 'dark' ? 'light' : 'dark';
    
    setTheme(newTheme);
    
    trackEvent('theme_changed', {
      theme: newTheme,
      previousTheme: currentEffective
    });
  }, [getEffectiveTheme]);

  const setThemeMode = useCallback((newTheme: Theme) => {
    const previousEffective = getEffectiveTheme();
    setTheme(newTheme);
    
    trackEvent('theme_changed', {
      theme: newTheme === 'system' ? getSystemTheme() : newTheme,
      previousTheme: previousEffective,
      isSystemMode: newTheme === 'system'
    });
  }, [getEffectiveTheme, getSystemTheme]);

  return {
    theme,
    effectiveTheme: getEffectiveTheme(),
    toggleTheme,
    setTheme: setThemeMode,
    isSystemTheme: theme === 'system'
  };
};