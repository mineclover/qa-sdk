/**
 * MonitorQueries — 3D 시각화 뷰어가 사용하는 쿼리 API.
 *
 * 모니터링 서버가 이 함수들을 HTTP/WebSocket 핸들러에서 호출한다.
 */

import type { Catalog } from "@qa-sdk/core";
import { buildLayerMap, computeActivity, extractTracePaths, type LayerMapResult, type PrefixActivity, type TracePath, type Projection } from "./layer-map.js";
import type { AddressContextRecord } from "@qa-sdk/convergence";

// ═══════════════════════════════════════════════════════════════
//  Monitor State
// ═══════════════════════════════════════════════════════════════

export class MonitorState {
  private readonly layerMap: LayerMapResult;
  private readonly recentWindow: AddressContextRecord[] = [];
  private readonly windowMs: number;

  constructor(
    private readonly catalog: Catalog,
    options?: {
      windowSeconds?: number;
      projection?: Projection;
      svcOwners?: ReadonlyMap<string, string>;
      domainMembers?: ReadonlyMap<string, string>;
    },
  ) {
    this.layerMap = buildLayerMap(catalog, options?.projection, options?.svcOwners, options?.domainMembers);
    this.windowMs = (options?.windowSeconds ?? 30) * 1000;
  }

  /** 새 레코드 수신 — 실시간 윈도우에 추가 */
  push(record: AddressContextRecord): void {
    this.recentWindow.push(record);
    this.pruneWindow();
  }

  /** 배치 수신 */
  pushBatch(records: readonly AddressContextRecord[]): void {
    this.recentWindow.push(...records);
    this.pruneWindow();
  }

  /** 만료된 레코드 정리 */
  private pruneWindow(): void {
    const cutoff = new Date(Date.now() - this.windowMs).toISOString();
    while (this.recentWindow.length > 0 && this.recentWindow[0].timestamp < cutoff) {
      this.recentWindow.shift();
    }
  }

  // ── 쿼리 API ──────────────────────────────────────────

  /** Q1: 계층 맵 — 3D 뷰 초기 렌더링용 */
  getLayerMap(): LayerMapResult {
    return this.layerMap;
  }

  /** Q2: 실시간 활성 상태 — 박스 반짝거림 강도 */
  getActivity(): PrefixActivity[] {
    this.pruneWindow();
    return computeActivity(
      this.recentWindow.map(r => ({ timestamp: r.timestamp, addressContext: r.address_context })),
      this.layerMap,
    );
  }

  /** Q3: 특정 trace의 경로 — 이벤트가 어떤 layer를 거쳤는가 */
  getTracePath(traceId: string): TracePath | undefined {
    const filtered = this.recentWindow
      .filter(r => r.trace_id === traceId)
      .map(r => ({ traceId: r.trace_id ?? traceId, timestamp: r.timestamp, addressContext: r.address_context }));

    const paths = extractTracePaths(filtered, this.layerMap);
    return paths[0];
  }

  /** Q4: 최근 N개 trace 경로 */
  getRecentPaths(limit: number = 10): TracePath[] {
    const traceIds = new Set<string>();
    for (let i = this.recentWindow.length - 1; i >= 0 && traceIds.size < limit; i--) {
      const tid = this.recentWindow[i].trace_id;
      if (tid) {
        traceIds.add(tid);
      }
    }

    const records = this.recentWindow
      .filter((r): r is typeof r & { trace_id: string } => r.trace_id != null && traceIds.has(r.trace_id))
      .map(r => ({ traceId: r.trace_id, timestamp: r.timestamp, addressContext: r.address_context }));

    return extractTracePaths(records, this.layerMap);
  }

  /** Q5: 계층별 활성 요약 */
  getLayerSummary(): { layer: number; name: string; activeCount: number; totalIntensity: number }[] {
    const activity = this.getActivity();
    return [0, 1, 2].map(level => {
      const layerActivity = activity.filter(a => a.layer === level);
      return {
        layer: level,
        name: this.layerMap.layers[level].name,
        activeCount: layerActivity.length,
        totalIntensity: layerActivity.reduce((s, a) => s + a.intensity, 0),
      };
    });
  }

  /** Q6: 윈도우 통계 */
  getStats(): { windowSize: number; recordCount: number; activePrefixes: number } {
    this.pruneWindow();
    const prefixes = new Set<string>();
    for (const r of this.recentWindow) {
      for (const p of Object.keys(r.address_context)) prefixes.add(p);
    }
    return {
      windowSize: this.windowMs / 1000,
      recordCount: this.recentWindow.length,
      activePrefixes: prefixes.size,
    };
  }
}

/**
 * registry에서 svcOwners를 자동 fetch하여 MonitorState 생성.
 *
 * 사용:
 *   const monitor = await createMonitorStateAsync(catalog, {
 *     registryUrl: "http://registry:3300",
 *   });
 */
export async function createMonitorStateAsync(
  catalog: Catalog,
  options?: {
    windowSeconds?: number;
    projection?: Projection;
    registryUrl?: string;
    svcOwners?: ReadonlyMap<string, string>;
    domainMembers?: ReadonlyMap<string, string>;
  },
): Promise<MonitorState> {
  let svcOwners = options?.svcOwners;

  // registry에서 svcOwners fetch
  if (!svcOwners && options?.registryUrl) {
    try {
      const res = await fetch(`${options.registryUrl}/api/services/svc-owners`);
      if (res.ok) {
        const data = await res.json() as Record<string, string>;
        svcOwners = new Map(Object.entries(data));
      }
    } catch { /* fetch 실패 시 prefixMap fallback */ }
  }

  return new MonitorState(catalog, {
    windowSeconds: options?.windowSeconds,
    projection: options?.projection,
    svcOwners,
    domainMembers: options?.domainMembers,
  });
}
