import { useState, useCallback, useEffect } from 'react';
import { FileCode, BarChart3, Upload, Copy, Square, Trash2, FileText, FoldVertical, UnfoldVertical, ChevronUp, ChevronDown, X, Github, Linkedin, Twitter, Globe, Heart, Bug, Maximize } from 'lucide-react';
import { JsonInput } from './components/JsonInput';
import { JsonTree } from './components/JsonTree';
import { ThemeToggle } from './components/ThemeToggle';
import { JsonTableView } from './components/JsonTableView';
import { ResizablePanel } from './components/ResizablePanel';
import { jsonParser } from './utils/jsonParser';
import { trackEvent } from './utils/analytics';
import { JsonNode, JsonValue } from './types/json';

function App() {
  const [jsonData, setJsonData] = useState<JsonValue | null>(null);
  const [nodes, setNodes] = useState<JsonNode[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<JsonNode[]>([]);
  const [originalNodes, setOriginalNodes] = useState<JsonNode[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchMatchIndices, setSearchMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'viewer' | 'text'>('text');
  const [inputText, setInputText] = useState<string>('');
  const [lastParsedInput, setLastParsedInput] = useState<string>('');
  const [selectedNodePath, setSelectedNodePath] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{line?: number; column?: number; position?: number} | undefined>();

  useEffect(() => {
    trackEvent('app_loaded', {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fullscreen functions
  const enterFullscreen = useCallback(async () => {
    try {
      const fullscreenElement = document.getElementById('json-tree-fullscreen');
      if (fullscreenElement && fullscreenElement.requestFullscreen) {
        await fullscreenElement.requestFullscreen();
      }
    } catch (error) {
      console.warn('Failed to enter fullscreen:', error);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Failed to exit fullscreen:', error);
    }
  }, []);

  const handleJsonSubmit = useCallback(async (jsonText: string, shouldSwitchTab = false) => {
    setIsLoading(true);
    setError('');
    setErrorDetails(undefined);
    setInputText(jsonText);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = jsonParser.parseJson(jsonText);
      
      if (result.success && result.data !== undefined) {
        setJsonData(result.data);
        const newNodes = jsonParser.convertToNodes(result.data);
        setNodes(newNodes);
        setFilteredNodes(newNodes);
        setOriginalNodes(newNodes);
        // Track the input that was successfully parsed
        setLastParsedInput(jsonText);
        // Auto-select root node when data is loaded
        setSelectedNodePath('root');
        // Switch to viewer tab only if parsing was successful and requested
        if (shouldSwitchTab) {
          setActiveTab('viewer');
        }
      } else {
        setError(result.error || 'Failed to parse JSON');
        setErrorDetails(result.errorDetails);
        setJsonData(null);
        setNodes([]);
        setFilteredNodes([]);
        setOriginalNodes([]);
      }
    } catch (err) {
      setError('Unexpected error occurred while parsing JSON');
      setErrorDetails(undefined);
      trackEvent('error_encountered', {
        errorType: 'unexpected_parse_error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);


  const handleToggleNode = useCallback((path: string) => {
    // When searching, we don't allow manual toggle to maintain search results
    if (searchQuery) return;
    
    const targetNode = nodes.find(node => node.path === path);
    if (!targetNode) return;

    let updatedNodes: JsonNode[];
    
    if (targetNode.isExpanded) {
      updatedNodes = jsonParser.collapseNode(nodes, path);
    } else {
      updatedNodes = jsonParser.expandNode(nodes, path);
    }
    
    setNodes(updatedNodes);
    setOriginalNodes(updatedNodes);
    setFilteredNodes(updatedNodes);
  }, [nodes, searchQuery]);

  const handleSelectNode = useCallback((path: string) => {
    setSelectedNodePath(path);
  }, []);

  const handleSearch = useCallback((query: string, isCaseSensitive: boolean) => {
    setSearchQuery(query);
    setCaseSensitive(isCaseSensitive);
    
    if (query.trim()) {
      const searchResult = jsonParser.searchNodes(originalNodes, query, isCaseSensitive);
      // Update both nodes and filtered nodes since search may expand the tree
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
      
      // Auto-select the first match if available
      if (searchResult.matchIndices.length > 0) {
        const firstMatchNode = searchResult.nodes[searchResult.matchIndices[0]];
        if (firstMatchNode) {
          setSelectedNodePath(firstMatchNode.path);
        }
      }
    } else {
      // Restore to current state of nodes (which may have been manually expanded/collapsed)
      setFilteredNodes(nodes);
      setSearchMatchIndices([]);
      setCurrentMatchIndex(0);
    }
  }, [originalNodes, nodes]);

  const handlePaste = useCallback(async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setError('Clipboard API not available. Please use Ctrl+V or Cmd+V to paste.');
        return;
      }

      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('Clipboard is empty or contains no text.');
        return;
      }

      handleJsonSubmit(text, false); // Don't switch tabs for paste
      trackEvent('feature_used', { featureName: 'paste' });
    } catch (err) {
      console.warn('Failed to read clipboard:', err);
      setError('Failed to read from clipboard. Make sure you have given permission to access clipboard, or try using Ctrl+V or Cmd+V to paste directly into the text area.');
    }
  }, [handleJsonSubmit]);

  const handleCopy = useCallback(() => {
    if (jsonData) {
      navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
      trackEvent('feature_used', { featureName: 'copy' });
    }
  }, [jsonData]);

  const handleFormat = useCallback(() => {
    if (jsonData) {
      const formatted = JSON.stringify(jsonData, null, 2);
      setInputText(formatted);
      trackEvent('feature_used', { featureName: 'format' });
    }
  }, [jsonData]);

  const handleRemoveWhitespace = useCallback(() => {
    if (jsonData) {
      const compressed = JSON.stringify(jsonData);
      setInputText(compressed);
      trackEvent('feature_used', { featureName: 'remove_whitespace' });
    }
  }, [jsonData]);

  const handleViewerTabClick = useCallback(async () => {
    // Check if there's unparsed text or text that has changed since last parse
    const currentInputText = inputText.trim();
    
    if (currentInputText && currentInputText !== lastParsedInput) {
      // Auto-parse the text when switching to viewer tab if:
      // 1. There's input text AND it's different from what was last successfully parsed
      setIsLoading(true);
      setError('');
      setErrorDetails(undefined);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = jsonParser.parseJson(currentInputText);
        
        if (result.success && result.data !== undefined) {
          setJsonData(result.data);
          const newNodes = jsonParser.convertToNodes(result.data);
          setNodes(newNodes);
          setFilteredNodes(newNodes);
          setOriginalNodes(newNodes);
          setLastParsedInput(currentInputText);
          setSelectedNodePath('root');
          setActiveTab('viewer');
        } else {
          // If parsing fails, show error and redirect back to JSON tab
          setError(result.error || 'Failed to parse JSON');
          setErrorDetails(result.errorDetails);
          setJsonData(null);
          setNodes([]);
          setFilteredNodes([]);
          setOriginalNodes([]);
          setActiveTab('text'); // Redirect back to JSON tab on error
          trackEvent('auto_parse_error', {
            errorType: 'parse_failure',
            errorMessage: result.error || 'Unknown error'
          });
        }
      } catch (err) {
        // If unexpected error occurs, show error and redirect back to JSON tab
        setError('Unexpected error occurred while parsing JSON');
        setErrorDetails(undefined);
        setActiveTab('text'); // Redirect back to JSON tab on error
        trackEvent('auto_parse_error', {
          errorType: 'unexpected_error',
          errorMessage: err instanceof Error ? err.message : 'Unknown error'
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Just switch to viewer tab if input is the same as last parsed or no input text
      setActiveTab('viewer');
    }
  }, [inputText, lastParsedInput]);

  const handleClear = useCallback(() => {
    setJsonData(null);
    setNodes([]);
    setFilteredNodes([]);
    setOriginalNodes([]);
    setInputText('');
    setLastParsedInput('');
    setError('');
    setErrorDetails(undefined);
    setSearchQuery('');
    setSearchMatchIndices([]);
    setCurrentMatchIndex(0);
    setSelectedNodePath('');
    trackEvent('feature_used', { featureName: 'clear' });
  }, []);

  const handleLoadData = useCallback(() => {
    const sampleData = {
      "company": {
        "version": "1.0.0",
        "name": "NonStop io Technologies Pvt. Ltd.",
        "description": "Our applied AI solutions are designed to seamlessly integrate with your processes, making your business smarter, faster, and more efficient.",
        "website": "https://nonstopio.com/"
      },
      "user": {
        "id": 104,
        "firstName": "Ajay",
        "lastName": "Kumar",
        "email": "ajay.kumar@nonstopio.com",
        "github": "https://github.com/projectaj14",
        "bio": "Software expert with 9+ years in the field.",
        "account": {
          "status": "active",
          "type": "premium",
          "created": "2019-03-15T10:30:00Z",
          "lastLogin": "2024-01-23T14:22:00Z",
          "preferences": {
            "theme": "dark",
            "language": "en-IN",
            "currency": "INR",
            "notifications": {
              "email": true,
              "push": false,
              "sms": true
            }
          }
        }
      }
    };
    const jsonText = JSON.stringify(sampleData, null, 2);
    setInputText(jsonText);
    handleJsonSubmit(jsonText, false); // Don't switch tabs for load data
    trackEvent('feature_used', { featureName: 'load_sample' });
  }, [handleJsonSubmit]);

  const handleExpandAll = useCallback(() => {
    const expandedNodes = jsonParser.expandAllNodes(originalNodes);
    setOriginalNodes(expandedNodes);
    
    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(expandedNodes, searchQuery, caseSensitive);
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(expandedNodes);
      setFilteredNodes(expandedNodes);
    }
    
    trackEvent('feature_used', { featureName: 'expand_all' });
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleCollapseAll = useCallback(() => {
    const collapsedNodes = jsonParser.collapseAllNodes(originalNodes);
    setOriginalNodes(collapsedNodes);
    
    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(collapsedNodes, searchQuery, caseSensitive);
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(collapsedNodes);
      setFilteredNodes(collapsedNodes);
    }
    
    trackEvent('feature_used', { featureName: 'collapse_all' });
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleNavigateToNextMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const nextIndex = (currentMatchIndex + 1) % searchMatchIndices.length;
      setCurrentMatchIndex(nextIndex);
      const nodeIndex = searchMatchIndices[nextIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
      
      trackEvent('search_navigation', {
        direction: 'next',
        currentIndex: nextIndex,
        totalMatches: searchMatchIndices.length
      });
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  const handleNavigateToPrevMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const prevIndex = currentMatchIndex === 0 ? searchMatchIndices.length - 1 : currentMatchIndex - 1;
      setCurrentMatchIndex(prevIndex);
      const nodeIndex = searchMatchIndices[prevIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
      
      trackEvent('search_navigation', {
        direction: 'prev',
        currentIndex: prevIndex,
        totalMatches: searchMatchIndices.length
      });
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  return (
    <>
      {/* Fullscreen styles */}
      <style>{`
        #json-tree-fullscreen:fullscreen {
          background: white;
          padding: 0;
          margin: 0;
        }
        html.dark #json-tree-fullscreen:fullscreen {
          background: rgb(17 24 39);
        }
      `}</style>
      
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Tab Bar - Fixed */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center">
          <div className="flex">
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              JSON
            </button>
            <button
              onClick={handleViewerTabClick}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'viewer'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              Viewer
            </button>
          </div>
          <div className="ml-auto pr-4">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Toolbar - Only show for text tab - Fixed */}
      {activeTab === 'text' && (
        <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePaste}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Paste from clipboard (or use Ctrl+V/Cmd+V in the JSON input area)"
            >
              <Upload size={14} />
              <span>Paste</span>
            </button>
            
            <button
              onClick={handleCopy}
              disabled={!jsonData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy formatted JSON"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>
            
            <button
              onClick={handleFormat}
              disabled={!jsonData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Format JSON"
            >
              <Square size={14} />
              <span>Format</span>
            </button>
            
            <button
              onClick={handleRemoveWhitespace}
              disabled={!jsonData}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove whitespace"
            >
              Remove white space
            </button>
            
            <button
              onClick={handleClear}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Clear all"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
            
            <button
              onClick={handleLoadData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Load complex test JSON data"
            >
              <FileText size={14} />
              <span>Load Test JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar - Only show for viewer tab - Fixed */}
      {activeTab === 'viewer' && jsonData && (
        <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExpandAll}
              className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              title="Expand all nodes - Shows all nested objects and arrays"
            >
              <UnfoldVertical size={16} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              title="Collapse all nodes - Hides all nested objects and arrays"
            >
              <FoldVertical size={16} />
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value, caseSensitive)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) {
                      handleNavigateToPrevMatch();
                    } else {
                      handleNavigateToNextMatch();
                    }
                    e.preventDefault();
                  } else if (e.key === 'F3') {
                    if (e.shiftKey) {
                      handleNavigateToPrevMatch();
                    } else {
                      handleNavigateToNextMatch();
                    }
                    e.preventDefault();
                  }
                }}
                placeholder="Search JSON... (Enter: next, Shift+Enter: prev)"
                className="w-full px-3 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('', caseSensitive)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-3 py-2 text-sm rounded transition-colors ${
                caseSensitive 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
              title="Toggle case sensitivity - Match exact case when enabled"
            >
              Aa
            </button>
            {searchQuery && searchMatchIndices.length > 0 && (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {currentMatchIndex + 1} of {searchMatchIndices.length}
                </div>
                <button
                  onClick={handleNavigateToPrevMatch}
                  className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  title="Previous match (Shift+Enter or Shift+F3)"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={handleNavigateToNextMatch}
                  className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  title="Next match (Enter or F3)"
                >
                  <ChevronDown size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - Text Input */}
        {activeTab === 'text' && (
          <div className="w-full p-4 overflow-hidden">
            <JsonInput
              onJsonSubmit={handleJsonSubmit}
              isLoading={isLoading}
              error={error}
              initialValue={inputText}
              onError={setError}
              onChange={setInputText}
              errorDetails={errorDetails}
            />
          </div>
        )}

        {/* Viewer Tab Content */}
        {activeTab === 'viewer' && (
          <ResizablePanel 
            initialLeftWidth={70} 
            minLeftWidth={50} 
            minRightWidth={30}
            className="flex-1"
          >
            {/* Left Panel - Tree View */}
            <div className="h-full bg-white dark:bg-gray-800 min-w-0 overflow-hidden">
              {jsonData ? (
                <div className="h-full flex flex-col">
                  {/* Tree Header */}
                  <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">JSON Tree</span>
                    <button
                      onClick={enterFullscreen}
                      className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="View in fullscreen"
                    >
                      <Maximize size={16} className="text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Fullscreen</span>
                    </button>
                  </div>
                  {/* Tree Content - Independent Scroll */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    <div className="min-w-0">
                      <JsonTree
                        nodes={filteredNodes}
                        onToggleNode={handleToggleNode}
                        onSelectNode={handleSelectNode}
                        selectedNodePath={selectedNodePath}
                        searchQuery={searchQuery}
                        caseSensitive={caseSensitive}
                        searchMatchIndices={searchMatchIndices}
                        currentMatchIndex={currentMatchIndex}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No JSON data loaded</p>
                    <p className="text-sm">Use the JSON tab or toolbar buttons to load JSON</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Property Details */}
            <div className="h-full bg-gray-50 dark:bg-gray-800 min-w-0 overflow-hidden">
              {jsonData ? (
                <JsonTableView 
                  data={jsonData} 
                  searchQuery={searchQuery}
                  selectedNodePath={selectedNodePath}
                  nodes={nodes}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Property details will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4">
        <div className="px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo, Company Name and Social Links */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <img 
                  src="/favicon.png" 
                  alt="NonStop io Logo" 
                  className="w-6 h-6"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  NonStop io Technologies Pvt. Ltd.
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <a 
                  href="https://github.com/nonstopio" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="GitHub"
                >
                  <Github size={16} />
                </a>
                <a 
                  href="https://www.linkedin.com/company/nonstop-io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="LinkedIn"
                >
                  <Linkedin size={16} />
                </a>
                <a 
                  href="https://twitter.com/nonstopio" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Twitter"
                >
                  <Twitter size={16} />
                </a>
                <a 
                  href="https://nonstopio.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Website"
                >
                  <Globe size={16} />
                </a>
              </div>
            </div>
            
            {/* Visit Counter with Creative Label - Center */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Heart size={14} className="mr-1 text-red-500" />
                <span>Helped</span>
              </div>
              <img 
                src="https://visit-counter.vercel.app/counter.png?page=https%3A%2F%2Fjson.nonstopio.com%2F&s=34&c=039d65&bg=00000000&no=1&ff=electrolize&tb=&ta=" 
                alt="developers helped"
                className="h-6"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                developers parse JSON
              </span>
            </div>
            
            {/* Report Issues - Right */}
            <div className="flex items-center space-x-2">
              <a 
                href="https://github.com/nonstopio/json-viewer/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Report Issues"
              >
                <Bug size={16} />
                <span className="text-xs">Report Issues</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Fullscreen Tree Container */}
      <div 
        id="json-tree-fullscreen" 
        className={`${isFullscreen ? 'bg-white dark:bg-gray-900' : 'hidden'}`}
        style={isFullscreen ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999
        } : {}}
      >
        {isFullscreen && (
          <div className="h-full flex flex-col">
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">JSON Tree - Fullscreen View</h2>
              <button
                onClick={exitFullscreen}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Exit fullscreen (ESC)"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Fullscreen Tree Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {jsonData ? (
                <JsonTree
                  nodes={filteredNodes}
                  onToggleNode={handleToggleNode}
                  onSelectNode={handleSelectNode}
                  selectedNodePath={selectedNodePath}
                  searchQuery={searchQuery}
                  caseSensitive={caseSensitive}
                  searchMatchIndices={searchMatchIndices}
                  currentMatchIndex={currentMatchIndex}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No JSON data loaded</p>
                    <p className="text-sm">Use the JSON tab or toolbar buttons to load JSON</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      </div>
    </>
  );
}

export default App;
