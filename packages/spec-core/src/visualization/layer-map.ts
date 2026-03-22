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
//  Projection — "보는 관점"별 prefix 재배치
// ═══════════════════════════════════════════════════════════════

/**
 * Projection = catalog의 raw 구조와 독립적인 "관점별 배치 규칙".
 *
 * 같은 catalog에서 여러 projection을 만들 수 있다:
 *   - service projection: svc_name → layer 매핑
 *   - domain projection: domain → layer 매핑
 *   - prefix projection: prefixId → layer 직접 매핑 (LAYER_RULES 대체)
 */
export interface Projection {
  /** projection 이름 */
  readonly name: string;
  /** 관점별 layer 이름 (최대 4계층) */
  readonly layerNames?: Partial<Record<LayerLevel, string>>;
  /** 관점별 layer 설명 */
  readonly layerDescriptions?: Partial<Record<LayerLevel, string>>;
  /** svc_name entry → layer 매핑. prefix가 바인딩된 service의 svc_name으로 layer 결정. */
  readonly svcNameMap?: Record<string, LayerLevel>;
  /** domain → layer 매핑. DkgConfig.domains의 prefix 소속으로 layer 결정. */
  readonly domainMap?: Record<string, LayerLevel>;
  /** prefixId → layer 직접 매핑. 최우선. */
  readonly prefixMap?: Record<string, LayerLevel>;
  /** 기본 layer (매핑에 없을 때). default: 1 */
  readonly defaultLayer?: LayerLevel;
}

// ── 기본 Projection 정의 ─────────────────────────────────

/** 서비스 기반 projection — svc_name으로 layer 결정 */
export const SERVICE_PROJECTION: Projection = {
  name: "service",
  layerNames: {
    0: "Frontend",
    1: "Backend",
    2: "Infrastructure",
    3: "System / DKG",
  },
  layerDescriptions: {
    0: "유저 접점 — 화면 관측, 행동 추적",
    1: "비즈니스 로직 — API, 흐름, 권한, 도메인 이벤트",
    2: "인프라 — 배포, 헬스, 파이프라인, 서비스 컨텍스트",
    3: "시스템 — DKG 자기참조, CLI, 빌드/테스트",
  },
  svcNameMap: {
    "shopping-web": 0,
    "shopping-backend": 1,
    "auth": 1,
    "payment": 1,
    "gateway": 1,
  },
  // svc_ref 없는 prefix 중 dev/dkg 관련
  prefixMap: {
    dkg_event: 3,
    dkg_decision_event: 3,
    dkg_observation_event: 3,
    cli_event: 3,
    skill_execution: 3,
    contract_check: 3,
    build_event: 3,
    test_event: 3,
  },
  defaultLayer: 1,
};

/** 레거시 하드코딩 호환 projection */
export const LEGACY_PROJECTION: Projection = {
  name: "legacy",
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
 * prefix가 바인딩된 service의 svc_name entry를 추출한다.
 * prefix에 svc_ref (prefix_ref → service)가 있으면,
 * 해당 prefix의 refEntries에서 첫 번째 service 주소를 역으로 decode.
 *
 * 간단 버전: ServiceTopology의 ownedPrefixes로 매핑 (catalog 만으로는 owner를 알 수 없으므로).
 */
function resolveSvcNameForPrefix(
  _catalog: Catalog,
  prefixId: string,
  svcOwners?: ReadonlyMap<string, string>,
): string | undefined {
  return svcOwners?.get(prefixId);
}

/**
 * prefix를 계층에 배치한다.
 *
 * projection 우선순위:
 *   1. projection.prefixMap (직접 매핑)
 *   2. projection.svcNameMap (svc_name 기반 — svcOwners 필요)
 *   3. projection.domainMap (domain 기반 — domainMembers 필요)
 *   4. meta.layer (catalog 하드코딩)
 *   5. projection.defaultLayer (기본값)
 */
export function buildLayerMap(
  catalog: Catalog,
  projection?: Projection,
  svcOwners?: ReadonlyMap<string, string>,
  domainMembers?: ReadonlyMap<string, string>,
): LayerMapResult {
  const proj = projection ?? LEGACY_PROJECTION;
  const layerNames = { ...DEFAULT_LAYER_NAMES, ...proj.layerNames };
  const layerDescs = { ...DEFAULT_LAYER_DESCRIPTIONS, ...proj.layerDescriptions };

  const placementMap = new Map<string, PrefixPlacement>();
  const layerBuckets = new Map<LayerLevel, PrefixPlacement[]>([
    [0, []], [1, []], [2, []], [3, []],
  ]);

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    let layer: LayerLevel | undefined;

    // 1. prefixMap 직접 매핑
    if (proj.prefixMap && prefixId in proj.prefixMap) {
      layer = proj.prefixMap[prefixId];
    }

    // 2. svcNameMap — service owner의 svc_name으로 매핑
    if (layer === undefined && proj.svcNameMap && svcOwners) {
      const ownerSvcName = resolveSvcNameForPrefix(catalog, prefixId, svcOwners);
      if (ownerSvcName && ownerSvcName in proj.svcNameMap) {
        layer = proj.svcNameMap[ownerSvcName];
      }
    }

    // 3. domainMap — domain 소속으로 매핑
    if (layer === undefined && proj.domainMap && domainMembers) {
      const domain = domainMembers.get(prefixId);
      if (domain && domain in proj.domainMap) {
        layer = proj.domainMap[domain];
      }
    }

    // 4. meta.layer (catalog 하드코딩)
    if (layer === undefined && prefix.meta?.layer !== undefined) {
      layer = prefix.meta.layer as LayerLevel;
    }

    // 5. default
    if (layer === undefined) {
      layer = proj.defaultLayer ?? 1;
    }

    const bucket = layerBuckets.get(layer)!;
    const category = prefix.meta?.category ?? inferCategoryFromStructure(prefixId, prefix);
    const ownerSvc = svcOwners?.get(prefixId);
    const domain = domainMembers?.get(prefixId);

    const placement: PrefixPlacement = {
      prefixId,
      name: prefix.name,
      layer,
      layerName: layerNames[layer] ?? `Layer ${layer}`,
      category,
      group: ownerSvc ?? domain,
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
