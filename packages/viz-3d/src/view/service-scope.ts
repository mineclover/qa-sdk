// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * ServiceScope — 서비스 중심 계층 뷰 + 축 필터링.
 *
 * 서비스가 최상위 컨테이너이고, 그 안에서
 * 이벤트가 발생 → 처리 → 소비 → 데이터 도달까지의
 * 수직 계층을 구성한다.
 *
 * 축 필터: env, region 등의 값으로 특정 범위를 숨기거나 강조.
 *
 * 개념:
 *   ServiceScope = 서비스별 매트릭스 컨테이너
 *   EventTier = 컨테이너 내 4단 계층
 *     T0: 이벤트 발생 (UI 접점: page_view, tracking)
 *     T1: 이벤트 처리 (API/흐름: endpoint, flow_point, permission)
 *     T2: 이벤트 소비/생산 (도메인 이벤트: *_event)
 *     T3: 데이터 도달 (스키마: table 컬럼)
 *   AxisFilter = 특정 축 값 숨기기/표시
 */

// ═══════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════

export type EventTier = 0 | 1 | 2 | 3;

export const TIER_NAMES: Record<EventTier, string> = {
  0: '이벤트 발생',
  1: '이벤트 처리',
  2: '이벤트 소비/생산',
  3: '데이터 도달',
};

export interface ServiceContainer {
  readonly serviceId: string;
  readonly serviceName: string;
  /** 이 서비스가 소유/소비하는 prefix를 tier별로 분류 */
  readonly tiers: Record<EventTier, ServiceTierEntry[]>;
  /** 이 서비스와 관련된 table 컬럼 */
  readonly dataEntries: DataEntry[];
}

export interface ServiceTierEntry {
  readonly prefixId: string;
  readonly tier: EventTier;
  readonly entries: readonly string[];
  readonly pattern: string;
  readonly category: string;
}

export interface DataEntry {
  readonly table: string;
  readonly column: string;
  readonly refKind: 'scalar' | 'axis_ref' | 'table_ref' | 'prefix_ref';
}

/** 축 필터 — 특정 축의 값을 숨기거나 표시 */
export interface AxisFilter {
  readonly axisId: string;
  readonly mode: 'show' | 'hide';
  readonly values: readonly string[];
}

export interface ServiceScopeConfig {
  /** 서비스 목록 */
  readonly services: readonly ServiceDef[];
  /** 활성 필터 */
  readonly filters: readonly AxisFilter[];
}

export interface ServiceDef {
  readonly id: string;
  readonly name: string;
  /** 이 서비스가 소유하는 prefix ID 목록 */
  readonly ownedPrefixes: readonly string[];
  /** 이 서비스가 소비하는 prefix ID 목록 */
  readonly consumedPrefixes: readonly string[];
  /** 이 서비스와 관련된 table 목록 */
  readonly tables: readonly string[];
}

// ═══════════════════════════════════════════════════
//  Tier 분류 규칙
// ═══════════════════════════════════════════════════

const TIER_RULES: Record<string, EventTier> = {
  // T0: 이벤트 발생 (UI 접점)
  page_view: 0,
  tracking: 0,
  // T1: 이벤트 처리 (API/흐름)
  endpoint: 1,
  flow_point: 1,
  permission: 1,
  // T2: 이벤트 소비/생산 (도메인 이벤트)
  cart_event: 2,
  auth_event: 2,
  order_event: 2,
  event: 2,
  deploy_event: 2,
  health_event: 2,
  engine_event: 2,
  schema_event: 2,
  // T1 (인프라 처리)
  pipeline_point: 1,
  data_policy: 1,
  // T1 (컨텍스트)
  service: 1,
};

function getTier(prefixId: string): EventTier {
  return TIER_RULES[prefixId] ?? 2;
}

// ═══════════════════════════════════════════════════
//  ServiceScope Builder
// ═══════════════════════════════════════════════════

export interface PrefixInfo {
  readonly id: string;
  readonly category: string;
  readonly entries: readonly string[];
  readonly pattern: string;
}

export function buildServiceContainers(
  services: readonly ServiceDef[],
  prefixInfos: ReadonlyMap<string, PrefixInfo>,
  tableColumns?: Record<string, readonly DataEntry[]>,
): ServiceContainer[] {
  return services.map((svc) => {
    const allPrefixes = [...new Set([...svc.ownedPrefixes, ...svc.consumedPrefixes])];
    const tiers: Record<EventTier, ServiceTierEntry[]> = { 0: [], 1: [], 2: [], 3: [] };

    for (const pid of allPrefixes) {
      const info = prefixInfos.get(pid);
      if (!info) continue;
      const tier = getTier(pid);
      tiers[tier].push({
        prefixId: pid,
        tier,
        entries: info.entries,
        pattern: info.pattern,
        category: info.category,
      });
    }

    // T3: 데이터 도달
    const dataEntries: DataEntry[] = [];
    if (tableColumns) {
      for (const table of svc.tables) {
        const cols = tableColumns[table];
        if (cols) dataEntries.push(...cols);
      }
    }

    return {
      serviceId: svc.id,
      serviceName: svc.name,
      tiers,
      dataEntries,
    };
  });
}

// ═══════════════════════════════════════════════════
//  축 필터 적용
// ═══════════════════════════════════════════════════

/**
 * entries에 필터를 적용하여 표시할 entry만 반환한다.
 *
 * @param entries 원본 entry 목록
 * @param axisId 이 entries가 속한 축 ID
 * @param filters 활성 필터 목록
 */
export function applyFilters(
  entries: readonly string[],
  axisId: string,
  filters: readonly AxisFilter[],
): string[] {
  const filter = filters.find((f) => f.axisId === axisId);
  if (!filter) return [...entries];

  if (filter.mode === 'show') {
    return entries.filter((e) => filter.values.includes(e));
  } else {
    return entries.filter((e) => !filter.values.includes(e));
  }
}

/**
 * ServiceContainer에 필터를 적용한다.
 */
export function filterContainer(
  container: ServiceContainer,
  filters: readonly AxisFilter[],
  axisEntries: ReadonlyMap<string, { axisId: string; entries: readonly string[] }>,
): ServiceContainer {
  const filteredTiers: Record<EventTier, ServiceTierEntry[]> = { 0: [], 1: [], 2: [], 3: [] };

  for (const tier of [0, 1, 2, 3] as EventTier[]) {
    for (const entry of container.tiers[tier]) {
      // 이 prefix의 주요 축에 대해 필터 적용
      const axisInfo = axisEntries.get(entry.prefixId);
      if (axisInfo) {
        const filtered = applyFilters(axisInfo.entries, axisInfo.axisId, filters);
        if (filtered.length === 0) continue; // 모든 entry가 필터됨 → 숨김
        filteredTiers[tier].push({ ...entry, entries: filtered });
      } else {
        filteredTiers[tier].push(entry);
      }
    }
  }

  return { ...container, tiers: filteredTiers };
}

// ═══════════════════════════════════════════════════
//  레이아웃 계산 — 서비스별 컨테이너 배치
// ═══════════════════════════════════════════════════

export interface ScopeLayout {
  readonly serviceId: string;
  /** 서비스 컨테이너의 월드 위치 */
  readonly position: { x: number; y: number; z: number };
  /** 컨테이너 크기 */
  readonly size: { width: number; height: number; depth: number };
  /** tier별 y 오프셋 */
  readonly tierOffsets: Record<EventTier, number>;
}

export function computeScopeLayouts(
  containers: readonly ServiceContainer[],
  options?: { containerGap?: number; tierGap?: number },
): ScopeLayout[] {
  const gap = options?.containerGap ?? 12;
  const tierGap = options?.tierGap ?? 3;

  return containers.map((c, i) => {
    const totalTiers =
      Object.values(c.tiers).filter((t) => t.length > 0).length +
      (c.dataEntries.length > 0 ? 1 : 0);
    const height = totalTiers * tierGap;
    const maxEntries = Math.max(
      1,
      ...Object.values(c.tiers).flatMap((t) => t.map((e) => e.entries.length)),
    );
    const width = Math.max(4, Math.ceil(Math.sqrt(maxEntries)) * 1.5);

    return {
      serviceId: c.serviceId,
      position: { x: i * gap - ((containers.length - 1) * gap) / 2, y: 0, z: 0 },
      size: { width, height, depth: width },
      tierOffsets: { 0: tierGap * 1.5, 1: tierGap * 0.5, 2: -tierGap * 0.5, 3: -tierGap * 1.5 },
    };
  });
}

// ═══════════════════════════════════════════════════
//  프리셋 서비스 정의 (DEMO_CATALOG용)
// ═══════════════════════════════════════════════════

export const DEMO_SERVICES: ServiceDef[] = [
  {
    id: 'shopping-web',
    name: '쇼핑 웹',
    ownedPrefixes: ['page_view', 'tracking'],
    consumedPrefixes: ['endpoint', 'flow_point', 'permission', 'service'],
    tables: ['members'],
  },
  {
    id: 'shopping-backend',
    name: '쇼핑 백엔드',
    ownedPrefixes: ['cart_event', 'order_event', 'permission', 'event'],
    consumedPrefixes: ['endpoint', 'service'],
    tables: ['orders', 'items', 'carts', 'cart_items'],
  },
  {
    id: 'auth',
    name: '인증',
    ownedPrefixes: ['auth_event'],
    consumedPrefixes: ['permission', 'endpoint', 'service'],
    tables: ['members'],
  },
  {
    id: 'payment',
    name: '결제',
    ownedPrefixes: [],
    consumedPrefixes: ['endpoint', 'flow_point', 'permission', 'order_event', 'service'],
    tables: ['orders'],
  },
  {
    id: 'infra',
    name: '인프라',
    ownedPrefixes: [
      'deploy_event',
      'health_event',
      'pipeline_point',
      'data_policy',
      'service',
      'endpoint',
    ],
    consumedPrefixes: [],
    tables: ['orgs'],
  },
];

/** env 축 필터 프리셋 */
export const ENV_FILTERS = {
  prodOnly: { axisId: 'env', mode: 'show' as const, values: ['prod'] },
  devOnly: { axisId: 'env', mode: 'show' as const, values: ['dev'] },
  hideTest: { axisId: 'env', mode: 'hide' as const, values: ['test', 'local'] },
  all: { axisId: 'env', mode: 'show' as const, values: ['dev', 'stage', 'prod', 'test', 'local'] },
};
