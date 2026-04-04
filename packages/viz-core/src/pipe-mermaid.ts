/**
 * PipeGraph → Mermaid flowchart 변환
 *
 * ZoomView 또는 PipeGraph를 Mermaid 문법 문자열로 변환한다.
 * 줌 레벨에 따라 다른 상세도의 다이어그램을 생성한다.
 */

import type { PipeGraph, PipeSpec, ZoomView, ZoomNode, ZoomEdge, FoldLevel } from "@qa-sdk/core";
import { computeZoomView } from "@qa-sdk/core";

/** Mermaid 변환 옵션 */
export interface MermaidOptions {
  /** 방향: TB(위→아래, 기본) | LR(왼→오) */
  direction?: "TB" | "LR";
  /** 접힌 노드 표시 스타일 */
  foldedStyle?: "subgraph" | "node";
}

/**
 * PipeGraph → Mermaid flowchart 문자열.
 * 줌 레벨을 지정하면 해당 레벨로 접은 후 변환한다.
 */
export function pipeGraphToMermaid(
  graph: PipeGraph,
  level: FoldLevel = "leaf",
  options?: MermaidOptions,
): string {
  const view = computeZoomView(graph, level);
  return zoomViewToMermaid(view, options);
}

/** ZoomView → Mermaid flowchart 문자열 */
export function zoomViewToMermaid(
  view: ZoomView,
  options?: MermaidOptions,
): string {
  const dir = options?.direction ?? "LR";
  const lines: string[] = [`flowchart ${dir}`];

  // 노드 선언
  for (const node of view.nodes) {
    const label = escapeLabel(node.label);
    const shape = nodeShape(node);
    lines.push(`  ${safeId(node.id)}${shape.open}"${label}"${shape.close}`);
  }

  lines.push("");

  // 엣지 선언
  for (const edge of view.edges) {
    const arrow = edgeArrow(edge.kind);
    const label = edge.condition ? `|${escapeLabel(edge.condition)}|` : "";
    lines.push(`  ${safeId(edge.from)} ${arrow}${label} ${safeId(edge.to)}`);
  }

  // 스타일 — 접힌 노드, certainty
  const styles = generateStyles(view.nodes);
  if (styles.length > 0) {
    lines.push("");
    lines.push(...styles);
  }

  return lines.join("\n");
}

// ── 노드 형태 ────────────────────────────────────────

function nodeShape(node: ZoomNode): { open: string; close: string } {
  if (node.isFolded) {
    // 접힌 노드 → 이중 테두리 (stadium)
    return { open: "([", close: "])" };
  }
  switch (node.style.shape) {
    case "polygon": return { open: "[", close: "]" };
    case "cloud": return { open: "(", close: ")" };
    default: return { open: "[", close: "]" };
  }
}

// ── 엣지 화살표 ──────────────────────────────────────

function edgeArrow(kind: string): string {
  switch (kind) {
    case "next": return "-->";
    case "conditional": return "-.->"; // 점선
    case "event": return "==>";       // 두꺼운 선
    case "error": return "--x";       // X 표시
    case "compensate": return "o--o"; // 양방향 원
    case "fan-out": return "-->";
    case "join": return "-->";
    case "feedback": return "-.->"; // 점선 (피드백)
    default: return "-->";
  }
}

// ── 스타일 ───────────────────────────────────────────

function generateStyles(nodes: ZoomNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    const id = safeId(node.id);

    if (node.isFolded) {
      lines.push(`  style ${id} fill:#e1f5fe,stroke:#0288d1,stroke-width:3px`);
    } else if (node.style.certainty === "strict") {
      lines.push(`  style ${id} fill:#e8f5e9,stroke:#2e7d32`);
    } else if (node.style.certainty === "flexible") {
      lines.push(`  style ${id} fill:#fff3e0,stroke:#ef6c00,stroke-dasharray:5 5`);
    } else if (node.style.certainty === "mixed") {
      lines.push(`  style ${id} fill:#fff8e1,stroke:#f9a825,stroke-dasharray:3 3`);
    }
  }

  return lines;
}

// ── 헬퍼 ─────────────────────────────────────────────

/** Mermaid ID 안전 변환 — 특수문자 제거 */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Mermaid 라벨 이스케이프 */
function escapeLabel(s: string): string {
  return s.replace(/"/g, "#quot;");
}
