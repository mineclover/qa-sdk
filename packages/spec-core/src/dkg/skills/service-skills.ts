/**
 * 서비스 종속 skill — prod API를 호출하여 시스템 상태를 관측.
 *
 * - serviceHealthCheck: /api/health/services → 서비스 다운 감지
 * - eventCoverageCheck: /v1/insights/prefixes → prefix 커버리지 분석
 *
 * 두 skill 모두 observation을 자동 생성하여 DKG에 기록.
 */

import type { GraphPort } from "../../shared/graph-port.js";

export interface ServiceHealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  up: number;
  down: number;
  total: number;
  downServices: string[];
  observations: Array<{ id: string; finding: string; intent: string }>;
}

export interface EventCoverageResult {
  definedPrefixes: number;
  observedPrefixes: number;
  coveragePercent: number;
  unobserved: string[];
  observations: Array<{ id: string; finding: string; intent: string }>;
}

/**
 * 서비스 헬스체크 skill.
 * registryUrl + /api/health/services 호출 → 결과 분석.
 */
export async function serviceHealthCheck(
  registryUrl: string,
  env: string = "dev",
): Promise<ServiceHealthResult> {
  const resp = await fetch(`${registryUrl}/api/health/services?env=${env}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`Health API failed: HTTP ${resp.status}`);

  const data = await resp.json() as {
    status: string;
    up: number;
    down: number;
    total: number;
    services: Array<{ serviceId: string; status: string; error?: string }>;
  };

  const downServices = data.services
    .filter(s => s.status === "down")
    .map(s => s.serviceId);

  const observations = downServices.map(svcId => ({
    id: `OBS-SVC-DOWN-${svcId}`,
    finding: `서비스 ${svcId}가 다운 상태: ${data.services.find(s => s.serviceId === svcId)?.error ?? "unknown"}`,
    intent: "action-needed",
  }));

  return {
    status: data.status as ServiceHealthResult["status"],
    up: data.up,
    down: data.down,
    total: data.total,
    downServices,
    observations,
  };
}

/**
 * 이벤트 커버리지 skill.
 * ingestUrl + /v1/insights/prefixes 호출 → DKG prefix 정의와 비교.
 */
export async function eventCoverageCheck(
  ingestUrl: string,
  graph: GraphPort,
): Promise<EventCoverageResult> {
  // 정의된 prefix 목록
  const definedPrefixes = graph.getNodesByKind("prefix").map(n => n.id);

  // 수집된 prefix
  const resp = await fetch(`${ingestUrl}/v1/insights/prefixes`, {
    signal: AbortSignal.timeout(10_000),
  });
  const observedSet = new Set<string>();
  if (resp.ok) {
    const data = await resp.json() as Array<{ prefix: string; count: number }>;
    data.forEach(p => observedSet.add(p.prefix));
  }

  const unobserved = definedPrefixes.filter(p => !observedSet.has(p));
  const coveragePercent = definedPrefixes.length > 0
    ? Math.round((observedSet.size / definedPrefixes.length) * 100)
    : 0;

  // 커버리지가 낮은 경우 observation 생성
  const observations: EventCoverageResult["observations"] = [];
  if (coveragePercent < 20 && definedPrefixes.length > 10) {
    observations.push({
      id: "OBS-PREFIX-COVERAGE-LOW",
      finding: `prefix 커버리지 ${coveragePercent}% (${observedSet.size}/${definedPrefixes.length}). 대부분의 prefix에서 이벤트가 수집되지 않음.`,
      intent: "monitoring",
    });
  }

  // 핵심 prefix가 미관측이면 개별 observation
  const criticalPrefixes = ["service", "page_view", "tracking", "auth_event", "order_event"];
  for (const p of criticalPrefixes) {
    if (definedPrefixes.includes(p) && !observedSet.has(p)) {
      observations.push({
        id: `OBS-PREFIX-IDLE-${p}`,
        finding: `핵심 prefix '${p}'에서 이벤트가 수집되지 않음`,
        intent: "action-needed",
      });
    }
  }

  return {
    definedPrefixes: definedPrefixes.length,
    observedPrefixes: observedSet.size,
    coveragePercent,
    unobserved,
    observations,
  };
}
