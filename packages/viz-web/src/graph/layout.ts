// @def.boundary viz-system-root
// @def.doc viz-system-root

import dagre from "dagre";
import type { SpecGraph, SpecEdge } from "@qa-sdk/core";
import { getCoreEvent } from "@qa-sdk/event-catalog";
import type { GraphRole } from "@qa-sdk/event-catalog";

export interface PositionedNode {
  step_id: string;
  event_key: string;
  kind: string;
  required: boolean;
  role: GraphRole | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedEdge {
  source: string;
  target: string;
  type: SpecEdge["type"];
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const NODE_PADDING_X = 24;
const NODE_PADDING_Y = 16;
const CHAR_WIDTH = 8;
const MIN_NODE_WIDTH = 100;
const NODE_HEIGHT = 40;

function computeNodeWidth(label: string): number {
  return Math.max(MIN_NODE_WIDTH, label.length * CHAR_WIDTH + NODE_PADDING_X * 2);
}

export function computeLayout(graph: SpecGraph): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 50,
    ranksep: 60,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    const width = computeNodeWidth(node.event_key);
    const height = NODE_HEIGHT + NODE_PADDING_Y;
    const role = getCoreEvent(node.event_key)?.graph_hint?.role as GraphRole | undefined;
    g.setNode(node.step_id, {
      label: node.event_key,
      width,
      height,
      step_id: node.step_id,
      event_key: node.event_key,
      kind: node.kind,
      required: node.required,
      role,
    });
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target, { type: edge.type });
  }

  dagre.layout(g);

  const positionedNodes: PositionedNode[] = g.nodes().map((id) => {
    const n = g.node(id) as dagre.Node & {
      step_id: string;
      event_key: string;
      kind: string;
      required: boolean;
      role: GraphRole | undefined;
    };
    return {
      step_id: n.step_id,
      event_key: n.event_key,
      kind: n.kind,
      required: n.required,
      role: n.role,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
    };
  });

  const positionedEdges: PositionedEdge[] = g.edges().map((e) => {
    const edgeData = g.edge(e) as dagre.GraphEdge & { type?: SpecEdge["type"] };
    return {
      source: e.v,
      target: e.w,
      type: edgeData.type ?? "sequence",
      points: edgeData.points.map((p) => ({ x: p.x, y: p.y })),
    };
  });

  const graphMeta = g.graph() as dagre.GraphLabel;
  const width = graphMeta.width ?? 800;
  const height = graphMeta.height ?? 600;

  return { nodes: positionedNodes, edges: positionedEdges, width, height };
}
