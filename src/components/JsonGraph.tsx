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
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {ChevronDown, ChevronRight, Copy} from "lucide-react";
import {JsonValue} from "../types/json";
import {jsonToGraph, type GraphNode} from "../utils/jsonToGraph";

interface GraphActions {
  onToggle: (path: string) => void;
  onCopyPath: (path: string) => void;
  selectedPath: string;
}
const ActionsContext = createContext<GraphActions>({
  onToggle: () => {},
  onCopyPath: () => {},
  selectedPath: "",
});

// Tailwind drives light/dark via the html.dark class, so nodes restyle for free.
function JsonFlowNode({data}: NodeProps<GraphNode>) {
  const {onToggle, onCopyPath, selectedPath} = useContext(ActionsContext);
  const isSelected = selectedPath === data.path;
  const badge =
    data.kind === "array" ? "[ ]" : data.kind === "object" ? "{ }" : "•";

  return (
    <div
      className={`rounded-md border shadow-sm text-xs bg-white dark:bg-gray-800 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-400/50"
          : "border-gray-300 dark:border-gray-600"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
          <span className="mr-1 text-blue-500 dark:text-blue-400">{badge}</span>
          {data.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath(data.path);
          }}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
          data-tooltip="Copy JSON path"
        >
          <Copy size={12} />
        </button>
      </div>

      {data.fields.length > 0 && (
        <div className="px-2 py-1 space-y-0.5">
          {data.fields.map((f, i) => (
            <div key={i} className="truncate text-gray-700 dark:text-gray-300">
              {f.k && (
                <span className="text-purple-600 dark:text-purple-400">
                  {f.k}:{" "}
                </span>
              )}
              <span className="text-emerald-700 dark:text-emerald-400">
                {f.v}
              </span>
            </div>
          ))}
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
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400"
      />
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

interface JsonGraphProps {
  data: JsonValue;
  selectedNodePath: string;
  onSelectNode: (path: string) => void;
}

function GraphInner({data, selectedNodePath, onSelectNode}: JsonGraphProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const {setCenter, fitView} = useReactFlow();
  const isDark = useIsDark();

  const {nodes, edges} = useMemo(
    () => jsonToGraph(data, collapsed),
    [data, collapsed]
  );

  // New document → reset collapse state.
  useEffect(() => {
    setCollapsed(new Set());
  }, [data]);

  // Fit the whole shape once nodes are laid out. The `fitView` prop fires
  // before custom nodes are measured, so its bounding box is wrong; re-fit on
  // the next frame when DOM sizes are known (PRD flow: open graph → see shape).
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({duration: 0}));
    return () => cancelAnimationFrame(id);
  }, [data, fitView]);

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

  // Center the canvas on the selected/search-matched node. Skip the initial
  // "root" selection so the mount-time fitView shows the whole shape (PRD §4).
  const skipInitialCenter = useRef(true);
  useEffect(() => {
    if (skipInitialCenter.current) {
      skipInitialCenter.current = false;
      return;
    }
    if (!selectedNodePath) return;
    // Scalars are inline fields, not nodes — fall back to the nearest ancestor
    // container node so search matches on leaf values still center somewhere.
    const match =
      nodes.find((n) => n.data.path === selectedNodePath) ??
      nodes
        .filter((n) => selectedNodePath.startsWith(n.data.path))
        .sort((a, b) => b.data.path.length - a.data.path.length)[0];
    if (match) {
      const w = match.width ?? 160;
      const h = match.height ?? 40;
      setCenter(match.position.x + w / 2, match.position.y + h / 2, {
        zoom: 1,
        duration: 400,
      });
    }
  }, [selectedNodePath, nodes, setCenter]);

  const actions = useMemo<GraphActions>(
    () => ({onToggle, onCopyPath, selectedPath: selectedNodePath}),
    [onToggle, onCopyPath, selectedNodePath]
  );

  return (
    <ActionsContext.Provider value={actions}>
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
      >
        <Background />
        <Controls
          onFitView={() => fitView({duration: 400})}
          showInteractive={false}
        />
        <MiniMap pannable zoomable className="!bg-gray-100 dark:!bg-gray-700" />
      </ReactFlow>
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
