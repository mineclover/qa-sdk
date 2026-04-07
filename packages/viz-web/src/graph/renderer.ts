import {
  applyViewportHudAction,
  createCanvasViewportSession,
  renderCanvasSupportBar,
  type CanvasViewportController,
  createViewportHudActions,
  DEFAULT_CANVAS_VIEWPORT_PRESET,
  createMinimapLayout,
  isViewportHudActionId,
  minimapPointToContentPoint,
  projectViewportFrame,
  renderCanvasHud,
  type ViewTransformLike,
} from "canvas-viewport";
import type { LayoutResult, PositionedNode, PositionedEdge } from "./layout";
import type { NodeState } from "./style";
import type { GraphRole } from "@qa-sdk/event-catalog";
import { getNodeClass, getEdgeClass } from "./style";

const SVG_NS = "http://www.w3.org/2000/svg";

interface EventStackEntry {
  event_key: string;
  timestamp: string;
}

export interface GraphRenderer extends CanvasViewportController {
  render(): void;
  /** 노드 상태, 엣지 하이라이트, 이벤트 배지를 모두 초기 상태로 리셋 */
  resetState(): void;
  updateNodeState(stepId: string, state: NodeState): void;
  addEventToStack(stepId: string, event: EventStackEntry): void;
  highlightEdge(source: string, target: string): void;
  destroy(): void;
}

// Converts dagre waypoints to a smooth SVG path.
// For 2-point edges: cubic bezier S-curve (matches TB flow direction).
// For multi-point edges: quadratic bezier through midpoints (smooth polyline).
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";

  if (points.length === 2) {
    const [p0, p1] = points;
    const cy = (p1.y - p0.y) * 0.5;
    return `M ${p0.x} ${p0.y} C ${p0.x} ${p0.y + cy}, ${p1.x} ${p1.y - cy}, ${p1.x} ${p1.y}`;
  }

  const [first] = points;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function createGraphSvg(
  container: HTMLElement,
  layout: LayoutResult,
): GraphRenderer {
  let shell: HTMLDivElement | null = null;
  let svg: SVGSVGElement | null = null;
  let scene: SVGGElement | null = null;
  let minimapHost: HTMLDivElement | null = null;
  let supportHost: HTMLDivElement | null = null;
  let minimapViewport: SVGRectElement | null = null;
  let transform: ViewTransformLike = { x: 0, y: 0, k: 1 };
  let dragging = false;
  let dragOrigin: { x: number; y: number } | null = null;
  let dragTransformStart: ViewTransformLike | null = null;
  const nodeElements = new Map<string, SVGGElement>();
  const edgeElements = new Map<string, SVGGElement>();
  const eventStacks = new Map<string, EventStackEntry[]>();
  const nodeStates = new Map<string, NodeState>();
  // Persist role so updateNodeState can re-apply it after state changes
  const nodeRoles = new Map<string, GraphRole | undefined>();
  const minimapLayout = createMinimapLayout({
    width: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapWidth,
    height: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapHeight,
    contentWidth: layout.width,
    contentHeight: layout.height,
    padding: DEFAULT_CANVAS_VIEWPORT_PRESET.minimapPadding,
  });
  const viewportSession = createCanvasViewportSession({
    getTransform: () => transform,
    setTransform: (nextTransform) => {
      transform = nextTransform;
      applyTransform();
    },
    getContentSize: () => ({ width: layout.width, height: layout.height }),
    getViewportSize: () => ({ width: layout.width, height: layout.height }),
    preset: DEFAULT_CANVAS_VIEWPORT_PRESET,
  });

  function buildSvg(): SVGSVGElement {
    const el = document.createElementNS(SVG_NS, "svg");
    el.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    el.setAttribute("preserveAspectRatio", "xMidYMid meet");
    el.classList.add("spec-graph");
    return el;
  }

  function buildShell(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "spec-graph-shell cv-shell";
    return el;
  }

  function buildMinimap(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "spec-graph-minimap cv-minimap";
    return el;
  }

  function buildSupportHost(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "spec-graph-support cv-support-host";
    return el;
  }

  function renderHud(host: HTMLDivElement): void {
    renderCanvasHud(host, {
      hint: "휠 확대 · 드래그 이동 · 미니맵 클릭 이동",
      actions: createViewportHudActions({
        includeZoom: true,
        includeFitView: true,
        includeResetView: false,
      }),
      onAction: (actionId: string) => {
        if (!isViewportHudActionId(actionId)) return;
        applyViewportHudAction(rendererApi, actionId);
      },
    });
  }

  function renderSupport(host: HTMLDivElement): void {
    renderCanvasSupportBar(host, {
      leading: "Spec Graph",
      chips: [
        { label: `nodes ${layout.nodes.length}`, tone: "info" },
        { label: `edges ${layout.edges.length}`, tone: "success" },
      ],
      actions: [
        { id: "graph:reset-state", label: "상태 리셋" },
      ],
      onAction: (actionId: string) => {
        if (actionId === "graph:reset-state") {
          rendererApi.resetState();
        }
      },
    });
  }

  function buildScene(svgEl: SVGSVGElement): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    svgEl.appendChild(group);
    return group;
  }

  function createArrowMarker(svgEl: SVGSVGElement): void {
    const defs = document.createElementNS(SVG_NS, "defs");

    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");

    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    // context-stroke: arrowhead inherits the stroke color of the referencing path
    polygon.setAttribute("fill", "context-stroke");

    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);
  }

  function renderEdge(sceneEl: SVGGElement, edge: PositionedEdge): void {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", getEdgeClass(edge.type));
    g.setAttribute("data-source", edge.source);
    g.setAttribute("data-target", edge.target);

    if (edge.points.length >= 2) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", buildSmoothPath(edge.points));
      path.setAttribute("fill", "none");
      path.setAttribute("marker-end", "url(#arrowhead)");
      g.appendChild(path);
    }

    sceneEl.appendChild(g);
    edgeElements.set(`${edge.source}->${edge.target}`, g);
  }

  function renderNode(sceneEl: SVGGElement, node: PositionedNode): void {
    const g = document.createElementNS(SVG_NS, "g");
    const state = nodeStates.get(node.step_id) ?? "pending";

    nodeRoles.set(node.step_id, node.role);
    g.setAttribute("class", getNodeClass(node.role, state));
    g.setAttribute("data-step-id", node.step_id);
    g.setAttribute(
      "transform",
      `translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`,
    );

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", String(node.width));
    rect.setAttribute("height", String(node.height));
    rect.setAttribute("rx", "6");
    rect.setAttribute("ry", "6");
    g.appendChild(rect);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(node.width / 2));
    text.setAttribute("y", String(node.height / 2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.textContent = node.event_key;
    g.appendChild(text);

    if (!node.required) {
      const badge = document.createElementNS(SVG_NS, "text");
      badge.setAttribute("x", String(node.width - 8));
      badge.setAttribute("y", "12");
      badge.setAttribute("text-anchor", "end");
      badge.setAttribute("class", "optional-badge");
      badge.textContent = "opt";
      g.appendChild(badge);
    }

    sceneEl.appendChild(g);
    nodeElements.set(node.step_id, g);
  }

  function renderEventBadge(g: SVGGElement, count: number): void {
    const existing = g.querySelector(".event-count-badge");
    if (existing) existing.remove();

    if (count === 0) return;

    const node = layout.nodes.find(
      (n) => n.step_id === g.getAttribute("data-step-id"),
    );
    if (!node) return;

    const badge = document.createElementNS(SVG_NS, "g");
    badge.setAttribute("class", "event-count-badge");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(node.width - 4));
    circle.setAttribute("cy", "4");
    circle.setAttribute("r", "10");
    badge.appendChild(circle);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(node.width - 4));
    text.setAttribute("y", "4");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.textContent = count > 99 ? "99+" : String(count);
    badge.appendChild(text);

    g.appendChild(badge);
  }

  function toCanvasPoint(event: MouseEvent, svgEl: SVGSVGElement): { x: number; y: number } {
    const rect = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function applyTransform(): void {
    if (!scene) return;
    scene.setAttribute("transform", `translate(${transform.x} ${transform.y}) scale(${transform.k})`);
    updateMinimapViewport();
  }

  function updateMinimapViewport(): void {
    if (!minimapViewport) return;
    const frame = projectViewportFrame(transform, minimapLayout, {
      width: svg?.clientWidth ?? minimapLayout.contentWidth,
      height: svg?.clientHeight ?? minimapLayout.contentHeight,
    });
    minimapViewport.setAttribute("x", String(frame.x));
    minimapViewport.setAttribute("y", String(frame.y));
    minimapViewport.setAttribute("width", String(frame.width));
    minimapViewport.setAttribute("height", String(frame.height));
  }

  function bindViewportInteractions(svgEl: SVGSVGElement): void {
    svgEl.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point = toCanvasPoint(event, svgEl);
      viewportSession.zoomAtPoint(
        point,
        event.deltaY > 0
          ? DEFAULT_CANVAS_VIEWPORT_PRESET.wheelZoomOutFactor
          : DEFAULT_CANVAS_VIEWPORT_PRESET.wheelZoomInFactor,
      );
    }, { passive: false });

    svgEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      dragOrigin = toCanvasPoint(event, svgEl);
      dragTransformStart = { ...transform };
      svgEl.setPointerCapture(event.pointerId);
    });

    svgEl.addEventListener("pointermove", (event) => {
      if (!dragging || !dragOrigin || !dragTransformStart) return;
      const point = toCanvasPoint(event, svgEl);
      viewportSession.setTransform({
        x: dragTransformStart.x + (point.x - dragOrigin.x),
        y: dragTransformStart.y + (point.y - dragOrigin.y),
        k: dragTransformStart.k,
      });
    });

    const endDrag = (event: PointerEvent) => {
      dragging = false;
      dragOrigin = null;
      dragTransformStart = null;
      if (svgEl.hasPointerCapture(event.pointerId)) {
        svgEl.releasePointerCapture(event.pointerId);
      }
    };

    svgEl.addEventListener("pointerup", endDrag);
    svgEl.addEventListener("pointercancel", endDrag);
  }

  function renderMinimap(): void {
    if (!minimapHost || !svg) return;
    minimapHost.innerHTML = "";
    const minimapSvg = document.createElementNS(SVG_NS, "svg");
    minimapSvg.setAttribute("viewBox", `0 0 ${minimapLayout.width} ${minimapLayout.height}`);
    minimapSvg.classList.add("spec-graph-minimap-svg");
    minimapHost.appendChild(minimapSvg);

    const mapLayer = document.createElementNS(SVG_NS, "g");
    mapLayer.setAttribute(
      "transform",
      `translate(${minimapLayout.padding} ${minimapLayout.padding}) scale(${minimapLayout.scale})`,
    );
    minimapSvg.appendChild(mapLayer);

    for (const edge of layout.edges) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", buildSmoothPath(edge.points));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#94a3b8");
      path.setAttribute("stroke-width", String(1 / minimapLayout.scale));
      path.setAttribute("stroke-opacity", "0.85");
      mapLayer.appendChild(path);
    }

    for (const node of layout.nodes) {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", String(3.5 / minimapLayout.scale));
      circle.setAttribute("fill", "#475569");
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", String(1 / minimapLayout.scale));
      circle.addEventListener("click", (event) => {
        event.stopPropagation();
        viewportSession.centerOnPoint({ x: node.x, y: node.y });
      });
      mapLayer.appendChild(circle);
    }

    minimapViewport = document.createElementNS(SVG_NS, "rect");
    minimapViewport.setAttribute("class", "spec-graph-minimap-viewport");
    minimapViewport.setAttribute("fill", "rgba(74,158,255,0.14)");
    minimapViewport.setAttribute("stroke", "#4a9eff");
    minimapViewport.setAttribute("stroke-width", "1");
    minimapSvg.appendChild(minimapViewport);

    minimapSvg.addEventListener("click", (event) => {
      const point = toCanvasPoint(event as MouseEvent, minimapSvg);
      const contentPoint = minimapPointToContentPoint(point, minimapLayout);
      viewportSession.centerOnPoint(contentPoint);
    });

    updateMinimapViewport();
  }

  function resetView(): void {
    viewportSession.resetView();
  }

  function fitView(): void {
    viewportSession.fitView();
  }

  function zoomIn(): void {
    viewportSession.zoomIn();
  }

  function zoomOut(): void {
    viewportSession.zoomOut();
  }
  const rendererApi: GraphRenderer = {
    render() {
      container.innerHTML = "";
      shell = buildShell();
      svg = buildSvg();
      scene = buildScene(svg);
      createArrowMarker(svg);
      bindViewportInteractions(svg);

      for (const edge of layout.edges) {
        renderEdge(scene, edge);
      }

      for (const node of layout.nodes) {
        renderNode(scene, node);
      }
      minimapHost = buildMinimap();
      supportHost = buildSupportHost();
      const hudHost = document.createElement("div");
      renderSupport(supportHost);
      renderHud(hudHost);
      shell.appendChild(svg);
      shell.appendChild(supportHost);
      shell.appendChild(hudHost);
      shell.appendChild(minimapHost);
      container.appendChild(shell);
      renderMinimap();
      viewportSession.resetView();
    },

    updateNodeState(stepId: string, state: NodeState) {
      nodeStates.set(stepId, state);
      const g = nodeElements.get(stepId);
      if (!g) return;
      const role = nodeRoles.get(stepId);
      g.setAttribute("class", getNodeClass(role, state));
    },

    addEventToStack(stepId: string, event: EventStackEntry) {
      const stack = eventStacks.get(stepId) ?? [];
      stack.push(event);
      eventStacks.set(stepId, stack);

      const g = nodeElements.get(stepId);
      if (g) {
        renderEventBadge(g, stack.length);
      }
    },

    resetState() {
      // Reset all nodes to pending
      for (const [stepId, g] of nodeElements) {
        nodeStates.set(stepId, "pending");
        const role = nodeRoles.get(stepId);
        g.setAttribute("class", getNodeClass(role, "pending"));
      }
      // Clear edge highlights
      for (const [, g] of edgeElements) {
        g.classList.remove("edge-highlighted");
      }
      // Clear event badges and stacks
      eventStacks.clear();
      for (const [, g] of nodeElements) {
        const badge = g.querySelector(".event-count-badge");
        if (badge) badge.remove();
      }
    },

    resetView() {
      viewportSession.resetView();
    },
    fitView() {
      viewportSession.fitView();
    },
    zoomIn() {
      viewportSession.zoomIn();
    },
    zoomOut() {
      viewportSession.zoomOut();
    },

    highlightEdge(source: string, target: string) {
      const g = edgeElements.get(`${source}->${target}`);
      if (!g) return;
      g.classList.add("edge-highlighted");
    },

    destroy() {
      if (shell && shell.parentElement) {
        shell.parentElement.removeChild(shell);
      }
      shell = null;
      svg = null;
      scene = null;
      minimapHost = null;
      supportHost = null;
      minimapViewport = null;
      nodeElements.clear();
      edgeElements.clear();
      eventStacks.clear();
      nodeStates.clear();
      nodeRoles.clear();
    },
  };
  return rendererApi;
}
