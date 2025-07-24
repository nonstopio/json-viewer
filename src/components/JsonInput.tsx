import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface JsonInputProps {
  onJsonSubmit: (json: string, shouldSwitchTab?: boolean) => void;
  isLoading?: boolean;
  error?: string;
  initialValue?: string;
}

export const JsonInput: React.FC<JsonInputProps> = ({
  onJsonSubmit,
  isLoading = false,
  error,
  initialValue = ''
}) => {
  const [jsonText, setJsonText] = useState(initialValue);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setJsonText(initialValue);
  }, [initialValue]);

  const handleTextSubmit = useCallback(() => {
    if (jsonText.trim()) {
      onJsonSubmit(jsonText.trim(), true); // Pass true to indicate tab switch should happen
      trackEvent('json_pasted', {
        fileSize: jsonText.length
      });
    }
  }, [jsonText, onJsonSubmit]);

  const handleFileRead = useCallback((file: File) => {
    if (file.size > 1024 * 1024) { // 1MB limit
      trackEvent('error_encountered', {
        errorType: 'file_too_large',
        fileSize: file.size
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setJsonText(content);
        onJsonSubmit(content, true); // Pass true to indicate tab switch should happen
        trackEvent('file_uploaded', {
          fileSize: content.length,
          fileName: file.name,
          fileType: file.type
        });
      }
    };
    reader.onerror = () => {
      trackEvent('error_encountered', {
        errorType: 'file_read_error',
        fileName: file.name
      });
    };
    reader.readAsText(file);
  }, [onJsonSubmit]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
    // Reset input to allow same file selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileRead]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set isDragOver to false if we're leaving the component entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => 
      file.type === 'application/json' || 
      file.name.endsWith('.json') ||
      file.type === 'text/plain' ||
      file.type === ''
    );

    if (jsonFile) {
      handleFileRead(jsonFile);
    } else if (files.length > 0) {
      trackEvent('error_encountered', {
        errorType: 'unsupported_file_type',
        fileType: files[0].type
      });
    }

    // Handle dropped text
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText && !jsonFile) {
      setJsonText(droppedText);
      onJsonSubmit(droppedText, true); // Pass true to indicate tab switch should happen
      trackEvent('json_pasted', {
        fileSize: droppedText.length,
        source: 'drag_drop'
      });
    }
  }, [handleFileRead, onJsonSubmit]);

  const handleClear = useCallback(() => {
    setJsonText('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Text Input Area - Now takes most of the space */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Paste your JSON here
          </label>
          {jsonText && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear input"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <textarea
          ref={textareaRef}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Paste the JSON code here (your code is not saved anywhere)'
          className="flex-1 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors min-h-0"
          disabled={isLoading}
        />
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Press Ctrl+Enter (Cmd+Enter on Mac) to parse • Auto-fixes: ALL JSON errors silently
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {jsonText.length} characters
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <div className="font-medium">JSON Parse Error</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Submit Button - Now smaller */}
      <div className="mt-3">
        <button
          onClick={handleTextSubmit}
          disabled={!jsonText.trim() || isLoading}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-1.5 px-3 rounded text-sm transition-colors duration-200"
        >
          <FileText className="w-3 h-3" />
          <span>{isLoading ? 'Parsing...' : 'Parse JSON'}</span>
        </button>
      </div>

      {/* File Upload Area - Now at bottom and smaller */}
      <div className="mt-3">
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-all duration-200 ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center space-y-1">
            <Upload className="w-5 h-5 text-gray-400" />
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <button
                onClick={triggerFileInput}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Click to upload
              </button>
              {' '}or drag and drop your JSON file here
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              Supports .json files up to 1MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};