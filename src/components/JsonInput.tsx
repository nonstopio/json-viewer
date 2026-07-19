import React, {useState, useRef, useCallback, useEffect} from "react";
import CodeMirror, {ReactCodeMirrorRef} from "@uiw/react-codemirror";
import {json} from "@codemirror/lang-json";
import {Upload, FileText, X, AlertCircle} from "lucide-react";

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
  wasModified?: boolean;
}

export const JsonInput: React.FC<JsonInputProps> = ({
  onJsonSubmit,
  isLoading = false,
  error,
  initialValue = "",
  onError,
  onChange,
  errorDetails,
  wasModified = false,
}) => {
  const [jsonText, setJsonText] = useState(initialValue);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isJumpingToError, setIsJumpingToError] = useState(false);
  const [hasAutoJumped, setHasAutoJumped] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Mirror the app's dark mode (toggled via the `dark` class on <html>) so the
  // editor theme matches.
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setJsonText(initialValue);
  }, [initialValue]);

  // Reset auto-jump flag when error changes or is cleared
  useEffect(() => {
    if (!error) {
      setHasAutoJumped(false);
    }
  }, [error]);

  const handleJumpToError = useCallback(async () => {
    if (!editorRef.current?.view || !errorDetails || !jsonText) {
      return;
    }

    setIsJumpingToError(true);

    try {
      let cursorPosition = 0;

      // Calculate cursor position based on available error details
      if (errorDetails.position !== undefined) {
        cursorPosition = Math.min(errorDetails.position, jsonText.length);
      } else if (
        errorDetails.line !== undefined &&
        errorDetails.column !== undefined
      ) {
        const lines = jsonText.split("\n");
        const targetLine = errorDetails.line - 1;

        if (targetLine >= 0 && targetLine < lines.length) {
          for (let i = 0; i < targetLine; i++) {
            cursorPosition += lines[i].length + 1;
          }
          const targetColumn = Math.min(
            errorDetails.column - 1,
            lines[targetLine].length
          );
          cursorPosition += Math.max(0, targetColumn);
        }
      }

      if (cursorPosition > jsonText.length) {
        cursorPosition = jsonText.length;
      }

      // Calculate selection range for the error
      let selectionStart = cursorPosition;
      let selectionEnd = cursorPosition;

      if (error && error.toLowerCase().includes("unterminated string")) {
        // Find the start of the string by looking backwards for the opening quote
        let startQuotePos = cursorPosition - 1;
        while (startQuotePos > 0 && jsonText[startQuotePos] !== '"') {
          startQuotePos--;
        }
        selectionStart = startQuotePos;

        // Select to end of line or next quote
        let endPos = cursorPosition;
        while (endPos < jsonText.length && jsonText[endPos] !== "\n") {
          endPos++;
        }
        selectionEnd = endPos;
      } else if (
        error &&
        (error.toLowerCase().includes("trailing comma") ||
          error.toLowerCase().includes("remove the trailing comma"))
      ) {
        // For trailing comma errors, select the comma
        selectionStart = cursorPosition;
        selectionEnd = cursorPosition + 1;
      } else if (
        error &&
        (error.toLowerCase().includes("unexpected character") ||
          error.toLowerCase().includes("invalid character"))
      ) {
        // For invalid character errors, select the invalid character
        selectionStart = cursorPosition;
        selectionEnd = Math.min(cursorPosition + 1, jsonText.length);
      } else if (error && error.toLowerCase().includes("missing comma")) {
        // For missing comma errors, select the line that needs the comma
        const lines = jsonText.split("\n");
        if (errorDetails.line && errorDetails.line > 0) {
          const lineIndex = errorDetails.line - 1;
          if (lineIndex < lines.length) {
            // Calculate the start of the line
            let lineStart = 0;
            for (let i = 0; i < lineIndex; i++) {
              lineStart += lines[i].length + 1;
            }
            selectionStart = lineStart;
            selectionEnd = lineStart + lines[lineIndex].length;
          }
        }
      } else {
        // For other errors, select a word or small range around the error
        // Find word boundaries
        const wordBoundaries = /[\s,{}[\]:"]/;

        // Find start of word
        selectionStart = cursorPosition;
        while (
          selectionStart > 0 &&
          !wordBoundaries.test(jsonText[selectionStart - 1])
        ) {
          selectionStart--;
        }

        // Find end of word
        selectionEnd = cursorPosition;
        while (
          selectionEnd < jsonText.length &&
          !wordBoundaries.test(jsonText[selectionEnd])
        ) {
          selectionEnd++;
        }

        // If no word found, select a small range
        if (selectionStart === selectionEnd) {
          selectionStart = Math.max(0, cursorPosition - 5);
          selectionEnd = Math.min(jsonText.length, cursorPosition + 5);
        }
      }

      // Select the error range and scroll it into view in the editor.
      const view = editorRef.current.view;
      const max = view.state.doc.length;
      view.dispatch({
        selection: {
          anchor: Math.min(selectionStart, max),
          head: Math.min(selectionEnd, max),
        },
        scrollIntoView: true,
      });
      view.focus();
    } catch (error) {
      console.error("❌ Error jumping to position:", error);
    } finally {
      setIsJumpingToError(false);
    }
  }, [errorDetails, jsonText, error]);

  // Automatically jump to error when error details are available
  useEffect(() => {
    if (
      errorDetails &&
      (errorDetails.line ||
        errorDetails.column ||
        errorDetails.position !== undefined) &&
      !hasAutoJumped
    ) {
      // Add a small delay to ensure the text has been rendered
      const timeoutId = setTimeout(() => {
        handleJumpToError();
        setHasAutoJumped(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [errorDetails, handleJumpToError, hasAutoJumped]);

  const handleTextSubmit = useCallback(() => {
    if (jsonText.trim()) {
      onJsonSubmit(jsonText.trim(), true); // Pass true to indicate tab switch should happen
    }
  }, [jsonText, onJsonSubmit]);

  const handleFileRead = useCallback(
    (file: File) => {
      const maxSize = 5 * 1024 * 1024; // 5MB limit
      if (file.size > maxSize) {
        const errorMsg = `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 5MB`;
        onError?.(errorMsg);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setJsonText(content);
          onChange?.(content);
          onJsonSubmit(content, true); // Pass true to indicate tab switch should happen
        }
      };
      reader.readAsText(file);
    },
    [onJsonSubmit, onError, onChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileRead(file);
      }
      // Reset input to allow same file selection
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileRead]
  );

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const jsonFile = files.find(
        (file) =>
          file.type === "application/json" ||
          file.name.endsWith(".json") ||
          file.type === "text/plain" ||
          file.type === ""
      );

      if (jsonFile) {
        handleFileRead(jsonFile);
      }

      // Handle dropped text
      const droppedText = e.dataTransfer.getData("text/plain");
      if (droppedText && !jsonFile) {
        setJsonText(droppedText);
        onChange?.(droppedText);
        onJsonSubmit(droppedText, true); // Pass true to indicate tab switch should happen
      }
    },
    [handleFileRead, onJsonSubmit, onChange]
  );

  const handleClear = useCallback(() => {
    setJsonText("");
    onChange?.("");
    editorRef.current?.view?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleTextSubmit();
      }
    },
    [handleTextSubmit]
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Text Input Area - Now takes most of the space.
          min-h-0 lets this flex item shrink to the available height instead of
          growing to the editor's full content height (flex default is
          min-height:auto), which is what keeps scrolling inside the editor. */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Paste your JSON here
          </label>
          {jsonText && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              data-tooltip="Clear input"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* CodeMirror virtualizes line rendering, so it stays fast on
            multi-MB / hundreds-of-thousands-of-lines input where a plain
            <textarea> would block the main thread laying out every line. */}
        <div
          className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 dark:border-gray-600"
          onKeyDown={handleKeyDown}
        >
          <CodeMirror
            ref={editorRef}
            value={jsonText}
            height="100%"
            theme={isDark ? "dark" : "light"}
            extensions={[json()]}
            editable={!isLoading}
            placeholder="Paste the JSON code here (your code is not saved anywhere)"
            onChange={(value) => {
              setJsonText(value);
              onChange?.(value);
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
            style={{height: "100%", fontSize: "13px"}}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Ctrl+Enter (Cmd+Enter) to parse • Attempts to auto-fix common errors
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {jsonText.length} characters
          </div>
        </div>
      </div>

      {/* Auto-fix notice — the parsed result may differ from the raw input */}
      {!error && wasModified && (
        <div className="mt-3 flex items-start space-x-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <div className="font-medium">Input was auto-corrected</div>
            <div className="mt-1 text-xs">
              Your JSON didn&apos;t parse as-is, so it was cleaned up before
              displaying. The result may differ from what you pasted — verify it
              looks right.
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <div className="font-medium">JSON Parse Error</div>
            <div className="mt-1">{error}</div>
            {errorDetails &&
              (errorDetails.line ||
                errorDetails.column ||
                errorDetails.position !== undefined) && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                  {errorDetails.line && errorDetails.column
                    ? `Error at line ${errorDetails.line}, column ${errorDetails.column}`
                    : errorDetails.line
                      ? `Error at line ${errorDetails.line}`
                      : errorDetails.column
                        ? `Error at column ${errorDetails.column}`
                        : `Error at position ${errorDetails.position}`}
                  {errorDetails.position &&
                    ` (position ${errorDetails.position})`}
                  {hasAutoJumped && (
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      ✓ Auto-jumped to error
                    </span>
                  )}
                  <button
                    onClick={handleJumpToError}
                    disabled={isJumpingToError}
                    className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-tooltip="Click to jump to error location"
                  >
                    {isJumpingToError ? (
                      <>
                        <span className="inline-block animate-spin w-3 h-3 border border-red-500 border-t-transparent rounded-full mr-1"></span>
                        Finding...
                      </>
                    ) : hasAutoJumped ? (
                      <>🔄 Jump Again</>
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
          <span>{isLoading ? "Parsing..." : "Parse JSON"}</span>
        </button>
      </div>

      {/* File Upload Area - Now at bottom and smaller */}
      <div className="mt-3">
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-all duration-200 ${
            isDragOver
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
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
              </button>{" "}
              or drag and drop your JSON file here
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
