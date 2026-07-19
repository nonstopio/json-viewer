import React, {useMemo, useState} from "react";
import {Copy, Check} from "lucide-react";
import {JsonValue} from "../types/json";
import {JsonNode} from "../types/json";
import {trackEvent} from "../utils/analytics";

interface JsonTableViewProps {
  data: JsonValue | null;
  searchQuery?: string;
  selectedNodePath?: string;
  nodes?: JsonNode[];
}

interface TableRow {
  name: string;
  value: string;
  // The raw value rendered as text, precomputed for copy + copied-state checks
  // (so we don't re-walk the data on every render).
  actual: string;
  type: string;
  path: string;
}

// Cap how many child rows the detail panel renders. It's an inspector, not the
// (virtualized) tree — a selected 20k-element array must not render 20k rows.
const MAX_TABLE_ROWS = 200;

// Render a raw JSON value as the text we copy to the clipboard.
const toActualString = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

export const JsonTableView: React.FC<JsonTableViewProps> = ({
  searchQuery = "",
  selectedNodePath,
  nodes = [],
}) => {
  const [copiedValue, setCopiedValue] = useState<string>("");

  const copyToClipboard = (
    rowData: TableRow,
    type: "name" | "value" | "path"
  ) => {
    let textToCopy: string;

    if (type === "name") {
      textToCopy = rowData.name;
    } else if (type === "path") {
      textToCopy = rowData.path;
    } else {
      // For value, use the precomputed raw JSON content
      textToCopy = rowData.actual;
    }

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopiedValue(textToCopy);
        setTimeout(() => setCopiedValue(""), 2000);

        trackEvent("property_detail_copied", {
          property: type,
          nodeType: "table_view",
          valueLength: textToCopy.length,
        });
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  const copyPathToClipboard = (path: string) => {
    navigator.clipboard
      .writeText(path)
      .then(() => {
        setCopiedValue(path);
        setTimeout(() => setCopiedValue(""), 2000);

        trackEvent("property_detail_copied", {
          property: "path",
          nodeType: "table_view",
          valueLength: path.length,
        });
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  const getValueType = (value: unknown): string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  };

  const getDisplayValue = (value: unknown): string => {
    if (value === null) return "null";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return `Array(${value.length})`;
      }
      return `Object(${Object.keys(value).length})`;
    }
    return String(value);
  };

  // The selected node already carries its parsed value, so read it directly
  // instead of re-walking the raw data by a (previously ambiguous) path string.
  const selectedNode = useMemo(
    () => nodes.find((node) => node.path === selectedNodePath) ?? null,
    [nodes, selectedNodePath]
  );
  const selectedNodeData = selectedNode ? selectedNode.value : null;

  // Total immediate children of the selected node (before capping).
  const totalChildCount = useMemo(() => {
    if (!selectedNodeData || typeof selectedNodeData !== "object") return 0;
    return Array.isArray(selectedNodeData)
      ? selectedNodeData.length
      : Object.keys(selectedNodeData).length;
  }, [selectedNodeData]);

  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];

    if (selectedNodeData === undefined || selectedNodeData === null)
      return rows;

    // If selected node is a primitive value, show just that value
    if (typeof selectedNodeData !== "object") {
      rows.push({
        name: selectedNode?.key || "value",
        value: getDisplayValue(selectedNodeData),
        actual: toActualString(selectedNodeData),
        type: getValueType(selectedNodeData),
        path: selectedNodePath || "",
      });
      return rows;
    }

    // Show immediate properties, capped: this panel is a detail inspector, not
    // the tree. Rendering (and JSON.stringify-ing) every child of a huge array
    // would freeze the tab — the tree is where you explore all of them.
    if (Array.isArray(selectedNodeData)) {
      const limit = Math.min(selectedNodeData.length, MAX_TABLE_ROWS);
      for (let index = 0; index < limit; index++) {
        const item = selectedNodeData[index];
        rows.push({
          name: `[${index}]`,
          value: getDisplayValue(item),
          actual: toActualString(item),
          type: getValueType(item),
          path: selectedNodePath
            ? `${selectedNodePath}[${index}]`
            : `[${index}]`,
        });
      }
    } else {
      const entries = Object.entries(selectedNodeData);
      const limit = Math.min(entries.length, MAX_TABLE_ROWS);
      for (let i = 0; i < limit; i++) {
        const [key, value] = entries[i];
        rows.push({
          name: key,
          value: getDisplayValue(value),
          actual: toActualString(value),
          type: getValueType(value),
          path: selectedNodePath ? `${selectedNodePath}.${key}` : key,
        });
      }
    }

    return rows;
  }, [selectedNodeData, selectedNodePath, selectedNode]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return tableRows;

    const query = searchQuery.toLowerCase();
    return tableRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.value.toLowerCase().includes(query) ||
        row.path.toLowerCase().includes(query)
    );
  }, [tableRows, searchQuery]);

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "string":
        return "text-blue-600 dark:text-blue-400";
      case "number":
        return "text-orange-600 dark:text-orange-400";
      case "boolean":
        return "text-green-600 dark:text-green-400";
      case "null":
        return "text-gray-500 dark:text-gray-400";
      case "array":
        return "text-purple-600 dark:text-purple-400";
      case "object":
        return "text-indigo-600 dark:text-indigo-400";
      default:
        return "text-gray-600 dark:text-gray-300";
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
              <span className="font-mono">
                {selectedNodePath === "root" ? "root" : selectedNodePath}
              </span>
              <span className="ml-2">
                ({filteredRows.length}{" "}
                {filteredRows.length === 1 ? "property" : "properties"})
              </span>
            </>
          ) : (
            "Select a node to view details"
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
                <div className="flex items-start space-x-1">
                  <span
                    className="font-medium text-gray-800 dark:text-gray-200 break-all"
                    title={row.name}
                  >
                    {highlightText(row.name)}
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-mono ${getTypeColor(row.type)} bg-gray-100 dark:bg-gray-700`}
                  >
                    {row.type}
                  </span>
                  <span
                    className="text-gray-600 dark:text-gray-400 break-all flex-1 font-mono"
                    title={row.value}
                  >
                    {highlightText(row.value)}
                  </span>
                </div>
                <div className="flex items-start justify-center space-x-1 opacity-100 transition-opacity">
                  {/* Copy Name Button */}
                  <button
                    onClick={() => copyToClipboard(row, "name")}
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
                    onClick={() => copyToClipboard(row, "value")}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Copy value"
                  >
                    {copiedValue === row.actual ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
              </div>
            ))}
            {totalChildCount > tableRows.length && (
              <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
                Showing first {tableRows.length} of {totalChildCount} — open
                this node in the tree to explore the rest.
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              {selectedNodePath ? (
                <>
                  <p className="text-sm">No properties found</p>
                  {searchQuery && (
                    <p className="text-xs mt-1">
                      Try adjusting your search query
                    </p>
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
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Type:
              </span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {getValueType(selectedNodeData)}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Properties:
              </span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {totalChildCount || filteredRows.length}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Path:
              </span>
              <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                {selectedNodePath}
              </span>
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
