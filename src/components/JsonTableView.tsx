import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { JsonValue } from '../types/json';
import { JsonNode } from '../types/json';
import { trackEvent } from '../utils/analytics';

interface JsonTableViewProps {
  data: JsonValue | null;
  searchQuery?: string;
  selectedNodePath?: string;
  nodes?: JsonNode[];
}

interface TableRow {
  name: string;
  value: string;
  type: string;
  path: string;
}

export const JsonTableView: React.FC<JsonTableViewProps> = ({ data, searchQuery = '', selectedNodePath, nodes = [] }) => {
  const [copiedValue, setCopiedValue] = useState<string>('');

  const getActualValue = (rowData: TableRow): string => {
    // Get the actual value from the data using the path
    const getValueFromPath = (data: unknown, path: string): unknown => {
      if (!path || path === 'root') return data;
      
      // Remove 'root.' prefix if present
      const cleanPath = path.startsWith('root.') ? path.substring(5) : path;
      if (!cleanPath) return data;
      
      // Improved path parsing to handle array indices like [0]
      const parts: string[] = [];
      let currentPart = '';
      let inBrackets = false;
      
      for (let i = 0; i < cleanPath.length; i++) {
        const char = cleanPath[i];
        
        if (char === '[') {
          if (currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
          inBrackets = true;
        } else if (char === ']') {
          if (inBrackets && currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
          inBrackets = false;
        } else if (char === '.' && !inBrackets) {
          if (currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
        } else {
          currentPart += char;
        }
      }
      
      if (currentPart) {
        parts.push(currentPart);
      }
      
      let current = data;
      
      for (const part of parts) {
        if (current === null || current === undefined) return null;
        
        // Check if this part is a numeric index for arrays
        const index = parseInt(part, 10);
        if (!isNaN(index) && Array.isArray(current)) {
          current = current[index];
        } else if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      
      return current;
    };

    const actualValue = getValueFromPath(data, rowData.path);
    
    if (actualValue === null) return 'null';
    if (typeof actualValue === 'string') return actualValue;
    if (typeof actualValue === 'object') {
      return JSON.stringify(actualValue, null, 2);
    }
    return String(actualValue);
  };

  const copyToClipboard = (rowData: TableRow, type: 'name' | 'value' | 'path') => {
    let textToCopy: string;
    
    if (type === 'name') {
      textToCopy = rowData.name;
    } else if (type === 'path') {
      textToCopy = rowData.path;
    } else {
      // For value, get the actual JSON content
      textToCopy = getActualValue(rowData);
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedValue(textToCopy);
      setTimeout(() => setCopiedValue(''), 2000);
      
      trackEvent('property_detail_copied', {
        property: type,
        nodeType: 'table_view',
        valueLength: textToCopy.length
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      setCopiedValue(path);
      setTimeout(() => setCopiedValue(''), 2000);
      
      trackEvent('property_detail_copied', {
        property: 'path',
        nodeType: 'table_view',
        valueLength: path.length
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const getValueType = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const getDisplayValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `Array(${value.length})`;
      }
      return `Object(${Object.keys(value).length})`;
    }
    return String(value);
  };

  // Get the selected node's data
  const selectedNodeData = useMemo(() => {
    if (!selectedNodePath || !nodes.length) return null;
    
    const selectedNode = nodes.find(node => node.path === selectedNodePath);
    if (!selectedNode) return null;
    
    // Get the actual value from the data using the path
    const getValueFromPath = (data: unknown, path: string): unknown => {
      if (!path || path === 'root') return data;
      
      // Remove 'root.' prefix if present
      const cleanPath = path.startsWith('root.') ? path.substring(5) : path;
      if (!cleanPath) return data;
      
      // Improved path parsing to handle array indices like [0]
      const parts: string[] = [];
      let currentPart = '';
      let inBrackets = false;
      
      for (let i = 0; i < cleanPath.length; i++) {
        const char = cleanPath[i];
        
        if (char === '[') {
          if (currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
          inBrackets = true;
        } else if (char === ']') {
          if (inBrackets && currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
          inBrackets = false;
        } else if (char === '.' && !inBrackets) {
          if (currentPart) {
            parts.push(currentPart);
            currentPart = '';
          }
        } else {
          currentPart += char;
        }
      }
      
      if (currentPart) {
        parts.push(currentPart);
      }
      
      let current = data;
      
      for (const part of parts) {
        if (current === null || current === undefined) return null;
        
        // Check if this part is a numeric index for arrays
        const index = parseInt(part, 10);
        if (!isNaN(index) && Array.isArray(current)) {
          current = current[index];
        } else if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      
      return current;
    };
    
    return getValueFromPath(data, selectedNodePath);
  }, [selectedNodePath, nodes, data]);

  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];
    
    if (selectedNodeData === undefined || selectedNodeData === null) return rows;
    
    // If selected node is a primitive value, show just that value
    if (typeof selectedNodeData !== 'object' || selectedNodeData === null) {
      rows.push({
        name: selectedNodePath?.split(/\.(?![^[]*])|[|]/).filter(Boolean).pop() || 'value',
        value: getDisplayValue(selectedNodeData),
        type: getValueType(selectedNodeData),
        path: selectedNodePath || ''
      });
      return rows;
    }
    
    // If it's an object or array, show its immediate properties
    if (Array.isArray(selectedNodeData)) {
      selectedNodeData.forEach((item, index) => {
        rows.push({
          name: `[${index}]`,
          value: getDisplayValue(item),
          type: getValueType(item),
          path: selectedNodePath ? `${selectedNodePath}[${index}]` : `[${index}]`
        });
      });
    } else if (typeof selectedNodeData === 'object') {
      Object.entries(selectedNodeData).forEach(([key, value]) => {
        rows.push({
          name: key,
          value: getDisplayValue(value),
          type: getValueType(value),  
          path: selectedNodePath ? `${selectedNodePath}.${key}` : key
        });
      });
    }
    
    return rows;
  }, [selectedNodeData, selectedNodePath]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return tableRows;
    
    const query = searchQuery.toLowerCase();
    return tableRows.filter(row => 
      row.name.toLowerCase().includes(query) || 
      row.value.toLowerCase().includes(query) ||
      row.path.toLowerCase().includes(query)
    );
  }, [tableRows, searchQuery]);

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'text-blue-600 dark:text-blue-400';
      case 'number': return 'text-orange-600 dark:text-orange-400';
      case 'boolean': return 'text-green-600 dark:text-green-400';
      case 'null': return 'text-gray-500 dark:text-gray-400';
      case 'array': return 'text-purple-600 dark:text-purple-400';
      case 'object': return 'text-indigo-600 dark:text-indigo-400';
      default: return 'text-gray-600 dark:text-gray-300';
    }
  };

  const highlightText = (text: string): React.ReactNode => {
    if (!searchQuery || !searchQuery.trim()) return text;

    const query = searchQuery.toLowerCase();
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);

    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-300 dark:bg-yellow-600 px-1 rounded">
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Property Details
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {selectedNodePath ? (
            <>
              <span className="font-mono">{selectedNodePath === 'root' ? 'root' : selectedNodePath}</span>
              <span className="ml-2">({filteredRows.length} {filteredRows.length === 1 ? 'property' : 'properties'})</span>
            </>
          ) : (
            'Select a node to view details'
          )}
        </p>
      </div>

      {/* Table Header - Fixed */}
      <div className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
        <div className="grid grid-cols-[1fr_2fr_60px] gap-2 p-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <div>Name</div>
          <div>Value</div>
          <div className="text-center">Actions</div>
        </div>
      </div>

      {/* Table Content - Independent Scroll */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {filteredRows.length > 0 ? (
          <div>
            {filteredRows.map((row, index) => (
              <div
                key={`${row.path}-${index}`}
                className="grid grid-cols-[1fr_2fr_60px] gap-2 p-2 text-xs border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate" title={row.name}>
                    {highlightText(row.name)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${getTypeColor(row.type)} bg-gray-100 dark:bg-gray-700`}>
                    {row.type}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1 font-mono" title={row.value}>
                    {highlightText(row.value)}
                  </span>
                </div>
                <div className="flex items-center justify-center space-x-1 opacity-100 transition-opacity">
                  {/* Copy Name Button */}
                  <button
                    onClick={() => copyToClipboard(row, 'name')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Copy name"
                  >
                    {copiedValue === row.name ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                  {/* Copy Value Button */}
                  <button
                    onClick={() => copyToClipboard(row, 'value')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Copy value"
                  >
                    {copiedValue === getActualValue(row) ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              {selectedNodePath ? (
                <>
                  <p className="text-sm">No properties found</p>
                  {searchQuery && (
                    <p className="text-xs mt-1">Try adjusting your search query</p>
                  )}
                </>
              ) : (
                <p className="text-sm">Select a node to view its properties</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Footer - Fixed */}
      {selectedNodePath && (
        <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 p-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">{getValueType(selectedNodeData)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Properties:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">{filteredRows.length}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">Path:</span>
              <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{selectedNodePath}</span>
            </div>
            <button
              onClick={() => copyPathToClipboard(selectedNodePath)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors ml-2"
              title="Copy path"
            >
              {copiedValue === selectedNodePath ? (
                <Check size={12} className="text-green-500" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};