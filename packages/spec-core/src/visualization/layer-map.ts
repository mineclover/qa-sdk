/**
 * LayerMap — prefix를 3D 시각화 계층에 배치하는 매핑.
 *
 * 계층:
 *   Layer 0 (최상단): UI/사용자 인터페이스 — 유저 접점
 *   Layer 1 (중간):   비즈니스 로직 — API, 흐름, 권한, 이벤트
 *   Layer 2 (하단):   인프라/데이터 — 파이프라인, 배포, 헬스, 서비스
 *
 * 시각화에서 이벤트가 Layer 0 → 1 → 2로 내려가면
 * "유저 클릭 → API 호출 → DB 저장" 흐름이 된다.
 */

import type { DemoCatalog, PrefixDef } from "demo-snapshot";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export type LayerLevel = 0 | 1 | 2;

export interface PrefixPlacement {
  readonly prefixId: string;
  readonly name: string;
  readonly layer: LayerLevel;
  readonly layerName: string;
  readonly category: string;
  /** 3D 그리드 위치 (layer 내 x, z) */
  readonly gridX: number;
  readonly gridZ: number;
}

export interface LayerDefinition {
  readonly level: LayerLevel;
  readonly name: string;
  readonly description: string;
  readonly prefixes: readonly PrefixPlacement[];
}

export interface LayerMapResult {
  readonly layers: readonly LayerDefinition[];
  readonly allPlacements: readonly PrefixPlacement[];
  /** prefix ID → placement 빠른 조회 */
  readonly placementMap: ReadonlyMap<string, PrefixPlacement>;
}

// ═══════════════════════════════════════════════════════════════
//  Layer Classification
// ═══════════════════════════════════════════════════════════════

/**
 * Fallback layer rules for catalogs without prefix.meta.
 * When prefix.meta.layer is present, it takes precedence.
 */
const LAYER_RULES: Record<string, LayerLevel> = {
  // Layer 0: UI
  page_view: 0,
  tracking: 0,
  // Layer 1: Business
  endpoint: 1,
  flow_point: 1,
  permission: 1,
  rbac: 1,
  cart_event: 1,
  auth_event: 1,
  order_event: 1,
  event: 1,
  content: 1,
  relational: 1,
  engine_event: 1,
  // Layer 2: Infra
  service: 2,
  deploy_event: 2,
  health_event: 2,
  pipeline_point: 2,
  data_policy: 2,
  schema_event: 2,
};

const LAYER_NAMES: Record<LayerLevel, string> = {
  0: "UI / 사용자 인터페이스",
  1: "비즈니스 로직",
  2: "인프라 / 데이터",
};

const LAYER_DESCRIPTIONS: Record<LayerLevel, string> = {
  0: "유저 접점 — 화면 관측, 행동 추적. 이벤트의 시작점.",
  1: "비즈니스 로직 — API 호출, 흐름 분기, 권한 검사, 도메인 이벤트. 이벤트의 처리.",
  2: "인프라/데이터 — 파이프라인, 배포, 헬스, 서비스 컨텍스트. 이벤트의 저장/전파.",
};

/**
 * prefix의 구조에서 카테고리를 추론한다 (fallback 로직).
 * prefix.meta.category가 없을 때 사용.
 */
function inferCategoryFromStructure(prefixId: string, prefix: PrefixDef): string {
  const hasTableRef = Object.values(prefix.dims).some(d => d.kind === "table_ref");
  if (hasTableRef || prefixId.endsWith("_event")) return "event";
  if (prefixId === "relational") return "relation";
  if (["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy"].includes(prefixId)) return "observation";
  if (["permission", "rbac"].includes(prefixId)) return "policy";
  return "entity";
}

/**
 * DEMO_CATALOG의 모든 prefix를 3D 계층에 배치한다.
 *
 * 우선순위: prefix.meta.layer/category → LAYER_RULES/inferCategoryFromStructure
 */
export function buildLayerMap(catalog: DemoCatalog): LayerMapResult {
  const placementMap = new Map<string, PrefixPlacement>();
  const layerBuckets: Map<LayerLevel, PrefixPlacement[]> = new Map([
    [0, []], [1, []], [2, []],
  ]);

  let index = 0;
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const layer: LayerLevel = (prefix.meta?.layer ?? LAYER_RULES[prefixId] ?? 1) as LayerLevel;
    const bucket = layerBuckets.get(layer)!;
    const gridX = bucket.length % 4;
    const gridZ = Math.floor(bucket.length / 4);

    const category = prefix.meta?.category ?? inferCategoryFromStructure(prefixId, prefix);

    const placement: PrefixPlacement = {
      prefixId,
      name: prefix.name,
      layer,
      layerName: LAYER_NAMES[layer],
      category,
      gridX,
      gridZ,
    };

    bucket.push(placement);
    placementMap.set(prefixId, placement);
    index++;
  }

  const layers: LayerDefinition[] = [0, 1, 2].map(level => ({
    level: level as LayerLevel,
    name: LAYER_NAMES[level as LayerLevel],
    description: LAYER_DESCRIPTIONS[level as LayerLevel],
    prefixes: layerBuckets.get(level as LayerLevel)!,
  }));

  return {
    layers,
    allPlacements: [...placementMap.values()],
    placementMap,
  };
}

// ═══════════════════════════════════════════════════════════════
//  이벤트 경로 추적 — trace_id로 prefix 활성화 순서 추출
// ═══════════════════════════════════════════════════════════════

export interface TraceStep {
  readonly timestamp: string;
  readonly prefixId: string;
  readonly layer: LayerLevel;
  readonly serialized: string;
}

export interface TracePath {
  readonly traceId: string;
  readonly steps: readonly TraceStep[];
  /** 최상위 layer → 최하위 layer 이동 경로 */
  readonly layerPath: readonly LayerLevel[];
  readonly duration: number;
}

/**
 * 레코드 목록에서 trace별 prefix 활성화 경로를 추출한다.
 */
export function extractTracePaths(
  records: readonly { traceId: string; timestamp: string; addressContext: Record<string, string> }[],
  layerMap: LayerMapResult,
): TracePath[] {
  const traceGroups = new Map<string, TraceStep[]>();

  for (const r of records) {
    for (const [prefixId, serialized] of Object.entries(r.addressContext)) {
      const placement = layerMap.placementMap.get(prefixId);
      if (!placement) continue;

      const steps = traceGroups.get(r.traceId) ?? [];
      steps.push({
        timestamp: r.timestamp,
        prefixId,
        layer: placement.layer,
        serialized,
      });
      traceGroups.set(r.traceId, steps);
    }
  }

  const paths: TracePath[] = [];
  for (const [traceId, steps] of traceGroups) {
    const sorted = steps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const layerPath = sorted.map(s => s.layer);
    const t0 = new Date(sorted[0].timestamp).getTime();
    const t1 = new Date(sorted[sorted.length - 1].timestamp).getTime();

    paths.push({
      traceId,
      steps: sorted,
      layerPath,
      duration: t1 - t0,
    });
  }

  return paths;
}

// ═══════════════════════════════════════════════════════════════
//  실시간 활성 상태 — 시간 윈도우 내 prefix별 이벤트 수
// ═══════════════════════════════════════════════════════════════

export interface PrefixActivity {
  readonly prefixId: string;
  readonly layer: LayerLevel;
  readonly count: number;
  readonly lastSeen: string;
  /** 활성 강도 (0~1, 정규화) */
  readonly intensity: number;
}

/**
 * 최근 N초 이내의 prefix별 활성 상태를 계산한다.
 * 3D 뷰에서 박스 반짝거림 강도로 사용.
 */
export function computeActivity(
  recentRecords: readonly { timestamp: string; addressContext: Record<string, string> }[],
  layerMap: LayerMapResult,
): PrefixActivity[] {
  const countMap = new Map<string, { count: number; lastSeen: string }>();

  for (const r of recentRecords) {
    for (const prefixId of Object.keys(r.addressContext)) {
      const existing = countMap.get(prefixId);
      if (existing) {
        existing.count++;
        if (r.timestamp > existing.lastSeen) existing.lastSeen = r.timestamp;
      } else {
        countMap.set(prefixId, { count: 1, lastSeen: r.timestamp });
      }
    }
  }

  const maxCount = Math.max(1, ...[...countMap.values()].map(v => v.count));

  const activities: PrefixActivity[] = [];
  for (const [prefixId, { count, lastSeen }] of countMap) {
    const placement = layerMap.placementMap.get(prefixId);
    activities.push({
      prefixId,
      layer: placement?.layer ?? 1,
      count,
      lastSeen,
      intensity: count / maxCount,
    });
  }

  return activities.sort((a, b) => b.count - a.count);
}
