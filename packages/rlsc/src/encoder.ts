// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { RLSCNode, RLSCDocument } from "./types.js";
import { gridToText } from "./grid.js";
import { layersToText } from "./layers.js";
import { relationsToText } from "./relations.js";

// ─── Encode (RLSCDocument → 마크업 문자열) ──────────────────────────

/**
 * R.L.S.C. 문서를 마크업 문자열로 직렬화한다.
 */
export function encodeToMarkup(doc: RLSCDocument): string {
  const sections: string[] = [];

  // 헤더
  const header = [
    "RLSC/1.0",
    `viewport: ${doc.viewport.width}×${doc.viewport.height}`,
    `url: ${doc.url}`,
    `timestamp: ${doc.timestamp}`,
  ];
  if (doc.address) header.push(`address: ${doc.address}`);
  sections.push(header.join("\n"));

  // 트리
  sections.push("# Tree\n" + nodeToText(doc.root, 0));

  // 그리드
  sections.push("# " + gridToText(doc.grid));

  // 레이어
  sections.push("# Layers\n" + layersToText(doc.layers));

  // 관계
  if (doc.relations.length > 0) {
    sections.push("# Relations\n" + relationsToText(doc.relations));
  }

  return sections.join("\n---\n");
}

/** 노드를 인덴트된 텍스트로 변환 */
function nodeToText(node: RLSCNode, indent: number): string {
  const pad = "  ".repeat(indent);
  const parts: string[] = [];

  // [tag#id.class] 또는 [tag.class]
  let selector = node.tag;
  if (node.id.includes("#")) {
    selector = node.id.split("__")[0]; // 자동 생성 suffix 제거
  } else {
    if (node.classes.length > 0) selector += `.${node.classes[0]}`;
  }

  parts.push(`[${selector}]`);

  // @(x,y) w×h
  parts.push(
    `@(${node.rect.x},${node.rect.y}) ${node.rect.width}×${node.rect.height}`,
  );

  // z:N (0이 아닌 경우만)
  if (node.zIndex !== 0) parts.push(`z:${node.zIndex}`);

  // role
  if (node.role) parts.push(`role:${node.role}`);

  // display (기본 block이 아닌 경우)
  if (node.display !== "block" && node.display !== "inline") {
    parts.push(`display:${node.display}`);
  }

  // text
  if (node.textContent) {
    const escaped = node.textContent.replace(/"/g, '\\"');
    parts.push(`"${escaped}"`);
  }

  // address
  if (node.address) parts.push(`addr:${node.address}`);

  let result = `${pad}${parts.join(" ")}`;

  // 자식
  for (const child of node.children) {
    result += "\n" + nodeToText(child, indent + 1);
  }

  return result;
}

// ─── Parse (마크업 문자열 → RLSCDocument) ───────────────────────────

/**
 * R.L.S.C. 마크업 문자열을 파싱하여 부분 문서로 반환한다.
 *
 * 파싱은 트리 섹션만 처리하며, grid/layers/relations는 재계산 필요.
 */
export function parseMarkup(markup: string): Partial<RLSCDocument> {
  const sections = markup.split(/^---$/m).map((s) => s.trim());

  // 헤더 파싱
  const headerSection = sections[0] ?? "";
  const headerLines = headerSection.split("\n");
  const header: Record<string, string> = {};
  for (const line of headerLines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) header[match[1]] = match[2];
  }

  const viewportMatch = header["viewport"]?.match(/(\d+)×(\d+)/);
  const viewport = viewportMatch
    ? { width: parseInt(viewportMatch[1]), height: parseInt(viewportMatch[2]) }
    : { width: 1920, height: 1080 };

  // 트리 섹션 찾기
  const treeSection = sections.find((s) => s.startsWith("# Tree"));
  const root = treeSection ? parseTree(treeSection) : undefined;

  return {
    version: "1.0",
    viewport,
    url: header["url"] ?? "",
    timestamp: header["timestamp"] ?? new Date().toISOString(),
    address: header["address"],
    ...(root ? { root } : {}),
    grid: { cellSize: 0, cols: 0, rows: 0, cells: [] },
    layers: [],
    relations: [],
  };
}

/** 트리 섹션 파싱 */
function parseTree(section: string): RLSCNode | undefined {
  const lines = section
    .split("\n")
    .filter((l) => l.trim().startsWith("["));

  if (lines.length === 0) return undefined;

  const nodeStack: { node: RLSCNode; indent: number }[] = [];

  for (const line of lines) {
    const indent = (line.match(/^(\s*)/)?.[1].length ?? 0) / 2;
    const node = parseNodeLine(line.trim(), indent);
    if (!node) continue;

    // 부모 찾기
    while (
      nodeStack.length > 0 &&
      nodeStack[nodeStack.length - 1].indent >= indent
    ) {
      nodeStack.pop();
    }

    if (nodeStack.length > 0) {
      const parent = nodeStack[nodeStack.length - 1].node;
      (parent.children as RLSCNode[]).push(node);
    }

    nodeStack.push({ node, indent });
  }

  return nodeStack.length > 0 ? nodeStack[0].node : undefined;
}

/** 단일 노드 라인 파싱 */
function parseNodeLine(line: string, depth: number): RLSCNode | undefined {
  // [selector] @(x,y) w×h z:N role:R "text"
  const selectorMatch = line.match(/^\[([^\]]+)\]/);
  if (!selectorMatch) return undefined;

  const selector = selectorMatch[1];
  const tag = selector.split(/[#.]/)[0];
  const id = selector;
  const classes = selector.match(/\.(\w+)/g)?.map((c) => c.slice(1)) ?? [];

  const rectMatch = line.match(/@\((-?\d+),(-?\d+)\)\s+(\d+)×(\d+)/);
  const rect = rectMatch
    ? {
        x: parseInt(rectMatch[1]),
        y: parseInt(rectMatch[2]),
        width: parseInt(rectMatch[3]),
        height: parseInt(rectMatch[4]),
      }
    : { x: 0, y: 0, width: 0, height: 0 };

  const zMatch = line.match(/z:(-?\d+)/);
  const roleMatch = line.match(/role:(\S+)/);
  const displayMatch = line.match(/display:(\S+)/);
  const textMatch = line.match(/"([^"]+)"/);
  const addrMatch = line.match(/addr:(\S+)/);

  return {
    id,
    tag,
    classes,
    role: roleMatch?.[1],
    rect,
    zIndex: zMatch ? parseInt(zMatch[1]) : 0,
    depth,
    display: displayMatch?.[1] ?? "block",
    position: "static",
    overflow: "visible",
    visible: true,
    textContent: textMatch?.[1],
    address: addrMatch?.[1],
    attributes: {},
    children: [],
  };
}
