import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface JsonInputProps {
  onJsonSubmit: (json: string, shouldSwitchTab?: boolean) => void;
  isLoading?: boolean;
  error?: string;
  initialValue?: string;
  onError?: (error: string) => void;
  onChange?: (text: string) => void;
  errorDetails?: {
    line?: number;
    column?: number;
    position?: number;
  };
}

export const JsonInput: React.FC<JsonInputProps> = ({
  onJsonSubmit,
  isLoading = false,
  error,
  initialValue = '',
  onError,
  onChange,
  errorDetails
}) => {
  const [jsonText, setJsonText] = useState(initialValue);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isJumpingToError, setIsJumpingToError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setJsonText(initialValue);
  }, [initialValue]);

  const handleJumpToError = useCallback(async () => {
    if (!textareaRef.current || !errorDetails || !jsonText) {
      console.log('Cannot position cursor - missing refs or data:', {
        hasTextarea: !!textareaRef.current,
        hasErrorDetails: !!errorDetails,
        hasJsonText: !!jsonText
      });
      return;
    }

    setIsJumpingToError(true);
    
    try {
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      const textarea = textareaRef.current;
      let cursorPosition = 0;

      console.log('🎯 Jumping to error:', errorDetails);
      console.log('📝 Text length:', jsonText.length);

      // Calculate cursor position based on available error details
      if (errorDetails.position !== undefined) {
        cursorPosition = Math.min(errorDetails.position, jsonText.length);
        console.log('📍 Using direct position:', errorDetails.position, 'clamped to:', cursorPosition);
      } else if (errorDetails.line !== undefined && errorDetails.column !== undefined) {
        const lines = jsonText.split('\n');
        const targetLine = errorDetails.line - 1;
        
        console.log('📊 Calculating from line/column:', errorDetails.line, errorDetails.column);
        console.log('📋 Total lines:', lines.length, 'Target line index:', targetLine);
        
        if (targetLine >= 0 && targetLine < lines.length) {
          for (let i = 0; i < targetLine; i++) {
            cursorPosition += lines[i].length + 1;
          }
          const targetColumn = Math.min(errorDetails.column - 1, lines[targetLine].length);
          cursorPosition += Math.max(0, targetColumn);
          
          console.log('🧮 Calculated position:', cursorPosition, 'from line', targetLine, 'column', targetColumn);
          console.log('📄 Line content:', JSON.stringify(lines[targetLine]));
        }
      }

      console.log('✅ Final cursor position:', cursorPosition);

      if (cursorPosition > jsonText.length) {
        cursorPosition = jsonText.length;
      }

      // Focus and position cursor
      textarea.focus();
      
      const selectionStart = cursorPosition;
      const selectionEnd = Math.min(cursorPosition + 5, jsonText.length);
      
      textarea.setSelectionRange(selectionStart, selectionEnd);
      
      // Scroll to position
      if (errorDetails.line) {
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const scrollPosition = Math.max(0, (errorDetails.line - 3) * lineHeight);
        textarea.scrollTop = scrollPosition;
      }
      
      console.log('✅ Jumped to error position:', selectionStart, 'to', selectionEnd);
      
      trackEvent('error_cursor_positioned', {
        errorLine: errorDetails.line,
        errorColumn: errorDetails.column,
        errorPosition: errorDetails.position,
        calculatedPosition: cursorPosition
      });
      
    } catch (error) {
      console.error('❌ Error jumping to position:', error);
    } finally {
      setIsJumpingToError(false);
    }
  }, [errorDetails, jsonText]);

  const handleTextSubmit = useCallback(() => {
    if (jsonText.trim()) {
      onJsonSubmit(jsonText.trim(), true); // Pass true to indicate tab switch should happen
      trackEvent('json_pasted', {
        fileSize: jsonText.length
      });
    }
  }, [jsonText, onJsonSubmit]);

  const handleFileRead = useCallback((file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      const errorMsg = `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 5MB`;
      onError?.(errorMsg);
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
        onChange?.(content);
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
  }, [onJsonSubmit, onError, onChange]);

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
      onChange?.(droppedText);
      onJsonSubmit(droppedText, true); // Pass true to indicate tab switch should happen
      trackEvent('json_pasted', {
        fileSize: droppedText.length,
        source: 'drag_drop'
      });
    }
  }, [handleFileRead, onJsonSubmit, onChange]);

  const handleClear = useCallback(() => {
    setJsonText('');
    onChange?.('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [onChange]);

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
          onChange={(e) => {
            const newValue = e.target.value;
            setJsonText(newValue);
            onChange?.(newValue);
          }}
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
            {errorDetails && (errorDetails.line || errorDetails.column) && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                {errorDetails.line && errorDetails.column 
                  ? `Error at line ${errorDetails.line}, column ${errorDetails.column}`
                  : errorDetails.line 
                    ? `Error at line ${errorDetails.line}`
                    : `Error at column ${errorDetails.column}`
                }
                {errorDetails.position && ` (position ${errorDetails.position})`}
                <button
                  onClick={handleJumpToError}
                  disabled={isJumpingToError}
                  className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Click to jump to error location"
                >
                  {isJumpingToError ? (
                    <>
                      <span className="inline-block animate-spin w-3 h-3 border border-red-500 border-t-transparent rounded-full mr-1"></span>
                      Finding...
                    </>
                  ) : (
                    <>📍 Jump to Error</>
                  )}
                </button>
              </div>
            )}
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
              Supports .json files up to 5MB
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