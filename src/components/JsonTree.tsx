import React, { useState, useCallback } from 'react';
import { Package } from 'lucide-react';
import { JsonNode as JsonNodeComponent } from './JsonNode';
import { JsonNode as JsonNodeType } from '../types/json';
import { trackEvent } from '../utils/analytics';

interface JsonTreeProps {
  nodes: JsonNodeType[];
  onToggleNode: (path: string) => void;
  onSelectNode: (path: string) => void;
  selectedNodePath?: string;
  searchQuery?: string;
  caseSensitive?: boolean;
  searchMatchIndices?: number[];
  currentMatchIndex?: number;
}

export const JsonTree: React.FC<JsonTreeProps> = ({
  nodes,
  onToggleNode,
  onSelectNode,
  selectedNodePath,
  searchQuery,
  caseSensitive = false,
  searchMatchIndices = [],
  currentMatchIndex = 0
}) => {
  const [copiedValue, setCopiedValue] = useState<string>('');

  const handleCopy = useCallback(async (value: string, type: 'value' | 'path') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      
      // Clear the copied state after 2 seconds
      setTimeout(() => {
        setCopiedValue('');
      }, 2000);

      trackEvent('value_copied', {
        copyType: type,
        valueLength: value.length
      });
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedValue(value);
      setTimeout(() => {
        setCopiedValue('');
      }, 2000);
    }
  }, []);

  if (!nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400">
        <Package className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium mb-1">No JSON data to display</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Parse some JSON to see the tree view here
        </p>
      </div>
    );
  }

  return (
    <div className="json-tree text-sm space-y-0">
      {nodes.map((node, index) => {
        const isCurrentMatch = searchMatchIndices.length > 0 && 
          searchMatchIndices[currentMatchIndex] === index;
        
        return (
          <JsonNodeComponent
            key={`${node.path}-${index}`}
            node={node}
            onToggle={onToggleNode}
            onSelect={onSelectNode}
            isSelected={selectedNodePath === node.path}
            onCopy={handleCopy}
            searchQuery={searchQuery}
            caseSensitive={caseSensitive}
            copiedValue={copiedValue}
            isCurrentMatch={isCurrentMatch}
          />
        );
      })}
    </div>
  );
};