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
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {toPng} from "html-to-image";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  Focus,
  Maximize,
  Maximize2,
  Minimize,
  Minus,
  Plus,
  Image as ImageIcon,
  Search,
  Repeat,
  FoldVertical,
  UnfoldVertical,
  SlidersHorizontal,
  AlertTriangle,
  X,
} from "lucide-react";
import {JsonValue} from "../types/json";
import {JsonNavigator} from "./JsonNavigator";
import {ancestorPaths, isUnder} from "../utils/jsonParser";
import {brand} from "../brand";
import {readRole} from "../styles/roles";
import {useGround} from "../hooks/useTheme";
import {
  jsonToGraph,
  allContainerPaths,
  countContainers,
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
        className={`rounded-sm px-0.5 ${
          active
            ? "bg-mark-current text-mark-current-ink"
            : "bg-mark text-mark-ink"
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

// Every colour below is a role token, so nodes repaint with the ground for free.
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
      className={`rounded-md border bg-panel text-xs shadow-sm ${
        isHighlight ? "border-spot ring-2 ring-spot" : "border-line-2"
      }`}
    >
      <Handle
        type="target"
        position={targetPos}
        /* React Flow draws its handles as circles; the chrome here is square. */
        className="!rounded-none !bg-faint-2"
      />
      <div className="flex items-center justify-between gap-2 border-b border-line-2 px-2 py-1.5">
        <span className="truncate font-mono font-semibold text-ink">
          <span className="mr-1 text-spot">{badge}</span>
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
          className="btn btn--quiet !h-6 !w-6 !p-0 shrink-0"
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
                className={`truncate font-mono text-dim ${
                  activeField ? "rounded-sm bg-spot-soft" : ""
                }`}
              >
                {f.k && (
                  <span className="text-json-key">
                    <Highlighted
                      text={f.k}
                      query={query}
                      active={activeField}
                    />
                    {": "}
                  </span>
                )}
                <span className="text-json-string">
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
          className="btn btn--quiet btn--block border-t border-t-line-2 !px-2 !py-1"
        >
          {data.collapsed ? (
            <ChevronRight size={12} />
          ) : (
            <ChevronDown size={12} />
          )}
          <span>{data.childCount}</span>
        </button>
      )}
      <Handle
        type="source"
        position={sourcePos}
        /* React Flow draws its handles as circles; the chrome here is square. */
        className="!rounded-none !bg-faint-2"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {json: JsonFlowNode};

// The floating Navigator's own width (w-72), and the room the bottom toolbar
// needs. The camera frames around both.
const NAV_W = 288;
const GUTTER = 24;
const TOOLBAR_H = 72;

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
      className={`btn btn--icon ${active ? "btn--on" : "btn--quiet"}`}
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
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {setCenter, fitView, zoomIn, zoomOut, getZoom} = useReactFlow();
  const isDark = useGround() === "ink";

  const {nodes, edges, truncated} = useMemo(
    () => jsonToGraph(data, collapsed, direction),
    [data, collapsed, direction]
  );
  // Total node count is only needed for the "showing N of M" warning.
  const totalNodes = useMemo(
    () => (truncated ? countContainers(data) : nodes.length),
    [truncated, data, nodes.length]
  );

  // New document → reset view state (including the dismissed notice, so a
  // freshly loaded large document warns again).
  useEffect(() => {
    setCollapsed(new Set());
    setNoticeDismissed(false);
    setQuery("");
    setSearchOpen(false);
    setNavOpen(true);
  }, [data]);

  // Camera handoff: a structural change records the node to frame once the new
  // layout lands, and the effect below does the framing. "*" means
  // collapse/expand-all — no single node of interest, so fit the whole graph.
  const pendingFocus = useRef<string | null>(null);

  const onToggle = useCallback(
    (path: string) => {
      // Expanding, the subtree that just appeared is what the user asked to
      // see. Collapsing, that subtree is gone — frame the parent instead, so
      // the camera lands on a whole object rather than holding the zoom the
      // vanished subtree needed.
      pendingFocus.current = collapsed.has(path)
        ? path
        : (ancestorPaths(path).pop() ?? path);
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [collapsed]
  );

  const onCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
  }, []);

  // Every camera move keeps the graph clear of the chrome floating over it:
  // the Navigator window on the left edge, the toolbar along the bottom.
  // React Flow reads these as a minimum clearance, so a graph with room to
  // spare still centres — it just never ends up underneath them. Capped at a
  // share of the pane, so a narrow one is never padded down to nothing.
  const framing = useCallback(() => {
    const paneWidth = wrapperRef.current?.clientWidth ?? 0;
    const left = navOpen
      ? Math.round(Math.min(NAV_W + GUTTER, paneWidth * 0.4))
      : GUTTER;
    return {
      padding: {
        left: `${left}px`,
        right: `${GUTTER}px`,
        top: `${GUTTER}px`,
        bottom: `${TOOLBAR_H}px`,
      },
    } as const;
  }, [navOpen]);

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
        ...framing(),
      });
    },
    [fitView, framing]
  );

  // Frame a node together with everything still open under it, so the whole
  // object is on screen at a zoom that suits its current size. This is the
  // camera for every structural change; a fit of the whole graph is just the
  // root's subtree.
  const fitSubtree = useCallback(
    (path: string) => {
      const inside = nodes
        .filter((n) => isUnder(n.data.path, path))
        .map((n) => ({id: n.id}));
      // A node can vanish under a cap or a collapsed ancestor — fall back to
      // the whole graph rather than leaving the camera stranded.
      fitView(
        inside.length
          ? {nodes: inside, duration: 400, maxZoom: 1.2, ...framing()}
          : {duration: 400, ...framing()}
      );
    },
    [nodes, fitView, framing]
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

  // The Navigator's one action, mirroring the tree: everything folds, then the
  // picked branch's own chain and whole subtree reopen — so the graph shows
  // exactly what the panel says is open.
  const openBranch = useCallback(
    (path: string) => {
      pendingFocus.current = path;
      onSelectNode(path);
      setCollapsed(
        new Set(
          allContainerPaths(data).filter((p) =>
            // Nothing ticked is not a closed document: the top level stays
            // open, so the graph still shows what the panel is listing.
            path === "root"
              ? p !== "root"
              : !isUnder(p, path) && !isUnder(path, p)
          )
        )
      );
    },
    [data, onSelectNode]
  );

  const centerFirst = useCallback(
    () => panToNode(nodes.find((n) => n.data.path === "root")),
    [nodes, panToNode]
  );
  const fit = useCallback(
    () => fitView({duration: 400, ...framing()}),
    [fitView, framing]
  );
  const rotate = useCallback(
    () => setDirection((d) => (d === "LR" ? "TB" : "LR")),
    []
  );
  const allCollapsed = collapsed.size > 0;
  const toggleCollapseAll = useCallback(() => {
    pendingFocus.current = "*";
    setCollapsed((prev) =>
      prev.size > 0 ? new Set() : new Set(allContainerPaths(data))
    );
  }, [data]);

  const exportImage = useCallback(() => {
    if (!nodes.length) return;
    const viewport = document.querySelector<HTMLElement>(
      ".react-flow__viewport"
    );
    if (!viewport) return;

    // Frame the graph tightly at native scale (1) so nothing is shrunk, then
    // supersample via pixelRatio for crisp text — capped so huge graphs don't
    // blow past canvas limits.
    const bounds = getNodesBounds(nodes);
    const margin = 40;
    const width = Math.ceil(bounds.width + margin * 2);
    const height = Math.ceil(bounds.height + margin * 2);
    const MAX_SIDE = 8000;
    const pixelRatio = Math.min(2, MAX_SIDE / Math.max(width, height));

    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const filename = `${brand.exportPrefix}-${pad(d.getDate())}-${pad(
      d.getMonth() + 1
    )}-${d.getFullYear()}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(
      d.getSeconds()
    )}.png`;

    toPng(viewport, {
      backgroundColor: readRole("graph-bg"),
      width,
      height,
      pixelRatio,
      // Don't try to inline the cross-origin Google Fonts stylesheet — it's
      // unreadable (SecurityError) and unneeded; fall back to system fonts.
      skipFonts: true,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${margin - bounds.x}px, ${margin - bounds.y}px) scale(1)`,
        transformOrigin: "top left",
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");
      a.download = filename;
      a.href = dataUrl;
      a.click();
    });
  }, [nodes]);

  // Re-fit whenever the laid-out graph changes (data / direction / collapse).
  // The `fitView` prop fires before custom nodes are measured, so re-fit on the
  // next frame when DOM sizes are known.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      fitView({duration: 0, ...framing()})
    );
    return () => cancelAnimationFrame(id);
  }, [data, direction, isFullscreen, navOpen, fitView, framing]);

  // Frame whatever the last structural change was about, once the new layout
  // has landed. Only runs when a toggle or the Navigator armed `pendingFocus`,
  // so it never competes with the data/direction re-fit above or the search
  // focus — and search wins while it is open.
  useEffect(() => {
    if (!pendingFocus.current) return;
    const id = requestAnimationFrame(() => {
      const target = pendingFocus.current;
      pendingFocus.current = null;
      if (!target || query.trim()) return;
      if (target === "*") fitView({duration: 400, ...framing()});
      else fitSubtree(target);
    });
    return () => cancelAnimationFrame(id);
  }, [nodes, query, fitView, fitSubtree, framing]);

  // Fullscreen the graph wrapper itself, so toolbar, minimap and search come
  // along. Listening to the event (not just our own clicks) keeps Esc honest.
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current
        ?.requestFullscreen()
        .catch((err) => console.warn("Fullscreen request failed:", err));
    }
  }, []);

  // Center on an externally selected node (e.g. clicked in another view).
  const skipInitialCenter = useRef(true);
  useEffect(() => {
    if (skipInitialCenter.current) {
      skipInitialCenter.current = false;
      return;
    }
    if (!selectedNodePath) return;
    // The Navigator sets the selection and arms a subtree frame in the same
    // breath; that frame is the better one, so leave the camera to it.
    if (pendingFocus.current) return;
    const match =
      nodes.find((n) => n.data.path === selectedNodePath) ??
      nodes
        .filter((n) => selectedNodePath.startsWith(n.data.path))
        .sort((a, b) => b.data.path.length - a.data.path.length)[0];
    focusNode(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodePath]);

  // Keyboard shortcuts (Shift+1 center, Shift+2 fit, Cmd/Ctrl+S export,
  // F fullscreen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The graph's own search input lives in this subtree — never hijack keys
      // while the user is typing anywhere on the page.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        exportImage();
      } else if (e.shiftKey && e.key === "!") {
        centerFirst();
      } else if (e.shiftKey && e.key === "@") {
        fit();
      } else if (
        e.key.toLowerCase() === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportImage, centerFirst, fit, toggleFullscreen]);

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
      <div ref={wrapperRef} className="relative h-full w-full json-graph-root">
        {/* Fullscreen elements default to a black backdrop — restore the page
            background for both themes. */}
        <style>{`
          .json-graph-root:fullscreen { background-color: var(--graph-bg); }
        `}</style>
        {truncated && !noticeDismissed && (
          <div className="absolute right-3 top-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-md border border-line-2 border-l-2 border-l-warning bg-panel p-3 text-xs text-ink shadow-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  Large documents aren’t supported yet
                </p>
                <p className="mt-1 leading-relaxed">
                  The Visualizer is showing the first{" "}
                  {nodes.length.toLocaleString()} of{" "}
                  {totalNodes.toLocaleString()} nodes to stay responsive. Need
                  larger documents rendered in full?{" "}
                  <a
                    href={`${brand.issuesUrl}/new?title=Support%20large%20documents%20in%20the%20Visualizer&labels=enhancement`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2 hover:no-underline"
                  >
                    Report the issue
                  </a>{" "}
                  and we’ll build it based on demand.
                </p>
              </div>
              <button
                onClick={() => setNoticeDismissed(true)}
                aria-label="Dismiss"
                data-tooltip="Dismiss"
                className="btn btn--quiet btn--icon !h-6 !w-6 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
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
          // give edges an explicit stroke. SVG resolves the var() itself, so
          // this follows the ground without a re-render.
          defaultEdgeOptions={{
            style: {stroke: "var(--graph-edge)", strokeWidth: 1.5},
          }}
          // Scroll pans (what users expect from "moving" the canvas); pinch or
          // Ctrl+scroll zooms, alongside the toolbar buttons.
          panOnScroll
          zoomOnScroll={false}
          selectionOnDrag={false}
          panOnDrag
        >
          <Background />
          {showMinimap && <MiniMap pannable zoomable className="!bg-mass" />}
        </ReactFlow>

        {/* The Viewer's Navigator, floated over the canvas. The graph wants
            its whole width some of the time, so this one is a window: fold it
            away to the opener beside it and bring it back. */}
        {navOpen ? (
          <div className="absolute left-3 top-3 z-20 flex h-[min(26rem,calc(100%-6rem))] w-72 flex-col border border-line-2 bg-panel shadow-lg">
            <JsonNavigator
              data={data}
              selectedNodePath={selectedNodePath}
              onSelectNode={openBranch}
              onMinimize={() => setNavOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open the Navigator"
            className="btn btn--quiet absolute left-3 top-3 z-20 border border-line-2 bg-panel shadow-lg"
          >
            <Compass size={16} />
            <span className="text-xs">Navigator</span>
          </button>
        )}

        {/* Floating search box (JSON Crack style) */}
        {searchOpen && (
          <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 border border-line-2 bg-panel px-3 py-1.5 shadow-lg">
            <Search size={14} className="text-faint" />
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
              className="w-40 bg-transparent text-sm text-ink outline-none placeholder:text-faint-2"
            />
            <span className="min-w-[36px] text-center font-mono text-xs text-faint">
              {query
                ? `${matches.length ? matchIndex + 1 : 0}/${matches.length}`
                : ""}
            </span>
            <button
              onClick={() => stepMatch(-1)}
              className="btn btn--quiet btn--icon !h-7 !w-7"
              data-tooltip="Previous (Shift+Enter)"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => stepMatch(1)}
              className="btn btn--quiet btn--icon !h-7 !w-7"
              data-tooltip="Next (Enter)"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => setSearchOpen(false)}
              className="btn btn--quiet btn--icon !h-7 !w-7"
              data-tooltip="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Settings popover */}
        {showSettings && (
          <div className="absolute bottom-16 right-4 z-10 w-44 border border-line-2 bg-panel p-3 text-sm shadow-lg">
            <label className="flex items-center justify-between gap-2 text-ink">
              <span>Show minimap</span>
              <input
                type="checkbox"
                checked={showMinimap}
                onChange={(e) => setShowMinimap(e.target.checked)}
              />
            </label>
            <label className="mt-2 flex items-center justify-between gap-2 text-ink">
              <span>Layout</span>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as LayoutDirection)
                }
                className="border border-line-2 bg-mass px-1 py-0.5 text-ink"
              >
                <option value="LR">Horizontal</option>
                <option value="TB">Vertical</option>
              </select>
            </label>
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 border border-line-2 bg-panel p-1 shadow-lg">
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
          <ToolBtn
            label={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}
            active={isFullscreen}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </ToolBtn>
          <div className="mx-1 h-5 w-px bg-line-2" />
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
