import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  Braces,
  Brackets,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Focus,
} from "lucide-react";
import {JsonNode, JsonValue} from "../types/json";
import {appendPath, pathSegments} from "../utils/jsonParser";

interface JsonNavigatorProps {
  data: JsonValue | null;
  selectedNodePath: string;
  /** Select the node and scroll it into view in the tree. */
  onFocusNode: (path: string) => void;
  /** Expand only this node and collapse its siblings. */
  onIsolateNode: (path: string) => void;
}

interface PathSegment {
  key: string;
  path: string;
}

// No data-tooltip on this panel's right-edge buttons: the global tooltip chip
// measures itself before it is clamped back from the viewport edge, so it
// renders as a one-character-wide sliver there. aria-label carries the meaning.
const isContainer = (value: JsonValue): boolean =>
  value !== null && typeof value === "object";

const typeOf = (value: JsonValue): JsonNode["type"] => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value as "string" | "number" | "boolean";
};

// Same palette as JsonNode.tsx so the two panels read as one language.
const TYPE_COLOR: Record<JsonNode["type"], string> = {
  object: "text-json-object",
  array: "text-json-array",
  string: "text-json-string",
  number: "text-json-number",
  boolean: "text-json-boolean",
  null: "text-json-null",
};

const preview = (value: JsonValue): string => {
  const text = typeof value === "string" ? `"${value}"` : String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

// ponytail: plain cap instead of virtualizing this list — a level with more
// than this many children is rare, and the tree search covers finding one.
const MAX_ROWS = 200;

interface NavRow {
  key: string;
  path: string;
  value: JsonValue;
}

export const JsonNavigator: React.FC<JsonNavigatorProps> = ({
  data,
  selectedNodePath,
  onFocusNode,
  onIsolateNode,
}) => {
  const [copied, setCopied] = useState(false);
  const crumbRef = useRef<HTMLDivElement>(null);

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Failed to copy path:", error);
    }
  }, []);

  // The level being browsed is the selected node when it is a container, and
  // its parent otherwise — a primitive has no contents to list.
  const {segments, rows, total} = useMemo(() => {
    if (data === null)
      return {segments: [] as PathSegment[], rows: [], total: 0};

    const requested = pathSegments(selectedNodePath || "root");
    const chain: PathSegment[] = [requested[0] ?? {key: "root", path: "root"}];
    const values: JsonValue[] = [data];

    for (const segment of requested.slice(1)) {
      const parent = values[values.length - 1];
      if (!isContainer(parent)) break;
      const next = (parent as Record<string, JsonValue>)[segment.key];
      if (next === undefined) break;
      chain.push(segment);
      values.push(next);
    }
    while (values.length > 1 && !isContainer(values[values.length - 1])) {
      chain.pop();
      values.pop();
    }

    const levelPath = chain[chain.length - 1].path;
    const level = values[values.length - 1];

    if (Array.isArray(level)) {
      return {
        segments: chain,
        rows: level.slice(0, MAX_ROWS).map((value, index) => ({
          key: `[${index}]`,
          path: appendPath(levelPath, `[${index}]`),
          value,
        })),
        total: level.length,
      };
    }
    const object = level as Record<string, JsonValue>;
    const keys = Object.keys(object);
    return {
      segments: chain,
      rows: keys.slice(0, MAX_ROWS).map((key) => ({
        key,
        path: appendPath(levelPath, key),
        value: object[key],
      })) as NavRow[],
      total: keys.length,
    };
  }, [data, selectedNodePath]);

  const currentPath = segments[segments.length - 1]?.path ?? "root";

  // Deep paths overflow the crumb bar; the level you are in matters most, so
  // keep the tail in view.
  useEffect(() => {
    const el = crumbRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [currentPath]);

  if (data === null) {
    return (
      <div
        data-testid="json-navigator"
        className="h-full flex items-center justify-center p-4"
      >
        <div className="text-center text-faint">
          <Compass className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Load JSON to navigate its structure</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="json-navigator" className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line-2 p-2">
        <span className="eyebrow">Navigator</span>
        <span className="font-mono text-xs text-faint">
          {total} {total === 1 ? "child" : "children"}
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line-2 px-2 py-1.5">
        <div
          ref={crumbRef}
          data-testid="nav-breadcrumb"
          className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap scrollbar-thin"
        >
          {segments.map((segment, index) => (
            <React.Fragment key={segment.path}>
              {index > 0 && (
                <ChevronRight
                  size={12}
                  className="flex-shrink-0 text-faint-2"
                />
              )}
              <button
                onClick={() => onFocusNode(segment.path)}
                className="btn btn--quiet max-w-[10rem] flex-shrink-0 truncate !px-1 !py-0.5 !text-xs"
              >
                {segment.key}
              </button>
            </React.Fragment>
          ))}
        </div>
        <button
          onClick={() => copyPath(currentPath)}
          aria-label="Copy path of the current level"
          className="btn btn--quiet btn--icon !h-7 !w-7 flex-shrink-0"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => {
          const type = typeOf(row.value);
          const container = isContainer(row.value);
          const count = Array.isArray(row.value)
            ? `${row.value.length} items`
            : container
              ? `${Object.keys(row.value as Record<string, JsonValue>).length} keys`
              : "";

          return (
            <div
              key={row.path}
              className={`group flex items-center gap-1 border-b border-line px-2 ${
                selectedNodePath === row.path ? "bg-sel" : "hover:bg-hover"
              }`}
            >
              <button
                data-testid="nav-row"
                onClick={() => onFocusNode(row.path)}
                className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left"
              >
                <span className={`flex-shrink-0 ${TYPE_COLOR[type]}`}>
                  {type === "object" ? (
                    <Braces size={14} />
                  ) : type === "array" ? (
                    <Brackets size={14} />
                  ) : (
                    <span className="block w-[14px] text-center text-[10px] font-mono">
                      •
                    </span>
                  )}
                </span>
                <span className="max-w-[10rem] flex-shrink-0 truncate font-mono text-sm font-medium text-json-key">
                  {row.key}
                </span>
                <span
                  className={`min-w-0 truncate text-xs ${
                    container ? "text-faint" : TYPE_COLOR[type]
                  }`}
                >
                  {container ? count : preview(row.value)}
                </span>
                {container && (
                  <ChevronRight
                    size={14}
                    className="ml-auto flex-shrink-0 text-faint-2"
                  />
                )}
              </button>
              <button
                data-testid="nav-isolate"
                onClick={() => onIsolateNode(row.path)}
                aria-label={`Show only "${row.key}"`}
                className="btn btn--quiet btn--icon !h-7 !w-7 flex-shrink-0 opacity-0 focus:opacity-100 group-hover:opacity-100"
              >
                <Focus size={14} />
              </button>
            </div>
          );
        })}
        {total > MAX_ROWS && (
          <p className="px-2 py-2 text-xs text-faint">
            Showing first {MAX_ROWS} of {total} — use search to reach the rest.
          </p>
        )}
        {total === 0 && (
          <p className="px-2 py-3 text-xs text-faint">This node is empty.</p>
        )}
      </div>
    </div>
  );
};
