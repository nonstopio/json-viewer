import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  Braces,
  Brackets,
  Check,
  ChevronRight,
  Compass,
  Copy,
} from "lucide-react";
import {JsonNode, JsonValue} from "../types/json";
import {appendPath, pathSegments} from "../utils/jsonParser";

interface JsonNavigatorProps {
  data: JsonValue | null;
  selectedNodePath: string;
  /** Select this node: open it in the tree and fold everything beside it. */
  onSelectNode: (path: string) => void;
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

const countOf = (value: JsonValue): number =>
  Array.isArray(value)
    ? value.length
    : Object.keys(value as Record<string, JsonValue>).length;

const summary = (value: JsonValue): string =>
  Array.isArray(value) ? `${value.length} items` : `${countOf(value)} keys`;

// ponytail: plain cap instead of virtualizing these two levels — a level with
// more than this many children is rare, and search covers finding one.
const MAX_ROWS = 200;

interface NavRow {
  key: string;
  path: string;
  value: JsonValue;
}

const childRows = (value: JsonValue, basePath: string): NavRow[] => {
  if (Array.isArray(value))
    return value.slice(0, MAX_ROWS).map((child, index) => ({
      key: `[${index}]`,
      path: appendPath(basePath, `[${index}]`),
      value: child,
    }));
  const object = value as Record<string, JsonValue>;
  return Object.keys(object)
    .slice(0, MAX_ROWS)
    .map((key) => ({key, path: appendPath(basePath, key), value: object[key]}));
};

interface RowProps {
  row: NavRow;
  checked: boolean;
  onSelect: (path: string) => void;
  rowRef?: React.Ref<HTMLLabelElement>;
}

const Row: React.FC<RowProps> = ({row, checked, onSelect, rowRef}) => {
  const type = typeOf(row.value);
  const container = isContainer(row.value);

  return (
    <label
      ref={rowRef}
      data-testid="nav-row"
      data-path={row.path}
      className={`flex cursor-pointer items-center gap-2 border-b border-line px-2 py-1.5 ${
        checked ? "bg-sel" : "hover:bg-hover"
      }`}
    >
      {/* A radio rather than a checkbox input: exactly one node is open at a
          time, and the native group brings single-selection plus arrow-key
          roving with it. It reads as a box with a tick either way. */}
      <input
        type="radio"
        name="navigator-node"
        className="peer sr-only"
        checked={checked}
        onChange={() => onSelect(row.path)}
      />
      <span
        aria-hidden
        className={`grid h-4 w-4 flex-shrink-0 place-items-center border peer-focus-visible:shadow-ring ${
          checked ? "border-spot bg-spot text-spot-ink" : "border-line-2"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span className={`flex-shrink-0 ${TYPE_COLOR[type]}`}>
        {type === "object" ? (
          <Braces size={14} />
        ) : type === "array" ? (
          <Brackets size={14} />
        ) : (
          <span className="block w-[14px] text-center font-mono text-[10px]">
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
        {container ? summary(row.value) : preview(row.value)}
      </span>
      {container && (
        <ChevronRight
          size={14}
          className={`ml-auto flex-shrink-0 ${
            checked ? "rotate-90 text-spot" : "text-faint-2"
          }`}
        />
      )}
    </label>
  );
};

export const JsonNavigator: React.FC<JsonNavigatorProps> = ({
  data,
  selectedNodePath,
  onSelectNode,
}) => {
  const [copied, setCopied] = useState(false);
  const crumbRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLLabelElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Failed to copy path:", error);
    }
  }, []);

  // Two levels, never more: the selected node's own level (its siblings, so it
  // is clear where you are) and the selected node's children (so you can step
  // in). Picking a child re-roots the graph on it, which is what holds the
  // depth at two while the walk goes arbitrarily deep.
  const {segments, rows, children, selectedPath, total} = useMemo(() => {
    const empty = {
      segments: [] as PathSegment[],
      rows: [] as NavRow[],
      children: [] as NavRow[],
      selectedPath: "",
      total: 0,
    };
    if (data === null) return empty;

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

    const selected = values[values.length - 1];
    const atRoot = values.length === 1;
    // Root has no siblings, so it lists its own children as the level.
    const levelIndex = atRoot ? 0 : values.length - 2;
    const level = values[levelIndex];
    if (!isContainer(level)) return empty;

    return {
      segments: chain,
      rows: childRows(level, chain[levelIndex].path),
      children:
        !atRoot && isContainer(selected)
          ? childRows(selected, chain[chain.length - 1].path)
          : [],
      selectedPath: atRoot ? "" : chain[chain.length - 1].path,
      total: countOf(level),
    };
  }, [data, selectedNodePath]);

  const currentPath = segments[segments.length - 1]?.path ?? "root";

  // Deep paths overflow the crumb bar; the level you are in matters most, so
  // keep the tail in view.
  useEffect(() => {
    const el = crumbRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [currentPath]);

  // Put the selection in the middle of the panel, so its children come on
  // screen with it instead of hanging below the bottom edge. Scrolling the
  // panel by hand rather than with scrollIntoView, which walks up and scrolls
  // every scrollable ancestor — including the window, which drags the whole
  // app off screen on a long level.
  useEffect(() => {
    const pane = graphRef.current;
    const row = selectedRef.current;
    if (!pane || !row) return;
    const offset =
      row.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    pane.scrollTo({
      top: pane.scrollTop + offset - (pane.clientHeight - row.offsetHeight) / 2,
      behavior: "smooth",
    });
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
                onClick={() => onSelectNode(segment.path)}
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

      <div
        ref={graphRef}
        data-testid="nav-graph"
        role="radiogroup"
        aria-label="JSON structure"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {rows.map((row) => {
          const checked = row.path === selectedPath;
          return (
            <div key={row.path}>
              <Row
                row={row}
                checked={checked}
                onSelect={onSelectNode}
                rowRef={checked ? selectedRef : undefined}
              />
              {checked && children.length > 0 && (
                <div
                  data-testid="nav-children"
                  className="ml-4 border-l-2 border-spot-line pl-1"
                >
                  {children.map((child) => (
                    <Row
                      key={child.path}
                      row={child}
                      checked={false}
                      onSelect={onSelectNode}
                    />
                  ))}
                  {countOf(row.value) > MAX_ROWS && (
                    <p className="px-2 py-2 text-xs text-faint">
                      Showing first {MAX_ROWS} of {countOf(row.value)} — use
                      search to reach the rest.
                    </p>
                  )}
                </div>
              )}
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
