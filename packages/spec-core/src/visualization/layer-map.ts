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

import { type Catalog, type PrefixDef, compareTimestamps } from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export type LayerLevel = 0 | 1 | 2 | 3;

export interface PrefixPlacement {
  readonly prefixId: string;
  readonly name: string;
  readonly layer: LayerLevel;
  readonly layerName: string;
  readonly category: string;
  /** projection 소속 그룹 (service name, domain name 등) */
  readonly group?: string;
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
  /** 사용된 projection */
  readonly projection?: Projection;
}

// ═══════════════════════════════════════════════════════════════
//  Projection — 이벤트 좌표를 서비스 단위로 묶어 보는 뷰 프리셋
// ═══════════════════════════════════════════════════════════════

/**
 * Projection = "좌표 공간을 어떤 조건으로 잘라서 어떻게 배치할지" 선언.
 *
 * 전제: 모든 이벤트 prefix는 service에 바인딩된다.
 *   - svc_ref (prefix_ref → service) 축으로 직접 바인딩
 *   - 또는 svcOwners 매핑으로 간접 바인딩
 *   - infra_context.service에 항상 서비스 주소 포함
 *
 * Projection이 결정하는 것:
 *   1. 그룹핑: service prefix의 어떤 축(groupByAxis)으로 이벤트를 묶을지
 *   2. 배치: 그룹 값 → layer 매핑 (groupLayerMap)
 *   3. 필터: 어떤 축 값의 이벤트만 볼지 (axisFilters)
 *   4. 고정: service 바인딩 없는 prefix의 배치 (prefixMap)
 */
export interface Projection {
  /** projection 이름 */
  readonly name: string;
  /** projection 설명 */
  readonly description?: string;

  // ── 서비스 그룹핑 ──

  /** 그룹핑 기준이 되는 service prefix ID (default: "service") */
  readonly servicePrefix?: string;
  /** service prefix의 어떤 축으로 그룹핑할지 (default: "svc_name") */
  readonly groupByAxis?: string;
  /** 그룹 축 값 → layer 매핑 (핵심 배치 규칙) */
  readonly groupLayerMap: Record<string, LayerLevel>;

  // ── 축 필터 ──

  /** 축 필터 — 특정 축 값의 이벤트만 표시. 예: { env: ["prod"], region: ["asia"] } */
  readonly axisFilters?: Record<string, readonly string[]>;
  /** 포함할 prefix만 (미지정 시 전체) */
  readonly includePrefixes?: readonly string[];
  /** 제외할 prefix */
  readonly excludePrefixes?: readonly string[];

  // ── 고정 배치 ──

  /** service 바인딩 없는 prefix의 layer 직접 매핑 */
  readonly prefixMap?: Record<string, LayerLevel>;
  /** domain → layer 매핑 */
  readonly domainMap?: Record<string, LayerLevel>;

  // ── 표시 ──

  /** 관점별 layer 이름 */
  readonly layerNames?: Partial<Record<LayerLevel, string>>;
  /** 관점별 layer 설명 */
  readonly layerDescriptions?: Partial<Record<LayerLevel, string>>;
  /** 기본 layer (매핑에 없을 때). default: 1 */
  readonly defaultLayer?: LayerLevel;
}

// ── 기본 Projection 정의 ─────────────────────────────────

// ── 기본 프리셋 ──────────────────────────────────────────

/** 서비스 계층 projection — svc_name으로 이벤트 발생 위치 기준 배치 */
export const SERVICE_PROJECTION: Projection = {
  name: "service",
  description: "이벤트 발생 서비스 기준 배치. 같은 prefix도 서비스에 따라 다른 layer.",
  servicePrefix: "service",
  groupByAxis: "svc_name",
  groupLayerMap: {
    // Frontend
    "shopping-web": 0,
    "content-service": 0,
    "monitor": 0,
    // Backend
    "shopping-backend": 1,
    "auth": 1,
    "payment": 1,
    "gateway": 1,
    // Infrastructure
    "registry": 2,
    "ingest-server": 2,
    "infra-controller": 2,
  },
  prefixMap: {
    // svc 바인딩 없는 UI prefix
    tracking: 0,
    // svc 바인딩 없는 비즈니스
    content: 1, relational: 1, event: 1,
    execution_context: 1, event_classification: 1, metric_point: 1,
    // svc 바인딩 없는 인프라
    service: 2, version_point: 2, gate_point: 2,
    observation_event: 2, spec_event: 2, edge_activity: 2,
    // System / DKG
    dkg_event: 3, dkg_decision_event: 3, dkg_observation_event: 3,
    cli_event: 3, skill_execution: 3, contract_check: 3,
    build_event: 3, test_event: 3,
  },
  layerNames: { 0: "Frontend", 1: "Backend", 2: "Infrastructure", 3: "System / DKG" },
  layerDescriptions: {
    0: "유저 접점 — 프론트엔드 서비스에서 발생한 이벤트",
    1: "비즈니스 로직 — 백엔드 서비스에서 발생한 이벤트",
    2: "인프라 — 인프라 서비스에서 발생한 이벤트",
    3: "시스템 — DKG 자기참조, CLI, 빌드/테스트",
  },
  defaultLayer: 1,
};

/** prod + asia 환경만 보는 projection */
export const PROD_ASIA_PROJECTION: Projection = {
  ...SERVICE_PROJECTION,
  name: "prod-asia",
  description: "프로덕션 아시아 리전만 필터링",
  axisFilters: { env: ["prod"], region: ["asia"] },
};

/** dev 환경 전체를 보는 projection */
export const DEV_PROJECTION: Projection = {
  ...SERVICE_PROJECTION,
  name: "dev",
  description: "개발 환경만 필터링",
  axisFilters: { env: ["dev"] },
};

/** checkout 흐름만 보는 projection */
export const CHECKOUT_PROJECTION: Projection = {
  ...SERVICE_PROJECTION,
  name: "checkout",
  description: "결제 흐름 관련 prefix만 표시",
  includePrefixes: [
    "page_view", "endpoint", "flow_point", "permission",
    "cart_event", "order_event", "auth_event", "service",
  ],
};

/** 레거시 하드코딩 호환 projection */
export const LEGACY_PROJECTION: Projection = {
  name: "legacy",
  groupLayerMap: {},
  prefixMap: {
    page_view: 0, tracking: 0,
    endpoint: 1, flow_point: 1, permission: 1, rbac: 1,
    cart_event: 1, auth_event: 1, order_event: 1, event: 1,
    content: 1, relational: 1, engine_event: 1,
    service: 2, deploy_event: 2, health_event: 2,
    pipeline_point: 2, data_policy: 2, schema_event: 2,
  },
  defaultLayer: 1,
};

// ═══════════════════════════════════════════════════════════════
//  Layer Classification
// ═══════════════════════════════════════════════════════════════

const DEFAULT_LAYER_NAMES: Record<LayerLevel, string> = {
  0: "UI / 사용자 인터페이스",
  1: "비즈니스 로직",
  2: "인프라 / 데이터",
  3: "시스템",
};

const DEFAULT_LAYER_DESCRIPTIONS: Record<LayerLevel, string> = {
  0: "유저 접점 — 화면 관측, 행동 추적. 이벤트의 시작점.",
  1: "비즈니스 로직 — API 호출, 흐름 분기, 권한 검사, 도메인 이벤트.",
  2: "인프라/데이터 — 파이프라인, 배포, 헬스, 서비스 컨텍스트.",
  3: "시스템 — DKG 자기참조, CLI 관측, 빌드/테스트.",
};

function inferCategoryFromStructure(prefixId: string, prefix: PrefixDef): string {
  const hasTableRef = Object.values(prefix.dims).some(d => d.kind === "table_ref");
  if (hasTableRef || prefixId.endsWith("_event")) return "event";
  if (prefixId === "relational") return "relation";
  if (["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy"].includes(prefixId)) return "observation";
  if (["permission", "rbac"].includes(prefixId)) return "policy";
  return "entity";
}

/**
 * prefix를 projection 규칙에 따라 계층에 배치한다.
 *
 * 전제: 모든 이벤트 prefix는 service에 바인딩됨.
 *
 * 배치 우선순위:
 *   1. groupLayerMap — svcOwners에서 owner service → groupByAxis 값 → layer
 *   2. prefixMap — service 바인딩 없는 prefix 고정 매핑
 *   3. domainMap — domain 소속으로 매핑
 *   4. meta.layer — catalog 하드코딩 (fallback)
 *   5. defaultLayer
 *
 * 필터:
 *   - axisFilters: 축 값 필터 (표시 여부에만 영향, 배치에는 무영향)
 *   - includePrefixes/excludePrefixes: prefix 필터
 */
export function buildLayerMap(
  catalog: Catalog,
  projection?: Projection,
  svcOwners?: ReadonlyMap<string, string>,
  domainMembers?: ReadonlyMap<string, string>,
): LayerMapResult {
  const proj = projection ?? SERVICE_PROJECTION;
  const layerNames = { ...DEFAULT_LAYER_NAMES, ...proj.layerNames };
  const layerDescs = { ...DEFAULT_LAYER_DESCRIPTIONS, ...proj.layerDescriptions };

  // prefix 필터 셋 구성
  const includeSet = proj.includePrefixes ? new Set(proj.includePrefixes) : null;
  const excludeSet = proj.excludePrefixes ? new Set(proj.excludePrefixes) : null;

  const placementMap = new Map<string, PrefixPlacement>();
  const layerBuckets = new Map<LayerLevel, PrefixPlacement[]>([
    [0, []], [1, []], [2, []], [3, []],
  ]);

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    // prefix 필터
    if (includeSet && !includeSet.has(prefixId)) continue;
    if (excludeSet && excludeSet.has(prefixId)) continue;

    let layer: LayerLevel | undefined;
    let group: string | undefined;

    // 1. groupLayerMap — svcOwners에서 owner service → groupByAxis 값 → layer
    if (Object.keys(proj.groupLayerMap).length > 0 && svcOwners) {
      const ownerSvcName = svcOwners.get(prefixId);
      if (ownerSvcName && ownerSvcName in proj.groupLayerMap) {
        layer = proj.groupLayerMap[ownerSvcName];
        group = ownerSvcName;
      }
    }

    // 2. prefixMap — service 바인딩 없는 prefix 고정 매핑
    if (layer === undefined && proj.prefixMap && prefixId in proj.prefixMap) {
      layer = proj.prefixMap[prefixId];
    }

    // 3. domainMap
    if (layer === undefined && proj.domainMap && domainMembers) {
      const domain = domainMembers.get(prefixId);
      if (domain && domain in proj.domainMap) {
        layer = proj.domainMap[domain];
        group = group ?? domain;
      }
    }

    // 4. meta.layer
    if (layer === undefined && prefix.meta?.layer !== undefined) {
      layer = prefix.meta.layer as LayerLevel;
    }

    // 5. default
    if (layer === undefined) {
      layer = proj.defaultLayer ?? 1;
    }

    const bucket = layerBuckets.get(layer)!;
    const category = prefix.meta?.category ?? inferCategoryFromStructure(prefixId, prefix);

    const placement: PrefixPlacement = {
      prefixId,
      name: prefix.name,
      layer,
      layerName: layerNames[layer] ?? `Layer ${layer}`,
      category,
      group: group ?? domainMembers?.get(prefixId),
      gridX: bucket.length % 4,
      gridZ: Math.floor(bucket.length / 4),
    };

    bucket.push(placement);
    placementMap.set(prefixId, placement);
  }

  const usedLevels = [...layerBuckets.entries()]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([level]) => level)
    .sort();

  const layers: LayerDefinition[] = usedLevels.map(level => ({
    level,
    name: layerNames[level] ?? `Layer ${level}`,
    description: layerDescs[level] ?? "",
    prefixes: layerBuckets.get(level)!,
  }));

  return {
    layers,
    allPlacements: [...placementMap.values()],
    placementMap,
    projection: proj,
  };
}

/**
 * ServiceTopologyRegistry에서 prefix → owner svc_name 맵 구성.
 */
export function buildSvcOwnerMap(
  services: ReadonlyArray<{ serviceId: string; ownedPrefixes: readonly string[] }>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const svc of services) {
    for (const prefixId of svc.ownedPrefixes) {
      map.set(prefixId, svc.serviceId);
    }
  }
  return map;
}

/**
 * DkgConfig.domains에서 prefix → domain 맵 구성.
 */
export function buildDomainMemberMap(
  domains: ReadonlyArray<{ id: string; prefixes: readonly string[] }>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const domain of domains) {
    for (const prefixId of domain.prefixes) {
      map.set(prefixId, domain.id);
    }
  }
  return map;
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
    const sorted = steps.sort((a, b) => compareTimestamps(a.timestamp, b.timestamp));
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
        if (compareTimestamps(r.timestamp, existing.lastSeen) > 0) existing.lastSeen = r.timestamp;
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
