import dagre from "dagre";
import type {Edge, Node} from "@xyflow/react";
import {JsonValue} from "../types/json";

export interface GraphNodeData {
  title: string; // "root", a key name, or "[index]"
  kind: "object" | "array" | "value";
  fields: {k: string; v: string}[]; // scalar members shown inline
  path: string; // same convention as the tree (root.user.name, root.items[0])
  childCount: number; // number of nested object/array children
  collapsed: boolean;
  hasChildren: boolean;
  [key: string]: unknown; // satisfies React Flow's Record<string, unknown>
}

export type GraphNode = Node<GraphNodeData>;

// Mirror jsonParser.appendPath so copy-path matches the tree view exactly.
function appendPath(parentPath: string, key: string): string {
  if (/^\[\d+\]$/.test(key)) return `${parentPath}${key}`;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return parentPath ? `${parentPath}.${key}` : key;
  }
  return `${parentPath}[${JSON.stringify(key)}]`;
}

function scalarStr(v: JsonValue): string {
  if (typeof v === "string") return `"${v}"`;
  if (v === null) return "null";
  return String(v);
}

function isContainer(
  v: JsonValue
): v is JsonValue[] | Record<string, JsonValue> {
  return v !== null && typeof v === "object";
}

// Rough node sizing so dagre can space things without overlap. Height grows
// with the number of inline scalar rows; width tracks the longest label.
const HEADER_H = 34;
const ROW_H = 22;
const CHAR_W = 7.5;
const MIN_W = 140;
const MAX_W = 320;

function estimateSize(data: GraphNodeData): {width: number; height: number} {
  const rows = data.fields.length + (data.childCount > 0 ? 1 : 0);
  const longest = Math.max(
    data.title.length,
    ...data.fields.map((f) => (f.k ? `${f.k}: ${f.v}` : f.v).length),
    0
  );
  const width = Math.min(MAX_W, Math.max(MIN_W, longest * CHAR_W + 28));
  const height = HEADER_H + Math.max(rows, 1) * ROW_H;
  return {width, height};
}

export type LayoutDirection = "LR" | "TB";

// Every object/array path in the document — used by "collapse all".
export function allContainerPaths(data: JsonValue): string[] {
  const paths: string[] = [];
  function walk(value: JsonValue, path: string): void {
    if (!isContainer(value)) return;
    paths.push(path);
    const entries: [string, JsonValue][] = Array.isArray(value)
      ? value.map((v, i) => [`[${i}]`, v])
      : Object.entries(value);
    for (const [k, child] of entries) walk(child, appendPath(path, k));
  }
  walk(data, "root");
  return paths;
}

export function jsonToGraph(
  data: JsonValue,
  collapsed: Set<string>,
  direction: LayoutDirection = "LR"
): {nodes: GraphNode[]; edges: Edge[]} {
  const nodes: GraphNode[] = [];
  const edges: Edge[] = [];
  let counter = 0;

  function walk(
    value: JsonValue,
    title: string,
    path: string,
    parentId: string | null
  ): void {
    const id = `n${counter++}`;

    if (isContainer(value)) {
      const kind = Array.isArray(value) ? "array" : "object";
      const entries: [string, JsonValue][] = Array.isArray(value)
        ? value.map((v, i) => [`[${i}]`, v])
        : Object.entries(value);

      const fields = entries
        .filter(([, v]) => !isContainer(v))
        .map(([k, v]) => ({k, v: scalarStr(v)}));
      const children = entries.filter(([, v]) => isContainer(v));

      const nodeData: GraphNodeData = {
        title,
        kind,
        fields,
        path,
        childCount: children.length,
        collapsed: collapsed.has(path),
        hasChildren: children.length > 0,
      };
      nodes.push({id, type: "json", position: {x: 0, y: 0}, data: nodeData});
      if (parentId) {
        edges.push({id: `${parentId}-${id}`, source: parentId, target: id});
      }

      if (!nodeData.collapsed) {
        for (const [k, child] of children) {
          walk(child, k, appendPath(path, k), id);
        }
      }
    } else {
      // Only reachable when the whole document is a scalar.
      const nodeData: GraphNodeData = {
        title,
        kind: "value",
        fields: [{k: "", v: scalarStr(value)}],
        path,
        childCount: 0,
        collapsed: false,
        hasChildren: false,
      };
      nodes.push({id, type: "json", position: {x: 0, y: 0}, data: nodeData});
      if (parentId) {
        edges.push({id: `${parentId}-${id}`, source: parentId, target: id});
      }
    }
  }

  walk(data, "root", "root", null);

  // Layout (LR = horizontal, JSON Crack style; TB = vertical).
  const g = new dagre.graphlib.Graph();
  g.setGraph({rankdir: direction, nodesep: 24, ranksep: 60});
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const {width, height} = estimateSize(n.data);
    g.setNode(n.id, {width, height});
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  for (const n of nodes) {
    const {x, y, width, height} = g.node(n.id);
    // dagre gives center points; React Flow positions by top-left.
    n.position = {x: x - width / 2, y: y - height / 2};
    n.width = width;
    n.height = height;
  }

  return {nodes, edges};
}
