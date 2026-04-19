// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { RLSCDocument, RLSCNode, RLSCQuery, LayoutRect } from "./types.js";
import { flattenTree } from "./tree-utils.js";

/**
 * 조건에 맞는 노드를 검색한다.
 */
export function queryNodes(
  doc: RLSCDocument,
  query: RLSCQuery,
): RLSCNode[] {
  const allNodes = flattenTree(doc.root);
  return allNodes.filter((node) => matchesQuery(node, query));
}

/**
 * 특정 영역 내 노드를 검색한다.
 */
export function findByRect(
  doc: RLSCDocument,
  rect: LayoutRect,
): RLSCNode[] {
  return queryNodes(doc, { withinRect: rect });
}

/**
 * 특정 role을 가진 노드를 검색한다.
 */
export function findByRole(
  doc: RLSCDocument,
  role: string,
): RLSCNode[] {
  return queryNodes(doc, { role });
}

/**
 * 특정 주소(address)를 가진 노드를 검색한다.
 */
export function findByAddress(
  doc: RLSCDocument,
  address: string,
): RLSCNode[] {
  const allNodes = flattenTree(doc.root);
  return allNodes.filter((n) => n.address === address);
}

/**
 * 노드 ID로 단일 노드를 찾는다.
 */
export function findById(
  doc: RLSCDocument,
  id: string,
): RLSCNode | undefined {
  const allNodes = flattenTree(doc.root);
  return allNodes.find((n) => n.id === id);
}

/**
 * 문서의 노드를 교체한다 (불변 — 새 문서 반환).
 */
export function replaceNode(
  doc: RLSCDocument,
  nodeId: string,
  patch: Partial<Pick<RLSCNode, "rect" | "zIndex" | "role" | "textContent">>,
): RLSCDocument {
  return {
    ...doc,
    root: patchNode(doc.root, nodeId, patch),
  };
}

/**
 * 문서에서 특정 노드를 제거한다 (불변).
 */
export function removeNode(
  doc: RLSCDocument,
  nodeId: string,
): RLSCDocument {
  return {
    ...doc,
    root: filterNode(doc.root, nodeId),
  };
}

/**
 * 두 문서의 차이를 계산한다.
 */
export function diffDocuments(
  before: RLSCDocument,
  after: RLSCDocument,
): LayoutDiff[] {
  const beforeNodes = new Map(
    flattenTree(before.root).map((n) => [n.id, n]),
  );
  const afterNodes = new Map(
    flattenTree(after.root).map((n) => [n.id, n]),
  );
  const diffs: LayoutDiff[] = [];

  // 추가된 노드
  for (const [id, node] of afterNodes) {
    if (!beforeNodes.has(id)) {
      diffs.push({ type: "added", nodeId: id, after: node.rect });
    }
  }

  // 삭제된 노드
  for (const [id, node] of beforeNodes) {
    if (!afterNodes.has(id)) {
      diffs.push({ type: "removed", nodeId: id, before: node.rect });
    }
  }

  // 변경된 노드
  for (const [id, beforeNode] of beforeNodes) {
    const afterNode = afterNodes.get(id);
    if (!afterNode) continue;

    if (!rectEquals(beforeNode.rect, afterNode.rect)) {
      const type =
        beforeNode.rect.width !== afterNode.rect.width ||
        beforeNode.rect.height !== afterNode.rect.height
          ? "resized"
          : "moved";
      diffs.push({
        type,
        nodeId: id,
        before: beforeNode.rect,
        after: afterNode.rect,
      });
    }

    if (beforeNode.zIndex !== afterNode.zIndex) {
      diffs.push({
        type: "reordered",
        nodeId: id,
        before: beforeNode.rect,
        after: afterNode.rect,
      });
    }
  }

  return diffs;
}

// ─── 타입 ───────────────────────────────────────────────────────────

export interface LayoutDiff {
  type: "added" | "removed" | "moved" | "resized" | "reordered";
  nodeId: string;
  before?: LayoutRect;
  after?: LayoutRect;
}

// ─── 내부 함수 ──────────────────────────────────────────────────────

function matchesQuery(node: RLSCNode, query: RLSCQuery): boolean {
  if (query.tag && node.tag !== query.tag) return false;
  if (query.role && node.role !== query.role) return false;
  if (query.hasClass && !node.classes.includes(query.hasClass)) return false;
  if (
    query.textContains &&
    (!node.textContent ||
      !node.textContent.toLowerCase().includes(query.textContains.toLowerCase()))
  )
    return false;
  if (query.withinRect && !rectIntersects(node.rect, query.withinRect))
    return false;
  if (query.visibleOnly && !node.visible) return false;

  const area = node.rect.width * node.rect.height;
  if (query.minArea != null && area < query.minArea) return false;
  if (query.maxArea != null && area > query.maxArea) return false;

  if (query.zRange) {
    if (query.zRange.min != null && node.zIndex < query.zRange.min)
      return false;
    if (query.zRange.max != null && node.zIndex > query.zRange.max)
      return false;
  }

  return true;
}

function rectIntersects(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function rectEquals(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}

function patchNode(
  node: RLSCNode,
  targetId: string,
  patch: Partial<Pick<RLSCNode, "rect" | "zIndex" | "role" | "textContent">>,
): RLSCNode {
  if (node.id === targetId) {
    return { ...node, ...patch };
  }
  return {
    ...node,
    children: node.children.map((c) => patchNode(c, targetId, patch)),
  };
}

function filterNode(node: RLSCNode, excludeId: string): RLSCNode {
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== excludeId)
      .map((c) => filterNode(c, excludeId)),
  };
}
