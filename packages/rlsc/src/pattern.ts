import type {
  LayoutMetrics,
  LayoutPattern,
  GridSystemPattern,
  SpacingPattern,
  ProportionPattern,
  GestaltPattern,
} from "./types.js";

// 알려진 비율 매핑 테이블
const NAMED_RATIOS: { value: number; name: ProportionPattern["namedRatio"] }[] = [
  { value: 1.0, name: "1:1" },
  { value: 1.33, name: "4:3" },
  { value: 1.618, name: "golden" },
  { value: 1.78, name: "16:9" },
  { value: 2.0, name: "2:1" },
  { value: 3.0, name: "3:1" },
];
const NAMED_RATIO_TOLERANCE = 0.05;

function matchNamedRatio(ratio: number): ProportionPattern["namedRatio"] | undefined {
  for (const entry of NAMED_RATIOS) {
    if (Math.abs(ratio - entry.value) <= NAMED_RATIO_TOLERANCE) {
      return entry.name;
    }
  }
  return undefined;
}

/**
 * LayoutMetrics 수치를 LayoutPattern 어휘로 변환 (bottom-up 인식 경로).
 * 분류 불가 필드는 결과에서 생략한다.
 */
type Draft = { -readonly [K in keyof LayoutPattern]?: LayoutPattern[K] };

export function classifyLayout(metrics: LayoutMetrics): LayoutPattern {
  const result: Draft = {};

  // ── 페이지 수준 ────────────────────────────────────────────────────

  // gridPattern
  if (metrics.gridPattern !== null) {
    const { cols, rows } = metrics.gridPattern;
    if (cols === 3 && rows === 3) {
      result.gridPattern = "3x3";
    } else if (cols === 1) {
      result.gridPattern = "1-col";
    } else if ((cols === 2 && rows === 1) || (cols === 1 && rows === 2)) {
      result.gridPattern = "2-col";
    } else {
      result.gridPattern = { cols, rows };
    }
  }

  // balanceRatio.x
  const bx = metrics.balance.x;
  if (Math.abs(bx - 1) > 0.2) {
    const a = Math.round(bx);
    result.balanceRatio = { x: [a, 1] };
  }

  // flowDirection
  switch (metrics.dominantFlow) {
    case "horizontal":
      result.flowDirection = "left-to-right";
      break;
    case "vertical":
      result.flowDirection = "top-to-bottom";
      break;
    case "grid":
      result.flowDirection = "grid";
      break;
    // "free" → 생략
  }

  // goldenRatio
  if (metrics.goldenRatioScore >= 0.8) {
    result.goldenRatio = true;
  }

  // ── 구조 단위 수준 ─────────────────────────────────────────────────

  // gridSystem
  if (metrics.columnSystem !== null) {
    const cs = metrics.columnSystem;
    const gridSystem: GridSystemPattern = {
      columns: cs.cols,
      gutter: cs.gutterPx,
      ...(cs.marginPx !== undefined ? { margin: cs.marginPx } : {}),
      ...(cs.rowGapPx !== undefined ? { rowGap: cs.rowGapPx } : {}),
    };
    result.gridSystem = gridSystem;
  }

  // spacing
  if (metrics.spacingValues.length > 0) {
    const base = metrics.spacingBase ?? undefined;
    const scale = [...metrics.spacingValues].sort((a, b) => a - b);
    let consistent = false;
    if (base !== undefined && base > 0) {
      consistent = scale.every((v) => v % base === 0);
    }
    const spacing: SpacingPattern = {
      ...(base !== undefined ? { base } : {}),
      scale,
      consistent,
    };
    result.spacing = spacing;
  }

  // gestalt — proximity: 그룹 간 평균 거리로 분류 (continuity는 LayoutMetrics에 flow 카운트 없음)
  if (metrics.proximityGroups.length >= 2) {
    const centroids = metrics.proximityGroups.map((g) => g.centroid);
    let totalGap = 0;
    let pairs = 0;
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        const dx = centroids[i]!.x - centroids[j]!.x;
        const dy = centroids[i]!.y - centroids[j]!.y;
        totalGap += Math.sqrt(dx * dx + dy * dy);
        pairs++;
      }
    }
    const avgGap = pairs > 0 ? totalGap / pairs : 0;
    const proximity: GestaltPattern["proximity"] =
      avgGap <= 16 ? "tight" : avgGap <= 64 ? "loose" : undefined;
    if (proximity) result.gestalt = { proximity };
  }

  // proportions
  if (metrics.aspectRatioDistribution.length > 0) {
    const distribution = [...metrics.aspectRatioDistribution].slice(0, 3);
    const dominant = distribution[0].ratio;
    const namedRatio = matchNamedRatio(dominant);
    const proportions: ProportionPattern = {
      dominant,
      ...(namedRatio !== undefined ? { namedRatio } : {}),
      distribution,
    };
    result.proportions = proportions;
  }

  return result as LayoutPattern;
}
