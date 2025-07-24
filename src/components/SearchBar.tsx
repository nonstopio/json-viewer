import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface SearchBarProps {
  onSearch: (query: string, caseSensitive: boolean) => void;
  resultCount?: number;
  currentResult?: number;
  onNavigate?: (direction: 'next' | 'prev') => void;
  isVisible?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  resultCount = 0,
  currentResult = 0,
  onNavigate,
  isVisible = true
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSearch = useCallback((searchQuery: string, isCaseSensitive: boolean) => {
    onSearch(searchQuery, isCaseSensitive);
    
    if (searchQuery.trim()) {
      trackEvent('search_performed', {
        searchQuery: searchQuery,
        caseSensitive: isCaseSensitive,
        queryLength: searchQuery.length
      });
    }
  }, [onSearch]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    handleSearch(newQuery, caseSensitive);
  }, [caseSensitive, handleSearch]);

  const handleCaseSensitiveToggle = useCallback(() => {
    const newCaseSensitive = !caseSensitive;
    setCaseSensitive(newCaseSensitive);
    handleSearch(query, newCaseSensitive);
  }, [caseSensitive, query, handleSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    handleSearch('', caseSensitive);
    inputRef.current?.focus();
  }, [caseSensitive, handleSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        handleClear();
        break;
      case 'Enter':
        if (e.shiftKey) {
          onNavigate?.('prev');
        } else {
          onNavigate?.('next');
        }
        break;
      case 'F3':
        e.preventDefault();
        if (e.shiftKey) {
          onNavigate?.('prev');
        } else {
          onNavigate?.('next');
        }
        break;
    }
  }, [handleClear, onNavigate]);

  const handleNavigateNext = useCallback(() => {
    onNavigate?.('next');
  }, [onNavigate]);

  const handleNavigatePrev = useCallback(() => {
    onNavigate?.('prev');
  }, [onNavigate]);

  if (!isVisible) return null;

  return (
    <div className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search JSON keys and values..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search Results Count */}
      {query && (
        <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {resultCount > 0 ? (
            <>
              {currentResult + 1} of {resultCount}
            </>
          ) : (
            'No results'
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      {query && resultCount > 0 && (
        <div className="flex items-center space-x-1">
          <button
            onClick={handleNavigatePrev}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Previous result (Shift+Enter)"
            disabled={resultCount === 0}
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={handleNavigateNext}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Next result (Enter)"
            disabled={resultCount === 0}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Search Options */}
      <div className="relative" ref={optionsRef}>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Search options"
        >
          <MoreHorizontal size={16} />
        </button>

        {showOptions && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
            <div className="p-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={handleCaseSensitiveToggle}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Case sensitive
                </span>
              </label>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>• Enter: Next result</div>
                <div>• Shift+Enter: Previous result</div>
                <div>• Escape: Clear search</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};