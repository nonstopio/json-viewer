import React, {useState} from "react";
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
  Package,
  Info,
} from "lucide-react";
import {JsonNode as JsonNodeType} from "../types/json";

interface JsonNodeProps {
  node: JsonNodeType;
  onToggle?: (path: string) => void;
  onSelect?: (path: string) => void;
  isSelected?: boolean;
  /** Inside the selected object, but not its head row. */
  isInSelection?: boolean;
  onCopy?: (value: string, type: "value" | "path") => void;
  searchQuery?: string;
  caseSensitive?: boolean;
  copiedValue?: string;
  isCurrentMatch?: boolean;
}

const JsonNodeComponent: React.FC<JsonNodeProps> = ({
  node,
  onToggle,
  onSelect,
  isSelected = false,
  isInSelection = false,
  onCopy,
  searchQuery,
  caseSensitive = false,
  copiedValue,
  isCurrentMatch = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const hasChildren = node.type === "object" || node.type === "array";
  const canExpand = hasChildren && node.childCount && node.childCount > 0;

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
    onCopy?.(value, "value");
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy?.(node.path, "path");
  };

  const getValueAsString = (value: unknown): string => {
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const highlightText = (text: string): React.ReactNode => {
    if (!searchQuery || !searchQuery.trim()) return text;

    const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const index = searchText.indexOf(query);

    if (index === -1) return text;

    const highlightClass = isCurrentMatch
      ? "rounded-sm bg-mark-current px-1 text-mark-current-ink"
      : "rounded-sm bg-mark px-1 text-mark-ink";

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
      case "object":
        return <Braces size={14} />;
      case "array":
        return <Brackets size={14} />;
      case "string":
        return <Type size={14} />;
      case "number":
        return <Hash size={14} />;
      case "boolean":
        return <ToggleLeft size={14} />;
      case "null":
        return <Circle size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "object":
        return "text-json-object";
      case "array":
        return "text-json-array";
      case "string":
        return "text-json-string";
      case "number":
        return "text-json-number";
      case "boolean":
        return "text-json-boolean";
      case "null":
        return "text-json-null italic";
      default:
        return "text-dim";
    }
  };

  const getPropertyDetails = () => {
    const details = [];

    // Basic info
    details.push({label: "Type", value: node.type});
    details.push({label: "Path", value: node.path});
    details.push({label: "Depth", value: node.depth.toString()});

    // Type-specific details
    if (node.type === "string") {
      details.push({
        label: "Length",
        value: String(node.value).length.toString(),
      });
      details.push({label: "Value", value: String(node.value)});
    } else if (node.type === "number") {
      details.push({label: "Value", value: String(node.value)});
    } else if (node.type === "boolean") {
      details.push({label: "Value", value: String(node.value)});
    } else if (node.type === "array") {
      details.push({
        label: "Length",
        value: node.childCount?.toString() || "0",
      });
    } else if (node.type === "object") {
      details.push({
        label: "Properties",
        value: node.childCount?.toString() || "0",
      });
    }

    if (node.key) {
      details.push({label: "Key", value: node.key});
    }

    return details;
  };

  const copyPropertyDetail = (_label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      onCopy?.(value, "value");
    });
  };

  const renderValue = (): React.ReactNode => {
    const {value, type} = node;

    switch (type) {
      case "string":
        return (
          <span className={`font-mono ${getTypeColor(type)}`}>
            "{highlightText(String(value))}"
          </span>
        );
      case "number":
        return (
          <span className={`font-mono ${getTypeColor(type)}`}>
            {highlightText(String(value))}
          </span>
        );
      case "boolean":
        return (
          <span className={`font-mono ${getTypeColor(type)}`}>
            {highlightText(String(value))}
          </span>
        );
      case "null":
        return <span className={`font-mono ${getTypeColor(type)}`}>null</span>;
      case "array":
        return (
          <span className={`${getTypeColor(type)} flex items-center gap-1`}>
            {getTypeIcon(type)}
          </span>
        );
      case "object":
        return (
          <span className={`${getTypeColor(type)} flex items-center gap-1`}>
            {getTypeIcon(type)}
          </span>
        );
      default:
        return (
          <span className="font-mono">{highlightText(String(value))}</span>
        );
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
      className={`json-node flex items-start py-1 px-2 group transition-all duration-150 ${
        isSelected
          ? "border-l-2 border-spot bg-sel"
          : isInSelection
            ? "border-l-2 border-spot-line bg-sel-soft"
            : "border-l-2 border-transparent hover:border-line-2"
      } ${
        isCurrentMatch ? "ring-1 ring-spot" : ""
      } cursor-pointer hover:bg-hover`}
      style={{marginLeft: `${node.depth * 20}px`}}
      onClick={handleRowClick}
    >
      {/* Expand/Collapse Button */}
      <div className="w-4 h-4 flex items-center justify-center mr-1">
        {canExpand ? (
          <button
            onClick={handleToggleClick}
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm text-xs font-bold transition-colors ${
              node.isExpanded
                ? "bg-spot text-spot-ink"
                : "border border-line-2 text-dim hover:border-spot hover:text-spot"
            }`}
            aria-label={node.isExpanded ? "Collapse" : "Expand"}
          >
            {node.isExpanded ? <Minus size={8} /> : <Plus size={8} />}
          </button>
        ) : (
          <div className="w-3" />
        )}
      </div>

      {/* Type Icon for primitive values */}
      {!hasChildren && (
        <span
          className={`mr-1 ${getTypeColor(node.type)}`}
          data-tooltip={`Type: ${node.type}`}
        >
          {getTypeIcon(node.type)}
        </span>
      )}

      {/* Key */}
      {node.key && (
        <span className="mr-1 font-mono font-medium text-json-key">
          {highlightText(node.key)}
          <span className="ml-1 text-json-punct">:</span>
        </span>
      )}

      {/* Value — wraps to show the full content */}
      <span className="flex-1 min-w-0 break-words">{renderValue()}</span>

      {/* Copy Buttons */}
      <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 ml-1 flex items-center gap-0.5">
        {/* Copy Value Button */}
        <button
          onClick={handleCopyValue}
          className="btn btn--quiet btn--icon !h-6 !w-6"
          data-tooltip="Copy value"
        >
          {isValueCopied ? (
            <Check size={12} className="text-success" />
          ) : (
            <Copy size={12} />
          )}
        </button>

        {/* Copy Path Button */}
        <button
          onClick={handleCopyPath}
          className="btn btn--quiet btn--icon !h-6 !w-6"
          data-tooltip="Copy path"
        >
          {isPathCopied ? (
            <Check size={12} className="text-success" />
          ) : (
            <Package size={12} />
          )}
        </button>

        {/* Property Details Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="btn btn--quiet btn--icon !h-6 !w-6"
            data-tooltip="Property details"
          >
            <Info size={12} />
          </button>

          {/* Property Details Popup */}
          {showDetails && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-64 border border-line-2 bg-panel p-3 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="eyebrow mb-2">Property Details</div>
              <div className="space-y-2">
                {getPropertyDetails().map((detail, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between group/detail"
                  >
                    <span className="text-xs font-medium text-dim">
                      {detail.label}:
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className="max-w-32 truncate font-mono text-xs text-ink"
                        data-tooltip={detail.value}
                      >
                        {detail.value}
                      </span>
                      <button
                        onClick={() =>
                          copyPropertyDetail(detail.label, detail.value)
                        }
                        className="btn btn--quiet btn--icon !h-5 !w-5 opacity-0 group-hover/detail:opacity-100"
                        data-tooltip={`Copy ${detail.label.toLowerCase()}`}
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="btn btn--quiet btn--block mt-3 !py-1 !text-xs"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoized: the tree renders one of these per visible node, so without this a
// single state change (a copy, a selection) re-renders every row.
export const JsonNode = React.memo(JsonNodeComponent);
