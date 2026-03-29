/**
 * autoTrack — event_key 하나로 prefix 인코딩까지 자동 처리.
 *
 * 개발자가 호출하는 최종 API:
 *   const qa = createAutoTracker({ catalog, serviceConfig, ... });
 *   qa.track("cart.add", { item_id: 7 });
 *
 * 내부 흐름:
 *   1. getMapping(eventKey) → prefix dims 매핑
 *   2. resolvePrefixDims(mapping, context) → 차원 값 해석
 *   3. svc_ref 자동 주입 (refEntries 기반)
 *   4. encodePrefixByValue → address_context
 *   5. emitFn 호출 (QaMonitor.emitWithCoords 또는 QaLogger.log)
 */

import { getMapping, resolvePrefixDims } from "./prefix-mapping.js";
import type { TrackingContextManager } from "./tracking-context.js";

// ── 카탈로그 최소 타입 (event-catalog는 외부 의존 없음) ──

/** prefix 차원 정의 최소 인터페이스 */
interface CatalogDimRef {
  kind: string;
  prefixId?: string;
}

/** prefix 버전 정의 최소 인터페이스 */
interface CatalogPrefixVersion {
  version: string;
  refEntries?: Record<string, { values: number[] }>;
}

/** prefix 정의 최소 인터페이스 */
interface CatalogPrefixDef {
  dims?: Record<string, CatalogDimRef>;
  versions?: CatalogPrefixVersion[];
}

/** AutoTracker가 사용하는 카탈로그 최소 인터페이스 */
export interface AutoTrackCatalog {
  prefixes?: Record<string, CatalogPrefixDef>;
  [key: string]: unknown;
}

// ── 타입 ──────────────────────────────────────────

export interface AutoTrackerConfig {
  /** DEMO_CATALOG 등 카탈로그 객체 */
  catalog: AutoTrackCatalog;
  /** TrackingContextManager 인스턴스 */
  context: TrackingContextManager;
  /** svc_ref 차원에 주입할 service 주소 값 (refEntries 기반 정수) */
  svcRefResolver?: (prefixId: string) => number | undefined;
  /** 인코딩 함수 */
  encodePrefixByValue: (catalog: AutoTrackCatalog, prefixId: string, version: string, dims: Record<string, unknown>) => number;
  /** 최신 버전 조회 함수 */
  latestPrefixVersion: (catalog: AutoTrackCatalog, prefixId: string) => string;
  /** 인코딩된 address_context를 받아 전송하는 함수 */
  emit: (eventKey: string, addressContext: Record<string, string>, payload: Record<string, unknown>) => void;
}

export interface AutoTracker {
  /** 이벤트 발생 — event_key + 선택적 payload만 넘기면 됨 */
  track(eventKey: string, payload?: Record<string, unknown>): void;
  /** 컨텍스트 매니저 접근 */
  context: TrackingContextManager;
}

// ── svc_ref 주입용 prefix_ref label 탐색 ──────────

function findSvcRefLabel(catalog: AutoTrackCatalog, prefixId: string): string | undefined {
  const dims = catalog.prefixes?.[prefixId]?.dims;
  if (!dims) return undefined;
  for (const [label, d] of Object.entries(dims)) {
    if (d.kind === "prefix_ref" && d.prefixId === "service") return label;
  }
  return undefined;
}

// ── 기본 svcRefResolver ──────────────────────────

/** catalog에서 각 prefix의 refEntries 첫 번째 값을 가져오는 기본 resolver */
export function createDefaultSvcRefResolver(catalog: AutoTrackCatalog): (prefixId: string) => number | undefined {
  return (prefixId: string) => {
    const p = catalog.prefixes?.[prefixId];
    if (!p) return undefined;
    const lastVer = p.versions?.[p.versions.length - 1];
    if (!lastVer?.refEntries) return undefined;
    // svc_ref, perm_svc, evt_svc, service_ctx 중 첫 번째 매칭
    for (const key of ["svc_ref", "perm_svc", "evt_svc", "service_ctx"]) {
      if (lastVer.refEntries[key]?.values?.[0] !== undefined) {
        return lastVer.refEntries[key].values[0];
      }
    }
    return undefined;
  };
}

// ── AutoTracker 생성 ──────────────────────────────

export function createAutoTracker(config: AutoTrackerConfig): AutoTracker {
  const { catalog, context, emit, encodePrefixByValue, latestPrefixVersion } = config;
  const svcRefResolver = config.svcRefResolver ?? createDefaultSvcRefResolver(catalog);

  return {
    context,
    track(eventKey: string, payload: Record<string, unknown> = {}) {
      const mapping = getMapping(eventKey);
      if (!mapping) {
        // 매핑 없는 이벤트 → address_context 없이 전송
        emit(eventKey, {}, payload);
        return;
      }

      const ctx = context.get();
      const prefixDims = resolvePrefixDims(mapping, ctx, payload);

      // svc_ref 주입 + 인코딩
      const addressContext: Record<string, string> = {};
      for (const [pid, dims] of Object.entries(prefixDims)) {
        try {
          const svcRefLabel = findSvcRefLabel(catalog, pid);
          if (svcRefLabel && dims[svcRefLabel] === undefined) {
            const svcVal = svcRefResolver(pid);
            if (svcVal !== undefined) (dims as Record<string, unknown>)[svcRefLabel] = svcVal;
          }
          const ver = latestPrefixVersion(catalog, pid);
          const addr = encodePrefixByValue(catalog, pid, ver, dims);
          addressContext[pid] = `${pid}:${ver}:${addr}`;
        } catch {
          // 인코딩 실패 → 해당 prefix 스킵 (다른 prefix는 계속)
        }
      }

      emit(eventKey, addressContext, payload);
    },
  };
}
