// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import {
  createCanvasViewportSession,
  DEFAULT_CANVAS_VIEWPORT_PRESET,
  type CanvasViewportController,
  createMinimapLayout,
  minimapPointToContentPoint,
  projectViewportFrame,
} from "canvas-viewport";
import * as d3 from "d3";
import type { FileTreeNode } from "./types.js";

export function renderTreeCanvas(
  surfaceHost: HTMLElement,
  minimapHost: HTMLElement,
  tree: FileTreeNode,
  selectedNodeId: string,
  onSelectNode: (nodeId: string) => void,
): CanvasViewportController | null {
  surfaceHost.innerHTML = "";
  minimapHost.innerHTML = "";

  const width = Math.max(surfaceHost.clientWidth, 980);
  const hierarchy = d3.hierarchy<FileTreeNode>(tree, (node) => node.children);
  const totalNodes = hierarchy.descendants().length;
  const rowHeight = totalNodes > 120 ? 20 : 30;
  const columnWidth = 220;
  const layout = d3.tree<FileTreeNode>().nodeSize([rowHeight, columnWidth]);
  layout(hierarchy);

  const nodes = hierarchy.descendants() as d3.HierarchyPointNode<FileTreeNode>[];
  const links = hierarchy.links() as d3.HierarchyPointLink<FileTreeNode>[];
  const minX = d3.min(nodes, (node) => node.x) ?? 0;
  const maxX = d3.max(nodes, (node) => node.x) ?? 0;
  const maxY = d3.max(nodes, (node) => node.y) ?? 0;

  const height = Math.max(maxX - minX + 180, 620);
  const minimapLayout = createMinimapLayout({
    width: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapWidth + 20,
    height: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapHeight + 14,
    contentWidth: Math.max(width, maxY + 320),
    contentHeight: height,
    padding: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapPadding,
  });
  const svg = d3
    .select(surfaceHost)
    .append("svg")
    .attr("viewBox", `0 0 ${Math.max(width, maxY + 320)} ${height}`)
    .attr("class", "fmap-svg");

  const zoomLayer = svg.append("g");
  const rootGroup = zoomLayer.append("g").attr("transform", `translate(90, ${80 - minX})`);

  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([DEFAULT_CANVAS_VIEWPORT_PRESET.minScale, DEFAULT_CANVAS_VIEWPORT_PRESET.maxScale])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      zoomLayer.attr("transform", event.transform.toString());
      updateMinimapViewport(minimapHost, event.transform, minimapLayout);
    });
  const viewportSession = createCanvasViewportSession({
    getTransform: () => d3.zoomTransform(svg.node() as SVGSVGElement),
    setTransform: (nextTransform) => {
      svg.call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(nextTransform.x, nextTransform.y).scale(nextTransform.k),
      );
    },
    getContentSize: () => ({ width: Math.max(width, maxY + 320), height }),
    getViewportSize: () => ({ width, height }),
    preset: DEFAULT_CANVAS_VIEWPORT_PRESET,
  });
  svg.call(zoomBehavior);
  viewportSession.fitView();

  renderMinimap({
    host: minimapHost,
    nodes,
    links,
    minimapLayout,
    selectedNodeId,
    onSelectNode,
    svg,
    zoomBehavior,
  });

  const linkPath = d3.linkHorizontal<d3.HierarchyPointLink<FileTreeNode>, d3.HierarchyPointNode<FileTreeNode>>()
    .x((link) => link.y)
    .y((link) => link.x);

  rootGroup
    .append("g")
    .attr("class", "fmap-links")
    .selectAll<SVGPathElement, d3.HierarchyPointLink<FileTreeNode>>("path")
    .data(links)
    .join("path")
    .attr("d", (link: d3.HierarchyPointLink<FileTreeNode>) => linkPath(link) ?? "")
    .attr("fill", "none")
    .attr("stroke", (link: d3.HierarchyPointLink<FileTreeNode>) => linkStroke(link.target.data))
    .attr("stroke-width", (link: d3.HierarchyPointLink<FileTreeNode>) => 1.1 + Math.min(link.target.data.metrics.riskScore * 0.3, 3.6))
    .attr("stroke-opacity", 0.46);

  const nodeGroup = rootGroup
    .append("g")
    .selectAll<SVGGElement, d3.HierarchyPointNode<FileTreeNode>>("g")
    .data(nodes)
    .join("g")
    .attr("transform", (node: d3.HierarchyPointNode<FileTreeNode>) => `translate(${node.y},${node.x})`)
    .attr("class", (node: d3.HierarchyPointNode<FileTreeNode>) => {
      const classes = ["fmap-node"];
      if (node.data.id === selectedNodeId) classes.push("is-selected");
      return classes.join(" ");
    })
    .style("cursor", "pointer")
    .on("click", (_event: MouseEvent, node: d3.HierarchyPointNode<FileTreeNode>) => onSelectNode(node.data.id));

  nodeGroup
    .append("circle")
    .attr("r", (node: d3.HierarchyPointNode<FileTreeNode>) => nodeRadius(node.data))
    .attr("fill", (node: d3.HierarchyPointNode<FileTreeNode>) => nodeFill(node.data))
    .attr("stroke", (node: d3.HierarchyPointNode<FileTreeNode>) => nodeStroke(node.data))
    .attr("stroke-width", (node: d3.HierarchyPointNode<FileTreeNode>) => node.data.id === selectedNodeId ? 3 : 1.6);

  nodeGroup
    .append("text")
    .attr("x", (node: d3.HierarchyPointNode<FileTreeNode>) => node.children ? -14 : 14)
    .attr("y", 4)
    .attr("text-anchor", (node: d3.HierarchyPointNode<FileTreeNode>) => node.children ? "end" : "start")
    .attr("class", "fmap-label")
    .text((node: d3.HierarchyPointNode<FileTreeNode>) => labelForNode(node.data));

  nodeGroup
    .append("text")
    .attr("x", (node: d3.HierarchyPointNode<FileTreeNode>) => node.children ? -14 : 14)
    .attr("y", 21)
    .attr("text-anchor", (node: d3.HierarchyPointNode<FileTreeNode>) => node.children ? "end" : "start")
    .attr("class", "fmap-sub-label")
    .text((node: d3.HierarchyPointNode<FileTreeNode>) => metricLabel(node.data));

  return viewportSession;
}

function renderMinimap(params: {
  host: HTMLElement;
  nodes: d3.HierarchyPointNode<FileTreeNode>[];
  links: d3.HierarchyPointLink<FileTreeNode>[];
  minimapLayout: ReturnType<typeof createMinimapLayout>;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
}): void {
  const { width, height, padding, scale, contentWidth, contentHeight } = params.minimapLayout;

  const minimapSvg = d3
    .select(params.host)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("class", "fmap-minimap-svg");

  const mapLayer = minimapSvg
    .append("g")
    .attr("transform", `translate(${padding}, ${padding}) scale(${scale})`);

  const miniLink = d3.linkHorizontal<d3.HierarchyPointLink<FileTreeNode>, d3.HierarchyPointNode<FileTreeNode>>()
    .x((link) => link.y)
    .y((link) => link.x);

  mapLayer
    .append("g")
    .selectAll<SVGPathElement, d3.HierarchyPointLink<FileTreeNode>>("path")
    .data(params.links)
    .join("path")
    .attr("d", (link) => miniLink(link) ?? "")
    .attr("fill", "none")
    .attr("stroke", "#b0bec5")
    .attr("stroke-width", 1.2 / scale)
    .attr("stroke-opacity", 0.8);

  mapLayer
    .append("g")
    .selectAll<SVGCircleElement, d3.HierarchyPointNode<FileTreeNode>>("circle")
    .data(params.nodes)
    .join("circle")
    .attr("cx", (node) => node.y)
    .attr("cy", (node) => node.x)
    .attr("r", (node) => (node.data.id === params.selectedNodeId ? 4.5 : 3.2) / scale)
    .attr("fill", (node) => node.data.id === params.selectedNodeId ? "#c0392b" : "#607d8b")
    .attr("stroke", "white")
    .attr("stroke-width", 1.2 / scale)
    .on("click", (_event, node) => {
      params.onSelectNode(node.data.id);
    });

  const viewport = minimapSvg
    .append("rect")
    .attr("class", "fmap-minimap-viewport")
    .attr("fill", "rgba(21,101,192,0.12)")
    .attr("stroke", "#1565c0")
    .attr("stroke-width", 1);

  minimapSvg.on("click", (event: MouseEvent) => {
    const point = d3.pointer(event, minimapSvg.node());
    const target = minimapPointToContentPoint({ x: point[0], y: point[1] }, params.minimapLayout);
    const currentTransform = d3.zoomTransform(params.svg.node() as SVGSVGElement);
    const bounds = (params.svg.node() as SVGSVGElement).getBoundingClientRect();
    params.svg.call(
      params.zoomBehavior.transform,
      d3.zoomIdentity.translate(
        bounds.width / 2 - target.x * currentTransform.k,
        bounds.height / 2 - target.y * currentTransform.k,
      ).scale(currentTransform.k),
    );
  });

  updateMinimapViewport(
    params.host,
    params.svg.node() as SVGSVGElement,
    d3.zoomTransform(params.svg.node() as SVGSVGElement),
    params.minimapLayout,
  );
}

function updateMinimapViewport(
  host: HTMLElement,
  svg: SVGSVGElement,
  transform: d3.ZoomTransform,
  layout: ReturnType<typeof createMinimapLayout>,
): void {
  const viewport = host.querySelector<SVGRectElement>(".fmap-minimap-viewport");
  if (!viewport) return;

  const bounds = svg.getBoundingClientRect();
  const frame = projectViewportFrame(transform, layout, {
    width: bounds.width || layout.contentWidth,
    height: bounds.height || layout.contentHeight,
  });
  viewport.setAttribute("x", String(frame.x));
  viewport.setAttribute("y", String(frame.y));
  viewport.setAttribute("width", String(frame.width));
  viewport.setAttribute("height", String(frame.height));
}

function nodeRadius(node: FileTreeNode): number {
  if (node.kind === "file") {
    return 5 + Math.min(node.metrics.riskScore, 10) * 0.65;
  }
  return 7 + Math.min(Math.sqrt(node.metrics.fileCount) * 1.8, 18);
}

function nodeFill(node: FileTreeNode): string {
  if (node.metrics.hotspotCount > 0 && node.kind === "file") return "#c0392b";
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount > 0) return "#e67e22";
  if (node.metrics.executionWorkspaceTouchedFiles > 0) return "#f1c40f";
  if (node.metrics.workspaceTouchedFiles > 0) return "#d4ac0d";
  if (node.metrics.worktreeTouchCount > 0) return "#8e44ad";
  if (node.metrics.remoteTouchCount > 0) return "#2980b9";
  if (node.metrics.currentTouchedFiles > 0) return "#16a085";
  return "#cfd8dc";
}

function nodeStroke(node: FileTreeNode): string {
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount > 0) return "#943126";
  if (node.metrics.hotspotCount > 0) return "#641e16";
  return "#1f2d3d";
}

function linkStroke(node: FileTreeNode): string {
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount > 0) return "#f39c12";
  if (node.metrics.executionWorkspaceTouchedFiles > 0) return "#f1c40f";
  if (node.metrics.workspaceTouchedFiles > 0) return "#d4ac0d";
  if (node.metrics.worktreeTouchCount > 0) return "#af7ac5";
  if (node.metrics.remoteTouchCount > 0) return "#7fb3d5";
  if (node.metrics.currentTouchedFiles > 0) return "#73c6b6";
  return "#d5d8dc";
}

function labelForNode(node: FileTreeNode): string {
  return node.path === "" ? "repo" : node.name;
}

function metricLabel(node: FileTreeNode): string {
  const overlap = node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount;
  return node.kind === "file"
    ? `risk ${node.metrics.riskScore} · overlap ${overlap}`
    : `${node.metrics.fileCount} files · overlap ${overlap}`;
}
