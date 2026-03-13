import type { LayoutResult, PositionedNode, PositionedEdge } from "./layout";
import type { NodeState } from "./style";
import { getNodeClass, getEdgeClass } from "./style";

const SVG_NS = "http://www.w3.org/2000/svg";

interface EventStackEntry {
  event_key: string;
  timestamp: string;
}

export interface GraphRenderer {
  render(): void;
  updateNodeState(stepId: string, state: NodeState): void;
  addEventToStack(stepId: string, event: EventStackEntry): void;
  highlightEdge(source: string, target: string): void;
  destroy(): void;
}

export function createGraphSvg(
  container: HTMLElement,
  layout: LayoutResult,
): GraphRenderer {
  let svg: SVGSVGElement | null = null;
  const nodeElements = new Map<string, SVGGElement>();
  const edgeElements = new Map<string, SVGGElement>();
  const eventStacks = new Map<string, EventStackEntry[]>();
  const nodeStates = new Map<string, NodeState>();

  function buildSvg(): SVGSVGElement {
    const el = document.createElementNS(SVG_NS, "svg");
    el.setAttribute("width", String(layout.width));
    el.setAttribute("height", String(layout.height));
    el.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    el.classList.add("spec-graph");
    return el;
  }

  function createArrowMarker(svgEl: SVGSVGElement): void {
    const defs = document.createElementNS(SVG_NS, "defs");

    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");

    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    polygon.classList.add("arrow-marker");

    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);
  }

  function renderEdge(svgEl: SVGSVGElement, edge: PositionedEdge): void {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", getEdgeClass(edge.type));
    g.setAttribute("data-source", edge.source);
    g.setAttribute("data-target", edge.target);

    if (edge.points.length >= 2) {
      const path = document.createElementNS(SVG_NS, "path");
      const d = edge.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("marker-end", "url(#arrowhead)");
      g.appendChild(path);
    }

    svgEl.appendChild(g);
    edgeElements.set(`${edge.source}->${edge.target}`, g);
  }

  function renderNode(svgEl: SVGSVGElement, node: PositionedNode): void {
    const g = document.createElementNS(SVG_NS, "g");
    const state = nodeStates.get(node.step_id) ?? "pending";
    g.setAttribute("class", getNodeClass(undefined, state));
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

    svgEl.appendChild(g);
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

  return {
    render() {
      container.innerHTML = "";
      svg = buildSvg();
      createArrowMarker(svg);

      for (const edge of layout.edges) {
        renderEdge(svg, edge);
      }

      for (const node of layout.nodes) {
        renderNode(svg, node);
      }

      container.appendChild(svg);
    },

    updateNodeState(stepId: string, state: NodeState) {
      nodeStates.set(stepId, state);
      const g = nodeElements.get(stepId);
      if (!g) return;
      g.setAttribute("class", getNodeClass(undefined, state));
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

    highlightEdge(source: string, target: string) {
      const g = edgeElements.get(`${source}->${target}`);
      if (!g) return;
      g.classList.add("edge-highlighted");
    },

    destroy() {
      if (svg && svg.parentElement) {
        svg.parentElement.removeChild(svg);
      }
      svg = null;
      nodeElements.clear();
      edgeElements.clear();
      eventStacks.clear();
      nodeStates.clear();
    },
  };
}
