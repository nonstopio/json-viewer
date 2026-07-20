import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {toPng} from "html-to-image";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Focus,
  Maximize2,
  Minus,
  Plus,
  Image as ImageIcon,
  Search,
  Repeat,
  FoldVertical,
  UnfoldVertical,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {JsonValue} from "../types/json";
import {
  jsonToGraph,
  allContainerPaths,
  type GraphNode,
  type LayoutDirection,
} from "../utils/jsonToGraph";

// A search hit is one field (or the title) of one node that matches the query.
type Hit = {id: string; path: string; field: number | "title"};

interface GraphActions {
  onToggle: (path: string) => void;
  onCopyPath: (path: string) => void;
  direction: LayoutDirection;
  query: string;
  activeHit: Hit | null; // the currently-focused search hit
  selectedPath: string; // externally-selected node (when not searching)
}
const ActionsContext = createContext<GraphActions>({
  onToggle: () => {},
  onCopyPath: () => {},
  direction: "LR",
  query: "",
  activeHit: null,
  selectedPath: "",
});

// Wrap every case-insensitive occurrence of `query` in `text` with a <mark>.
// The active hit is emphasized; other occurrences get a lighter highlight.
function Highlighted({
  text,
  query,
  active,
}: {
  text: string;
  query: string;
  active: boolean;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  if (!lower.includes(ql)) return <>{text}</>;

  const out: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(ql);
  let k = 0;
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark
        key={k++}
        className={`rounded px-0.5 ${
          active
            ? "bg-amber-400 text-black"
            : "bg-amber-200/70 text-black dark:bg-amber-500/40 dark:text-amber-50"
        }`}
      >
        {text.slice(idx, idx + ql.length)}
      </mark>
    );
    i = idx + ql.length;
    idx = lower.indexOf(ql, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return <>{out}</>;
}

// Tailwind drives light/dark via the html.dark class, so nodes restyle for free.
function JsonFlowNode({id, data}: NodeProps<GraphNode>) {
  const {onToggle, onCopyPath, direction, query, activeHit, selectedPath} =
    useContext(ActionsContext);
  const isActiveNode = activeHit?.id === id;
  const isHighlight = isActiveNode || (!query && selectedPath === data.path);
  const badge =
    data.kind === "array" ? "[ ]" : data.kind === "object" ? "{ }" : "•";
  const targetPos = direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = direction === "LR" ? Position.Right : Position.Bottom;

  return (
    <div
      className={`rounded-md border shadow-sm text-xs bg-white dark:bg-gray-800 ${
        isHighlight
          ? "border-blue-500 ring-2 ring-blue-400/50"
          : "border-gray-300 dark:border-gray-600"
      }`}
    >
      <Handle type="target" position={targetPos} className="!bg-gray-400" />
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
          <span className="mr-1 text-blue-500 dark:text-blue-400">{badge}</span>
          <Highlighted
            text={data.title}
            query={query}
            active={isActiveNode && activeHit?.field === "title"}
          />
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath(data.path);
          }}
          className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          data-tooltip="Copy JSON path"
        >
          <Copy size={12} />
        </button>
      </div>

      {data.fields.length > 0 && (
        <div className="px-2 py-1 space-y-0.5">
          {data.fields.map((f, i) => {
            const activeField = isActiveNode && activeHit?.field === i;
            return (
              <div
                key={i}
                className={`truncate text-gray-700 dark:text-gray-300 ${
                  activeField ? "rounded bg-blue-500/10" : ""
                }`}
              >
                {f.k && (
                  <span className="text-purple-600 dark:text-purple-400">
                    <Highlighted
                      text={f.k}
                      query={query}
                      active={activeField}
                    />
                    {": "}
                  </span>
                )}
                <span className="text-emerald-700 dark:text-emerald-400">
                  <Highlighted text={f.v} query={query} active={activeField} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {data.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(data.path);
          }}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-md"
        >
          {data.collapsed ? (
            <ChevronRight size={12} />
          ) : (
            <ChevronDown size={12} />
          )}
          <span>{data.childCount}</span>
        </button>
      )}
      <Handle type="source" position={sourcePos} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = {json: JsonFlowNode};

// Follow the actual applied theme (html.dark), which useTheme toggles from any
// source (manual or system). A second useTheme instance wouldn't share state.
function useIsDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// Shared style for every toolbar button.
function ToolBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-tooltip={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
        active
          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

interface JsonGraphProps {
  data: JsonValue;
  selectedNodePath: string;
  onSelectNode: (path: string) => void;
}

function GraphInner({data, selectedNodePath, onSelectNode}: JsonGraphProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [showMinimap, setShowMinimap] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const {setCenter, fitView, zoomIn, zoomOut, getZoom} = useReactFlow();
  const isDark = useIsDark();

  const {nodes, edges} = useMemo(
    () => jsonToGraph(data, collapsed, direction),
    [data, collapsed, direction]
  );

  // New document → reset view state.
  useEffect(() => {
    setCollapsed(new Set());
    setQuery("");
    setSearchOpen(false);
  }, [data]);

  const onToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const onCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
  }, []);

  // Zoom-to-fit a single node so it's clearly visible and centered (used for
  // search matches and external selection).
  const focusNode = useCallback(
    (node?: GraphNode) => {
      if (!node) return;
      fitView({
        nodes: [{id: node.id}],
        duration: 500,
        maxZoom: 1.4,
        minZoom: 0.5,
      });
    },
    [fitView]
  );

  // Center a node at a readable zoom (used by "center first item"). Never
  // below 1, so the root is legible even when the graph was fit far out.
  const panToNode = useCallback(
    (node?: GraphNode) => {
      if (!node) return;
      const w = node.width ?? 160;
      const h = node.height ?? 40;
      setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: Math.max(getZoom(), 1),
        duration: 400,
      });
    },
    [setCenter, getZoom]
  );

  // Search over visible nodes, one hit per matching field (or title) — so two
  // fields matching in the same node count as two matches, not one.
  // ponytail: matches inside collapsed subtrees aren't found; expand-all first.
  const matches = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: Hit[] = [];
    for (const n of nodes) {
      if (n.data.title.toLowerCase().includes(q))
        hits.push({id: n.id, path: n.data.path, field: "title"});
      n.data.fields.forEach((f, i) => {
        if (f.k.toLowerCase().includes(q) || f.v.toLowerCase().includes(q))
          hits.push({id: n.id, path: n.data.path, field: i});
      });
    }
    return hits;
  }, [nodes, query]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query]);

  useEffect(() => {
    const hit = matches[matchIndex];
    if (hit) focusNode(nodes.find((n) => n.id === hit.id));
  }, [matches, matchIndex, nodes, focusNode]);

  const stepMatch = useCallback(
    (dir: 1 | -1) => {
      if (!matches.length) return;
      setMatchIndex((i) => (i + dir + matches.length) % matches.length);
    },
    [matches.length]
  );

  const centerFirst = useCallback(
    () => panToNode(nodes.find((n) => n.data.path === "root")),
    [nodes, panToNode]
  );
  const fit = useCallback(() => fitView({duration: 400}), [fitView]);
  const rotate = useCallback(
    () => setDirection((d) => (d === "LR" ? "TB" : "LR")),
    []
  );
  const allCollapsed = collapsed.size > 0;
  const toggleCollapseAll = useCallback(() => {
    setCollapsed((prev) =>
      prev.size > 0 ? new Set() : new Set(allContainerPaths(data))
    );
  }, [data]);

  const exportImage = useCallback(() => {
    if (!nodes.length) return;
    const bounds = getNodesBounds(nodes);
    const pad = 40;
    const width = Math.min(bounds.width + pad * 2, 4096);
    const height = Math.min(bounds.height + pad * 2, 4096);
    const vp = getViewportForBounds(bounds, width, height, 0.2, 2, pad);
    const viewport = document.querySelector<HTMLElement>(
      ".react-flow__viewport"
    );
    if (!viewport) return;
    toPng(viewport, {
      backgroundColor: isDark ? "#111827" : "#ffffff",
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");
      a.download = "json-graph.png";
      a.href = dataUrl;
      a.click();
    });
  }, [nodes, isDark]);

  // Re-fit whenever the laid-out graph changes (data / direction / collapse).
  // The `fitView` prop fires before custom nodes are measured, so re-fit on the
  // next frame when DOM sizes are known.
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({duration: 0}));
    return () => cancelAnimationFrame(id);
  }, [data, direction, fitView]);

  // Center on an externally selected node (e.g. clicked in another view).
  const skipInitialCenter = useRef(true);
  useEffect(() => {
    if (skipInitialCenter.current) {
      skipInitialCenter.current = false;
      return;
    }
    if (!selectedNodePath) return;
    const match =
      nodes.find((n) => n.data.path === selectedNodePath) ??
      nodes
        .filter((n) => selectedNodePath.startsWith(n.data.path))
        .sort((a, b) => b.data.path.length - a.data.path.length)[0];
    focusNode(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodePath]);

  // Keyboard shortcuts (Shift+1 center, Shift+2 fit, Cmd/Ctrl+S export).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        exportImage();
      } else if (e.shiftKey && e.key === "!") {
        centerFirst();
      } else if (e.shiftKey && e.key === "@") {
        fit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportImage, centerFirst, fit]);

  const activeHit = matches[matchIndex] ?? null;
  const actions = useMemo<GraphActions>(
    () => ({
      onToggle,
      onCopyPath,
      direction,
      query: query.trim(),
      activeHit,
      selectedPath: selectedNodePath,
    }),
    [onToggle, onCopyPath, direction, query, activeHit, selectedNodePath]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={isDark ? "dark" : "light"}
          onNodeClick={(_, node) =>
            onSelectNode((node.data as GraphNode["data"]).path)
          }
          fitView
          minZoom={0.1}
          proOptions={{hideAttribution: true}}
          nodesDraggable={false}
          nodesConnectable={false}
          // The default dark-mode edge color is near-black on our canvas —
          // give edges an explicit, visible stroke in both themes.
          defaultEdgeOptions={{
            style: {stroke: isDark ? "#94a3b8" : "#64748b", strokeWidth: 1.5},
          }}
          // Scroll pans (what users expect from "moving" the canvas); pinch or
          // Ctrl+scroll zooms, alongside the toolbar buttons.
          panOnScroll
          zoomOnScroll={false}
          selectionOnDrag={false}
          panOnDrag
        >
          <Background />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              className="!bg-gray-100 dark:!bg-gray-700"
            />
          )}
        </ReactFlow>

        {/* Floating search box (JSON Crack style) */}
        {searchOpen && (
          <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <Search size={14} className="text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  stepMatch(e.shiftKey ? -1 : 1);
                  e.preventDefault();
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              placeholder="Search nodes…"
              className="w-40 bg-transparent text-sm text-gray-900 outline-none dark:text-gray-100"
            />
            <span className="min-w-[36px] text-center text-xs text-gray-500 dark:text-gray-400">
              {query
                ? `${matches.length ? matchIndex + 1 : 0}/${matches.length}`
                : ""}
            </span>
            <button
              onClick={() => stepMatch(-1)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              data-tooltip="Previous (Shift+Enter)"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => stepMatch(1)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              data-tooltip="Next (Enter)"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => setSearchOpen(false)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              data-tooltip="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Settings popover */}
        {showSettings && (
          <div className="absolute bottom-16 right-4 z-10 w-44 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <label className="flex items-center justify-between gap-2 text-gray-700 dark:text-gray-300">
              <span>Show minimap</span>
              <input
                type="checkbox"
                checked={showMinimap}
                onChange={(e) => setShowMinimap(e.target.checked)}
              />
            </label>
            <label className="mt-2 flex items-center justify-between gap-2 text-gray-700 dark:text-gray-300">
              <span>Layout</span>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as LayoutDirection)
                }
                className="rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="LR">Horizontal</option>
                <option value="TB">Vertical</option>
              </select>
            </label>
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <ToolBtn label="Center first item (⇧1)" onClick={centerFirst}>
            <Focus size={16} />
          </ToolBtn>
          <ToolBtn label="Fit to center (⇧2)" onClick={fit}>
            <Maximize2 size={16} />
          </ToolBtn>
          <ToolBtn label="Zoom out" onClick={() => zoomOut()}>
            <Minus size={16} />
          </ToolBtn>
          <ToolBtn label="Zoom in" onClick={() => zoomIn()}>
            <Plus size={16} />
          </ToolBtn>
          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
          <ToolBtn label="Export as PNG (⌘S)" onClick={exportImage}>
            <ImageIcon size={16} />
          </ToolBtn>
          <ToolBtn
            label="Search"
            active={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search size={16} />
          </ToolBtn>
          <ToolBtn label="Rotate layout" onClick={rotate}>
            <Repeat size={16} />
          </ToolBtn>
          <ToolBtn
            label={allCollapsed ? "Expand all" : "Collapse all"}
            onClick={toggleCollapseAll}
          >
            {allCollapsed ? (
              <UnfoldVertical size={16} />
            ) : (
              <FoldVertical size={16} />
            )}
          </ToolBtn>
          <ToolBtn
            label="Settings"
            active={showSettings}
            onClick={() => setShowSettings((v) => !v)}
          >
            <SlidersHorizontal size={16} />
          </ToolBtn>
        </div>
      </div>
    </ActionsContext.Provider>
  );
}

export function JsonGraph(props: JsonGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
