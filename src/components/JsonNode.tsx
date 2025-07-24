import React, { useEffect, useRef } from 'react';
import { 
  Plus, 
  Minus, 
  Copy, 
  Check, 
  Braces, 
  Brackets, 
  Type, 
  Hash, 
  ToggleLeft,
  Circle,
  FileText,
  Package
} from 'lucide-react';
import { JsonNode as JsonNodeType } from '../types/json';
import { trackEvent } from '../utils/analytics';

interface JsonNodeProps {
  node: JsonNodeType;
  onToggle?: (path: string) => void;
  onSelect?: (path: string) => void;
  isSelected?: boolean;
  onCopy?: (value: string, type: 'value' | 'path') => void;
  searchQuery?: string;
  caseSensitive?: boolean;
  copiedValue?: string;
  isCurrentMatch?: boolean;
}

export const JsonNode: React.FC<JsonNodeProps> = ({
  node,
  onToggle,
  onSelect,
  isSelected = false,
  onCopy,
  searchQuery,
  caseSensitive = false,
  copiedValue,
  isCurrentMatch = false
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.type === 'object' || node.type === 'array';
  const canExpand = hasChildren && node.childCount && node.childCount > 0;

  // Auto-scroll to current match when it becomes active
  useEffect(() => {
    if (isCurrentMatch && nodeRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [isCurrentMatch]);

  // Auto-scroll to center when node is selected
  useEffect(() => {
    if (isSelected && nodeRef.current) {
      // Small delay to ensure DOM is updated and avoid conflicts with search scrolling
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 150);
    }
  }, [isSelected]);

  const handleToggle = () => {
    if (canExpand && onToggle) {
      onToggle(node.path);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggle();
  };

  const handleCopyValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const value = getValueAsString(node.value);
    onCopy?.(value, 'value');
    trackEvent('value_copied', {
      copyType: 'value',
      nodeType: node.type,
      valueLength: value.length
    });
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy?.(node.path, 'path');
    trackEvent('value_copied', {
      copyType: 'path',
      nodeType: node.type,
      pathLength: node.path.length
    });
  };

  const getValueAsString = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const highlightText = (text: string): React.ReactNode => {
    if (!searchQuery || !searchQuery.trim()) return text;

    const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const index = searchText.indexOf(query);

    if (index === -1) return text;

    const highlightClass = isCurrentMatch 
      ? "bg-orange-300 dark:bg-orange-600 px-1 rounded" 
      : "bg-yellow-300 dark:bg-yellow-600 px-1 rounded";

    return (
      <>
        {text.substring(0, index)}
        <mark className={highlightClass}>
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'object':
        return <Braces size={14} />;
      case 'array':
        return <Brackets size={14} />;
      case 'string':
        return <Type size={14} />;
      case 'number':
        return <Hash size={14} />;
      case 'boolean':
        return <ToggleLeft size={14} />;
      case 'null':
        return <Circle size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'object':
        return 'text-purple-600 dark:text-purple-400';
      case 'array':
        return 'text-blue-600 dark:text-blue-400';
      case 'string':
        return 'text-green-600 dark:text-green-400';
      case 'number':
        return 'text-orange-600 dark:text-orange-400';
      case 'boolean':
        return 'text-pink-600 dark:text-pink-400';
      case 'null':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-300';
    }
  };

  const renderValue = (): React.ReactNode => {
    const { value, type } = node;

    switch (type) {
      case 'string':
        return (
          <span className={`font-mono ${getTypeColor(type)}`}>
            "{highlightText(String(value))}"
          </span>
        );
      case 'number':
        return <span className={`font-mono ${getTypeColor(type)}`}>{highlightText(String(value))}</span>;
      case 'boolean':
        return (
          <span className={`font-mono ${getTypeColor(type)}`}>
            {highlightText(String(value))}
          </span>
        );
      case 'null':
        return <span className={`font-mono ${getTypeColor(type)}`}>null</span>;
      case 'array':
        return (
          <span className={`${getTypeColor(type)} flex items-center gap-1`} title={`Array with ${node.childCount} items`}>
            {getTypeIcon(type)}
          </span>
        );
      case 'object':
        return (
          <span className={`${getTypeColor(type)} flex items-center gap-1`} title={`Object with ${node.childCount} properties`}>
            {getTypeIcon(type)}
          </span>
        );
      default:
        return <span className="font-mono">{highlightText(String(value))}</span>;
    }
  };

  const isValueCopied = copiedValue === getValueAsString(node.value);
  const isPathCopied = copiedValue === node.path;

  const handleRowClick = () => {
    onSelect?.(node.path);
    if (canExpand) {
      handleToggle();
    }
  };

  return (
    <div 
      ref={nodeRef}
      className={`json-node flex items-center py-1 px-2 group transition-all duration-150 ${
        node.depth > 0 ? 'ml-2' : ''
      } ${
        isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500 shadow-sm' 
          : 'border-l-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
      } ${
        isCurrentMatch ? 'ring-2 ring-orange-400 ring-opacity-50' : ''
      } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-r`}
      style={{ marginLeft: `${node.depth * 16}px` }}
      onClick={handleRowClick}
    >
      {/* Expand/Collapse Button */}
      <div className="w-4 h-4 flex items-center justify-center mr-1">
        {canExpand ? (
          <button
            onClick={handleToggleClick}
            className={`w-3 h-3 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-150 ${
              node.isExpanded 
                ? 'bg-orange-500 hover:bg-orange-600 shadow-sm' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-sm'
            }`}
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
            title={node.isExpanded ? `Collapse ${node.key}` : `Expand ${node.key}`}
          >
            {node.isExpanded ? (
              <Minus size={8} />
            ) : (
              <Plus size={8} />
            )}
          </button>
        ) : (
          <div className="w-3" />
        )}
      </div>

      {/* Type Icon for primitive values */}
      {!hasChildren && (
        <span className={`mr-1 ${getTypeColor(node.type)}`} title={`Type: ${node.type}`}>
          {getTypeIcon(node.type)}
        </span>
      )}

      {/* Key */}
      {node.key && (
        <span className="font-medium text-gray-700 dark:text-gray-300 mr-1">
          {highlightText(node.key)}
          <span className="text-gray-500 dark:text-gray-500 ml-1">:</span>
        </span>
      )}

      {/* Value */}
      <span className="flex-1">
        {renderValue()}
      </span>

      {/* Copy Buttons */}
      <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 ml-1 flex items-center gap-0.5">
        {/* Copy Value Button */}
        <button
          onClick={handleCopyValue}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all duration-150"
          title="Copy value"
        >
          {isValueCopied ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Copy size={12} />
          )}
        </button>

        {/* Copy Path Button */}
        <button
          onClick={handleCopyPath}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all duration-150"
          title="Copy path"
        >
          {isPathCopied ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Package size={12} />
          )}
        </button>
      </div>
    </div>
  );
};