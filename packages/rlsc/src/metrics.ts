// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type {
  RLSCDocument,
  RLSCNode,
  LayoutRect,
  RLSCRelation,
  LayoutGrid,
  LayoutMetrics,
  ProximityGroup,
  TextOccupancy,
} from "./types.js";
import { flattenTree } from "./tree-utils.js";
import { extractRegions } from "./grid.js";

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────

/** rect 중심점 반환 */
function rectCenter(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** rect 면적 반환 */
function rectArea(rect: LayoutRect): number {
  return rect.width * rect.height;
}

/** 두 점 사이의 유클리드 거리 */
function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** 두 rect의 합집합(bounding) rect 반환 */
function unionRect(a: LayoutRect, b: LayoutRect): LayoutRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: x2 - x, height: y2 - y };
}

/** 숫자 배열의 중앙값 반환 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** 두 정수의 최대공약수 */
function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/** 숫자 배열 전체의 GCD */
function gcdAll(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => gcd(acc, v));
}

// ─── 측정 함수 ──────────────────────────────────────────────────────

/**
 * 가시 노드 면적을 뷰포트 중앙선 기준으로 분할하여 좌우·상하 무게 비율을 반환한다.
 * 한쪽 면적이 0이면 관례값 99를 반환한다.
 */
export function measureBalance(
  nodes: readonly RLSCNode[],
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const visible = nodes.filter((n) => n.visible);
  const midX = viewport.width / 2;
  const midY = viewport.height / 2;

  let leftArea = 0;
  let rightArea = 0;
  let topArea = 0;
  let bottomArea = 0;

  for (const node of visible) {
    const { rect } = node;
    const area = rectArea(rect);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    if (cx <= midX) leftArea += area;
    else rightArea += area;

    if (cy <= midY) topArea += area;
    else bottomArea += area;
  }

  const x = leftArea === 0 || rightArea === 0 ? 99 : leftArea / rightArea;
  const y = topArea === 0 || bottomArea === 0 ? 99 : topArea / bottomArea;

  return { x, y };
}

/**
 * 그리드에서 dominant 영역이 규칙적 행·열 패턴을 이루는지 판별한다.
 * 행·열 간격 편차가 cellSize × 2 이내이면 그리드로 인정한다.
 */
export function detectGridPattern(
  grid: LayoutGrid,
): { cols: number; rows: number } | null {
  const regions = extractRegions(grid);
  if (regions.length < 2) return null;

  const tolerance = grid.cellSize * 2;

  // rowStart 기준으로 그룹화 → 행 수 결정
  const rowGroups: number[][] = [];
  for (const region of regions) {
    let assigned = false;
    for (const group of rowGroups) {
      if (Math.abs(region.rowStart - group[0]!) <= tolerance) {
        group.push(region.rowStart);
        assigned = true;
        break;
      }
    }
    if (!assigned) rowGroups.push([region.rowStart]);
  }

  // colStart 기준으로 그룹화 → 열 수 결정
  const colGroups: number[][] = [];
  for (const region of regions) {
    let assigned = false;
    for (const group of colGroups) {
      if (Math.abs(region.colStart - group[0]!) <= tolerance) {
        group.push(region.colStart);
        assigned = true;
        break;
      }
    }
    if (!assigned) colGroups.push([region.colStart]);
  }

  const rowCount = rowGroups.length;
  const colCount = colGroups.length;

  if (rowCount < 1 || colCount < 1) return null;

  // 행 간격 편차 검증
  const rowStarts = rowGroups
    .map((g) => Math.min(...g))
    .toSorted((a, b) => a - b);
  const colStarts = colGroups
    .map((g) => Math.min(...g))
    .toSorted((a, b) => a - b);

  if (rowStarts.length > 1) {
    const rowGaps: number[] = [];
    for (let i = 1; i < rowStarts.length; i++) {
      rowGaps.push(rowStarts[i]! - rowStarts[i - 1]!);
    }
    const avgRowGap = rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length;
    const maxRowVariance = Math.max(
      ...rowGaps.map((g) => Math.abs(g - avgRowGap)),
    );
    if (maxRowVariance > tolerance) return null;
  }

  if (colStarts.length > 1) {
    const colGaps: number[] = [];
    for (let i = 1; i < colStarts.length; i++) {
      colGaps.push(colStarts[i]! - colStarts[i - 1]!);
    }
    const avgColGap = colGaps.reduce((a, b) => a + b, 0) / colGaps.length;
    const maxColVariance = Math.max(
      ...colGaps.map((g) => Math.abs(g - avgColGap)),
    );
    if (maxColVariance > tolerance) return null;
  }

  return { cols: colCount, rows: rowCount };
}

/**
 * 뷰포트 비율이 황금비(1.618)에 얼마나 가까운지 0–1 점수로 반환한다.
 */
export function scoreGoldenRatio(viewport: {
  width: number;
  height: number;
}): number {
  const { width, height } = viewport;
  if (width === 0 || height === 0) return 0;

  const ratio = Math.max(width, height) / Math.min(width, height);
  const score = 1 - Math.abs(ratio - 1.618) / 1.618;

  return Math.max(0, score);
}

/**
 * 가시 노드를 gapThreshold 기준으로 그리디 클러스터링하여
 * 근접성 그룹 목록을 반환한다.
 */
export function detectProximityGroups(
  nodes: readonly RLSCNode[],
  gapThreshold = 32,
): ProximityGroup[] {
  const visible = nodes.filter((n) => n.visible);
  const unassigned = new Set(visible.map((_, i) => i));
  const groups: ProximityGroup[] = [];

  while (unassigned.size > 0) {
    // 첫 미할당 노드에서 시작
    const startIdx = unassigned.values().next().value as number;
    unassigned.delete(startIdx);

    const clusterIndices: number[] = [startIdx];
    const queue: number[] = [startIdx];

    // 그리디 BFS: gapThreshold 이내 노드 수집
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentCenter = rectCenter(visible[current]!.rect);

      for (const idx of Array.from(unassigned)) {
        const candidateCenter = rectCenter(visible[idx]!.rect);
        if (distance(currentCenter, candidateCenter) <= gapThreshold) {
          unassigned.delete(idx);
          clusterIndices.push(idx);
          queue.push(idx);
        }
      }
    }

    const clusterNodes = clusterIndices.map((i) => visible[i]!);

    // centroid = 면적 가중 평균
    let totalArea = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const node of clusterNodes) {
      const area = rectArea(node.rect);
      const center = rectCenter(node.rect);
      totalArea += area;
      weightedX += center.x * area;
      weightedY += center.y * area;
    }

    const centroid =
      totalArea > 0
        ? { x: weightedX / totalArea, y: weightedY / totalArea }
        : rectCenter(clusterNodes[0]!.rect);

    // boundingRect = 모든 rect의 합집합
    let boundingRect = clusterNodes[0]!.rect;
    for (let i = 1; i < clusterNodes.length; i++) {
      boundingRect = unionRect(boundingRect, clusterNodes[i]!.rect);
    }

    groups.push({
      nodeIds: clusterNodes.map((n) => n.id),
      centroid,
      boundingRect,
    });
  }

  return groups;
}

/**
 * 관계 유형 집계로 주 흐름 방향을 결정한다.
 * adjacent-x → 수평, adjacent-y → 수직으로 집계한다.
 */
export function detectDominantFlow(
  relations: readonly RLSCRelation[],
): "horizontal" | "vertical" | "grid" | "free" {
  let horizontal = 0;
  let vertical = 0;
  let flowCount = 0;

  for (const rel of relations) {
    if (rel.type === "adjacent-x") horizontal++;
    else if (rel.type === "adjacent-y") vertical++;
    else if (rel.type === "flow") flowCount++;
  }

  if (horizontal > vertical * 1.5) return "horizontal";
  if (vertical > horizontal * 1.5) return "vertical";
  if (horizontal > 0 && vertical > 0) return "grid";
  // "flow" 단독: 방향 불명확, horizontal 기본값
  if (flowCount > 0) return "horizontal";
  return "free";
}

/**
 * 가시 노드의 x 좌표 클러스터로 컬럼 시스템을 감지한다.
 */
export function detectColumnSystem(
  nodes: readonly RLSCNode[],
  viewport: { width: number; height: number },
): LayoutMetrics["columnSystem"] {
  const STANDARD_COLS = [1, 2, 3, 4, 6, 8, 12] as const;
  const X_TOLERANCE = 8;

  const visible = nodes.filter((n) => n.visible && n.rect.width > 0);
  if (visible.length === 0) return null;

  // x 좌표 클러스터링 (왼쪽 edge 기준)
  const xValues = visible.map((n) => n.rect.x).toSorted((a, b) => a - b);
  const clusters: number[][] = [];

  for (const x of xValues) {
    let assigned = false;
    for (const cluster of clusters) {
      if (Math.abs(x - cluster[0]!) <= X_TOLERANCE) {
        cluster.push(x);
        assigned = true;
        break;
      }
    }
    if (!assigned) clusters.push([x]);
  }

  const clusterCount = clusters.length;

  // 가장 가까운 표준 컬럼 수 찾기
  let bestCols: number | null = null;
  let bestDist = Infinity;
  for (const standard of STANDARD_COLS) {
    const dist = Math.abs(clusterCount - standard);
    if (dist <= 1 && dist < bestDist) {
      bestDist = dist;
      bestCols = standard;
    }
  }

  if (bestCols === null) return null;

  // 클러스터 대표 x값 (각 클러스터의 첫 번째)
  const clusterXs = clusters
    .map((g) => Math.min(...g))
    .toSorted((a, b) => a - b);

  // gutterPx: 인접 클러스터 간격의 중앙값
  const gaps: number[] = [];
  for (let i = 1; i < clusterXs.length; i++) {
    gaps.push(clusterXs[i]! - clusterXs[i - 1]!);
  }
  const gutterPx = gaps.length > 0 ? median(gaps) : 0;

  // marginPx: 왼쪽 여백과 오른쪽 여백 중 최솟값
  const leftmost = Math.min(...visible.map((n) => n.rect.x));
  const rightmost = Math.max(...visible.map((n) => n.rect.x + n.rect.width));
  const marginPx = Math.min(leftmost, viewport.width - rightmost);

  // rowGapPx: adjacent-y 관계가 없으므로 노드 y 클러스터로 추정
  // (relations 없이 노드만으로는 null 반환)
  return {
    cols: bestCols,
    gutterPx,
    marginPx,
  };
}

/**
 * adjacent-x / adjacent-y 관계에서 실제 px 간격을 수집하고
 * 중복 제거·정렬한 값 목록과 GCD 기반 base 단위를 반환한다.
 */
export function measureSpacing(
  relations: readonly RLSCRelation[],
  nodes: readonly RLSCNode[],
): { values: number[]; base: number | null } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const rawGaps: number[] = [];

  for (const rel of relations) {
    const source = nodeMap.get(rel.source);
    const target = nodeMap.get(rel.target);
    if (!source || !target) continue;

    if (rel.type === "adjacent-x") {
      // target이 source 오른쪽에 있는 경우의 x 간격
      const gap =
        target.rect.x - (source.rect.x + source.rect.width);
      if (gap > 0) rawGaps.push(gap);
    } else if (rel.type === "adjacent-y") {
      // target이 source 아래에 있는 경우의 y 간격
      const gap =
        target.rect.y - (source.rect.y + source.rect.height);
      if (gap > 0) rawGaps.push(gap);
    }
  }

  // 중복 제거·오름차순 정렬
  const values = [...new Set(rawGaps)].toSorted((a, b) => a - b);

  if (values.length === 0) return { values, base: null };

  // GCD 계산 후 4 또는 8의 배수인지 확인
  const g = gcdAll(values);
  let base: number | null = null;
  if (g % 8 === 0) {
    base = 8;
  } else if (g % 4 === 0) {
    base = 4;
  }

  return { values, base };
}

/**
 * 가시 노드의 width/height 비율 분포를 count 내림차순으로 반환한다.
 */
export function measureAspectRatios(
  nodes: readonly RLSCNode[],
): readonly { ratio: number; count: number }[] {
  const visible = nodes.filter(
    (n) => n.visible && n.rect.width > 0 && n.rect.height > 0,
  );

  const countMap = new Map<number, number>();
  for (const node of visible) {
    const ratio = Math.round((node.rect.width / node.rect.height) * 100) / 100;
    countMap.set(ratio, (countMap.get(ratio) ?? 0) + 1);
  }

  return [...countMap.entries()]
    .map(([ratio, count]) => ({ ratio, count }))
    .toSorted((a, b) => b.count - a.count);
}

/**
 * RLSCDocument에서 모든 레이아웃 메트릭을 계산하여 단일 LayoutMetrics로 반환한다.
 */
export function measureLayout(doc: RLSCDocument, textOccupancies?: readonly TextOccupancy[]): LayoutMetrics {
  const allNodes = flattenTree(doc.root);

  const balance = measureBalance(allNodes, doc.viewport);
  const dominantFlow = detectDominantFlow(doc.relations);
  const gridPattern = detectGridPattern(doc.grid);
  const goldenRatioScore = scoreGoldenRatio(doc.viewport);
  const proximityGroups = detectProximityGroups(allNodes);
  const columnSystem = detectColumnSystem(allNodes, doc.viewport);
  const { values: spacingValues, base: spacingBase } = measureSpacing(
    doc.relations,
    allNodes,
  );
  const aspectRatioDistribution = measureAspectRatios(allNodes);

  // 텍스트 메트릭 (optional)
  let textDensity: number | undefined;
  let textBoundaryContactRate: number | undefined;
  let textOverflowCount: number | undefined;

  if (textOccupancies && textOccupancies.length > 0) {
    const viewportArea = doc.viewport.width * doc.viewport.height;
    let totalTextArea = 0;
    let contactNodeCount = 0;
    let overflowCount = 0;

    for (const occ of textOccupancies) {
      totalTextArea += occ.renderedRect.width * occ.renderedRect.height;
      if (occ.overflows) overflowCount++;
      const hasContact =
        occ.boundaryContact.top ||
        occ.boundaryContact.right ||
        occ.boundaryContact.bottom ||
        occ.boundaryContact.left;
      if (hasContact) contactNodeCount++;
    }

    textDensity = viewportArea > 0 ? totalTextArea / viewportArea : 0;
    textBoundaryContactRate = contactNodeCount / textOccupancies.length;
    textOverflowCount = overflowCount;
  }

  return {
    balance,
    dominantFlow,
    gridPattern,
    goldenRatioScore,
    proximityGroups,
    columnSystem,
    spacingValues,
    spacingBase,
    aspectRatioDistribution,
    textDensity,
    textBoundaryContactRate,
    textOverflowCount,
  };
}
