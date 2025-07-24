import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme, Theme } from '../hooks/useTheme';

export const ThemeToggle: React.FC = () => {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (themeMode: Theme, isEffective = false) => {
    const iconClass = "w-4 h-4";
    
    if (themeMode === 'system') {
      return <Monitor className={iconClass} />;
    }
    
    const displayTheme = isEffective ? effectiveTheme : themeMode;
    return displayTheme === 'dark' ? 
      <Moon className={iconClass} /> : 
      <Sun className={iconClass} />;
  };

  const getThemeLabel = (themeMode: Theme) => {
    switch (themeMode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
    }
  };

  const themes: Theme[] = ['light', 'dark', 'system'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-gray-700 dark:text-gray-300"
        title="Change theme"
      >
        {getThemeIcon(theme, true)}
        <span className="text-sm font-medium hidden sm:inline">
          {getThemeLabel(theme)}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {themes.map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => {
                  setTheme(themeOption);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${
                  theme === themeOption
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {getThemeIcon(themeOption)}
                <span className="text-sm">
                  {getThemeLabel(themeOption)}
                  {themeOption === 'system' && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                      ({effectiveTheme})
                    </span>
                  )}
                </span>
                {theme === themeOption && (
                  <div className="ml-auto w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};