import type { RLSCNode, RLSCRelation, LayoutRect } from "./types.js";

/** 인접 판정 임계값 (px) */
const ADJACENCY_GAP = 16;
/** 정렬 판정 임계값 (px) */
const ALIGNMENT_THRESHOLD = 4;

/**
 * 가시 노드 목록에서 공간 관계를 탐지한다.
 *
 * 탐지 관계: contains, overlaps, adjacent-x, adjacent-y,
 *           aligned-x, aligned-y, stacked, flow
 */
export function detectRelations(nodes: readonly RLSCNode[]): RLSCRelation[] {
  const relations: RLSCRelation[] = [];
  const visibleNodes = nodes.filter((n) => n.visible);

  for (let i = 0; i < visibleNodes.length; i++) {
    const a = visibleNodes[i];
    for (let j = i + 1; j < visibleNodes.length; j++) {
      const b = visibleNodes[j];

      // contains (DOM depth 기반)
      if (a.depth < b.depth && rectContains(a.rect, b.rect)) {
        relations.push({ type: "contains", source: a.id, target: b.id });
        continue; // contains이면 다른 관계는 불필요
      }
      if (b.depth < a.depth && rectContains(b.rect, a.rect)) {
        relations.push({ type: "contains", source: b.id, target: a.id });
        continue;
      }

      // stacked (같은 위치, 다른 z-index)
      if (a.zIndex !== b.zIndex && rectsOverlap(a.rect, b.rect)) {
        const overlap = overlapRatio(a.rect, b.rect);
        if (overlap > 0.8) {
          relations.push({
            type: "stacked",
            source: a.zIndex < b.zIndex ? a.id : b.id,
            target: a.zIndex < b.zIndex ? b.id : a.id,
            strength: overlap,
          });
          continue;
        }
      }

      // overlaps
      if (rectsOverlap(a.rect, b.rect)) {
        const overlap = overlapRatio(a.rect, b.rect);
        if (overlap > 0.1) {
          relations.push({
            type: "overlaps",
            source: a.id,
            target: b.id,
            strength: overlap,
          });
        }
      }

      // adjacent-x (수평 인접)
      if (isAdjacentX(a.rect, b.rect)) {
        relations.push({ type: "adjacent-x", source: a.id, target: b.id });
      }

      // adjacent-y (수직 인접)
      if (isAdjacentY(a.rect, b.rect)) {
        relations.push({ type: "adjacent-y", source: a.id, target: b.id });
      }

      // aligned-x (수평 정렬)
      if (isAlignedX(a.rect, b.rect)) {
        relations.push({ type: "aligned-x", source: a.id, target: b.id });
      }

      // aligned-y (수직 정렬)
      if (isAlignedY(a.rect, b.rect)) {
        relations.push({ type: "aligned-y", source: a.id, target: b.id });
      }
    }
  }

  // flow 관계: 같은 부모 아래 형제 노드
  detectFlowRelations(nodes, relations);

  return relations;
}

// ─── 기하 함수 ──────────────────────────────────────────────────────

function rectContains(outer: LayoutRect, inner: LayoutRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function overlapRatio(a: LayoutRect, b: LayoutRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const intersection = (x2 - x1) * (y2 - y1);
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? intersection / smaller : 0;
}

function isAdjacentX(a: LayoutRect, b: LayoutRect): boolean {
  // y 축 겹침이 있어야 함
  const yOverlap =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (yOverlap <= 0) return false;
  // x 축 간격이 임계값 이내
  const gap = Math.min(
    Math.abs(a.x + a.width - b.x),
    Math.abs(b.x + b.width - a.x),
  );
  return gap <= ADJACENCY_GAP;
}

function isAdjacentY(a: LayoutRect, b: LayoutRect): boolean {
  // x 축 겹침이 있어야 함
  const xOverlap =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  if (xOverlap <= 0) return false;
  // y 축 간격이 임계값 이내
  const gap = Math.min(
    Math.abs(a.y + a.height - b.y),
    Math.abs(b.y + b.height - a.y),
  );
  return gap <= ADJACENCY_GAP;
}

function isAlignedX(a: LayoutRect, b: LayoutRect): boolean {
  return (
    Math.abs(a.x - b.x) <= ALIGNMENT_THRESHOLD ||
    Math.abs(a.x + a.width - (b.x + b.width)) <= ALIGNMENT_THRESHOLD
  );
}

function isAlignedY(a: LayoutRect, b: LayoutRect): boolean {
  return (
    Math.abs(a.y - b.y) <= ALIGNMENT_THRESHOLD ||
    Math.abs(a.y + a.height - (b.y + b.height)) <= ALIGNMENT_THRESHOLD
  );
}

// ─── Flow 관계 ──────────────────────────────────────────────────────

function detectFlowRelations(
  nodes: readonly RLSCNode[],
  relations: RLSCRelation[],
): void {
  for (const node of nodes) {
    if (node.children.length < 2) continue;
    const visibleChildren = node.children.filter((c) => c.visible);
    for (let i = 0; i < visibleChildren.length - 1; i++) {
      relations.push({
        type: "flow",
        source: visibleChildren[i].id,
        target: visibleChildren[i + 1].id,
      });
    }
  }
}

/** 관계를 텍스트로 출력 */
export function relationsToText(relations: readonly RLSCRelation[]): string {
  const lines: string[] = [];

  // 유형별 그룹화
  const groups = new Map<string, RLSCRelation[]>();
  for (const rel of relations) {
    if (!groups.has(rel.type)) groups.set(rel.type, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직후 .get()
    groups.get(rel.type)!.push(rel);
  }

  for (const [type, rels] of groups) {
    const typeLabel = type.toUpperCase();
    // 같은 source를 가진 관계를 합침
    const bySource = new Map<string, string[]>();
    for (const rel of rels) {
      if (!bySource.has(rel.source)) bySource.set(rel.source, []);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직후 .get()
      bySource.get(rel.source)!.push(rel.target);
    }
    for (const [source, targets] of bySource) {
      lines.push(`  ${source} ${typeLabel} ${targets.join(", ")}`);
    }
  }

  return lines.join("\n");
}
