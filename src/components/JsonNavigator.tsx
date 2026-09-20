import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  Braces,
  Brackets,
  Check,
  ChevronRight,
  Compass,
  Copy,
} from "lucide-react";
import {JsonValue} from "../types/json";
import {ancestorPaths, appendPath, pathSegments} from "../utils/jsonParser";

interface JsonNavigatorProps {
  data: JsonValue | null;
  selectedNodePath: string;
  /** Open this node: unfold it in the tree and fold everything else away. */
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

// Only branches reach the panel, so the type is one of two.
const typeOf = (value: JsonValue): "object" | "array" =>
  Array.isArray(value) ? "array" : "object";

// Same palette as JsonNode.tsx so the two panels read as one language.
const TYPE_COLOR: Record<"object" | "array", string> = {
  object: "text-json-object",
  array: "text-json-array",
};

const countOf = (value: JsonValue): number =>
  Array.isArray(value)
    ? value.length
    : Object.keys(value as Record<string, JsonValue>).length;

const summary = (value: JsonValue): string =>
  Array.isArray(value) ? `${value.length} items` : `${countOf(value)} keys`;

// ponytail: plain cap instead of virtualizing these two levels — a level with
// more than this many branches is rare, and search covers finding one.
const MAX_ROWS = 200;

interface NavRow {
  key: string;
  path: string;
  value: JsonValue;
}

// Only branches are listed. A key holding a plain value is something to read,
// not somewhere to go, and listing it would make this a second copy of the
// tree rather than a map of it. Walked by index rather than built with
// map/filter, so a 100k-element array does not materialise 100k rows to throw
// all but MAX_ROWS of them away.
const branchRows = (
  value: JsonValue,
  basePath: string
): {rows: NavRow[]; total: number} => {
  const keys = Array.isArray(value)
    ? null
    : Object.keys(value as Record<string, JsonValue>);
  const length = keys ? keys.length : (value as JsonValue[]).length;
  const rows: NavRow[] = [];
  let total = 0;

  for (let index = 0; index < length; index++) {
    const key = keys ? keys[index] : `[${index}]`;
    const child = keys
      ? (value as Record<string, JsonValue>)[key]
      : (value as JsonValue[])[index];
    if (!isContainer(child) || countOf(child) === 0) continue;
    total++;
    if (rows.length < MAX_ROWS)
      rows.push({key, path: appendPath(basePath, key), value: child});
  }
  return {rows, total};
};

const NO_ROWS = {rows: [] as NavRow[], total: 0};

interface RowProps {
  row: NavRow;
  checked: boolean;
  open: boolean;
  onToggle: (path: string) => void;
  rowRef?: React.Ref<HTMLLabelElement>;
}

const Row: React.FC<RowProps> = ({row, checked, open, onToggle, rowRef}) => {
  const type = typeOf(row.value);

  return (
    <label
      ref={rowRef}
      data-testid="nav-row"
      data-path={row.path}
      className={`flex cursor-pointer items-center gap-2 border-b border-line px-2 py-1.5 ${
        checked ? "bg-sel" : "hover:bg-hover"
      }`}
    >
      {/* A checkbox, not a radio: clicking the open node again clears it, and
          that is what folds the document back up. Only one is ever ticked —
          the panel, not the input, is what enforces that. */}
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={() => onToggle(row.path)}
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
        {type === "object" ? <Braces size={14} /> : <Brackets size={14} />}
      </span>
      <span className="max-w-[10rem] flex-shrink-0 truncate font-mono text-sm font-medium text-json-key">
        {row.key}
      </span>
      <span className="min-w-0 truncate text-xs text-faint">
        {summary(row.value)}
      </span>
      <ChevronRight
        size={14}
        className={`ml-auto flex-shrink-0 ${
          open ? "rotate-90 text-spot" : "text-faint-2"
        }`}
      />
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

  // Two levels, anchored at the document root: the branches of the root, and
  // the branches of whichever one is open. Ticking a second-level branch
  // selects it — it does not open a third level, because past two levels this
  // panel would be the tree again instead of a way around it.
  const {segments, level, children, openPath} = useMemo(() => {
    const empty = {
      segments: [] as PathSegment[],
      level: NO_ROWS,
      children: NO_ROWS,
      openPath: "",
    };
    if (data === null || !isContainer(data)) return empty;

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

    // The open branch is the one directly under the root that the selection
    // sits in, whether the selection is that branch or one of its children.
    const open = chain[1];
    return {
      segments: chain,
      level: branchRows(data, chain[0].path),
      children:
        open && isContainer(values[1])
          ? branchRows(values[1], open.path)
          : NO_ROWS,
      openPath: open?.path ?? "",
    };
  }, [data, selectedNodePath]);

  // Ticking the row that is already ticked unticks it, which hands the
  // selection back to its parent — and at the top level that is the root,
  // where nothing is open and the whole document folds.
  const toggle = useCallback(
    (path: string) => {
      if (path !== selectedNodePath) return onSelectNode(path);
      const parent = ancestorPaths(path).pop() ?? "root";
      onSelectNode(parent);
    },
    [onSelectNode, selectedNodePath]
  );

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
          {level.total} {level.total === 1 ? "branch" : "branches"}
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
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {level.rows.map((row) => {
          const open = row.path === openPath;
          const checked = open || row.path === selectedNodePath;
          return (
            <div key={row.path}>
              <Row
                row={row}
                checked={checked}
                open={open && children.rows.length > 0}
                onToggle={toggle}
                rowRef={row.path === selectedNodePath ? selectedRef : undefined}
              />
              {open && children.rows.length > 0 && (
                <div
                  data-testid="nav-children"
                  className="ml-4 border-l-2 border-spot-line pl-1"
                >
                  {children.rows.map((child) => (
                    <Row
                      key={child.path}
                      row={child}
                      checked={child.path === selectedNodePath}
                      open={false}
                      onToggle={toggle}
                      rowRef={
                        child.path === selectedNodePath
                          ? selectedRef
                          : undefined
                      }
                    />
                  ))}
                  {children.total > MAX_ROWS && (
                    <p className="px-2 py-2 text-xs text-faint">
                      Showing first {MAX_ROWS} of {children.total} — use search
                      to reach the rest.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {level.total > MAX_ROWS && (
          <p className="px-2 py-2 text-xs text-faint">
            Showing first {MAX_ROWS} of {level.total} — use search to reach the
            rest.
          </p>
        )}
        {level.total === 0 && (
          <p className="px-2 py-3 text-xs text-faint">
            Nothing to navigate — this document has no nested keys.
          </p>
        )}
      </div>

      <div className="border-t border-line-2 px-2 py-1.5 text-[11px] leading-snug text-faint">
        <p>
          Tick a branch to open it: the tree unfolds it in full and folds
          everything else. Tick it again to close, and the document folds with
          it.
        </p>
        <p>
          Only keys that hold more keys are listed, two levels at a time — plain
          values live in the tree.
        </p>
      </div>
    </div>
  );
};
