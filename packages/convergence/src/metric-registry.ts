// @def.boundary convergence-layer-group
/**
 * Metric Registry — 자동 측정 가능한 metric 정의 + 임계값 기반 Observation 생성.
 *
 * @layer 측정 (Measurement)
 */

import type { MetricDef, MetricValue, MetricStatus } from "./metric.types.js";
import type { GraphPort, GraphNodeLike } from "spec-schema";
import type { ObservationNode } from "./dkg-types.js";
import type { UsageData } from "./convergence.types.js";
import type { Catalog } from "@qa-sdk/core";
import { analyzeHeadroom } from "./headroom-advisor.js";
import { analyzeDeploymentSkew } from "./deployment-skew.js";
import { analyzeEntryCoverage } from "./entry-coverage.js";
import { scanAxisOverlaps } from "./symbol-comparator.js";
import { scanDecisionConflicts } from "./decision-comparator.js";

/** axis version snapshot의 최소 형태 (convergence가 catalog.types에 직접 의존하지 않으므로 복제) */
interface AxisVersionSnapshotLike {
  readonly entries?: readonly string[];
  readonly capacity?: number;
}

/** 스키마 건전성 감사 결과 (schema-health-audit에서 주입) */
export interface SchemaHealthReportLike {
  readonly totalPrefixes: number;
  readonly passed: number;
  readonly failed: number;
  readonly violations: readonly { readonly prefixId: string }[];
}

/** 스키마 건전성 감사 함수 시그니처 (schema-health-audit에서 주입) */
export type SchemaHealthAuditor = (
  graph: GraphPort,
  options?: { date?: string },
) => SchemaHealthReportLike;

// ═══════════════════════════════════════════════════════════════
//  표준 Metric 정의
// ═══════════════════════════════════════════════════════════════

export const METRIC_DEFS: readonly MetricDef[] = [
  {
    id: "metric:headroom",
    name: "축 여유 공간",
    description: "축의 capacity - entries. 0이면 다음 추가 시 stride-break.",
    category: "headroom",
    autoRunnable: true,
    threshold: { warning: 1, critical: 0, above: false },
    measureFn: "analyzeHeadroom",
  },
  {
    id: "metric:skew",
    name: "배포 버전 스큐",
    description: "같은 prefix의 다른 version이 동시에 사용 중인 수.",
    category: "skew",
    autoRunnable: true,
    threshold: { warning: 3, critical: 5 },
    measureFn: "analyzeDeploymentSkew",
  },
  {
    id: "metric:coverage",
    name: "entry 관측 커버리지",
    description: "정의된 entry 중 실제 관측된 비율.",
    category: "coverage",
    autoRunnable: true,
    threshold: { warning: 50, critical: 20, above: false },
    measureFn: "analyzeEntryCoverage",
  },
  {
    id: "metric:overlap",
    name: "축 중복",
    description: "두 축 간 entry 중복 비율.",
    category: "overlap",
    autoRunnable: true,
    threshold: { warning: 80, critical: 95 },
    measureFn: "scanAxisOverlaps",
  },
  {
    id: "metric:conflict:decisions",
    name: "결정 충돌",
    description: "동일 대상에 대한 상충되는 Decision 수.",
    category: "conflict",
    autoRunnable: true,
    threshold: { warning: 1, critical: 3 },
    measureFn: "scanDecisionConflicts",
  },
  {
    id: "metric:health",
    name: "도메인 건강",
    description: "도메인별 이슈 수 (constraint 위반 + boundary 이상).",
    category: "health",
    autoRunnable: true,
    threshold: { warning: 1, critical: 5 },
    measureFn: "collectMetrics (inline — convergence→dkg/skills 의존 금지)",
  },
  {
    id: "metric:schema:violations",
    name: "스키마 카테고리 위반",
    description: "prefix의 카테고리 규칙 위반 수. 0이면 전체 적합.",
    category: "health",
    autoRunnable: true,
    threshold: { warning: 1, critical: 5 },
    measureFn: "auditSchemaHealth",
  },
  // ── Transition Metric (Phase 2.5) ────────────────────
  {
    id: "metric:transition:coverage",
    name: "전이 커버리지",
    description: "정의된 transition spec 중 실제 매칭된 비율.",
    category: "transition",
    autoRunnable: false,
    threshold: { warning: 50, critical: 20, above: false },
    measureFn: "TransitionFlushResult.coverageRate",
  },
  {
    id: "metric:transition:violation-rate",
    name: "전이 위반율",
    description: "input 조건 실패 비율. 0.05 이하면 정상.",
    category: "transition",
    autoRunnable: false,
    threshold: { warning: 20, critical: 50 },
    measureFn: "TransitionFlushResult.violationRate",
  },
  {
    id: "metric:transition:orphan-sequences",
    name: "미매칭 시퀀스",
    description: "transition spec 없이 반복되는 좌표 패턴이 있는 세션 수.",
    category: "transition",
    autoRunnable: false,
    threshold: { warning: 10, critical: 50 },
    measureFn: "TransitionFlushResult.orphanSequences",
  },
];

// ═══════════════════════════════════════════════════════════════
//  Metric 실행
// ═══════════════════════════════════════════════════════════════

function evaluateStatus(
  value: number,
  threshold: MetricDef["threshold"],
): MetricStatus {
  const above = threshold.above !== false; // default: true (higher = worse)
  if (above) {
    if (value >= threshold.critical) return "critical";
    if (value >= threshold.warning) return "warning";
    return "ok";
  } else {
    if (value <= threshold.critical) return "critical";
    if (value <= threshold.warning) return "warning";
    return "ok";
  }
}

/**
 * 전체 자동 metric을 수집하여 값 + 상태를 반환한다.
 *
 * @param options.schemaHealthAuditor - 스키마 건전성 감사 함수. 미제공 시 schema violations metric 생략.
 */
export function collectMetrics(
  catalog: Catalog,
  graph: GraphPort,
  usage: UsageData | null,
  options?: { schemaHealthAuditor?: SchemaHealthAuditor },
): MetricValue[] {
  const now = new Date().toISOString().slice(0, 10);
  const results: MetricValue[] = [];

  // ── headroom ──
  // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
  const headroomDef = METRIC_DEFS.find(m => m.id === "metric:headroom")!;
  const axisData = Object.entries(catalog.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    const entries = "entries" in latest ? (latest as AxisVersionSnapshotLike).entries?.length ?? 0 : 0;
    const capacity = "capacity" in latest ? (latest as AxisVersionSnapshotLike).capacity ?? entries : entries;
    return { id, name: axis.name, entries, capacity };
  });
  const headroomReport = analyzeHeadroom(axisData, { graph });
  for (const issue of headroomReport.issues) {
    results.push({
      id: `metric:headroom:${issue.axisId}`,
      name: headroomDef.name,
      value: issue.headroom,
      status: evaluateStatus(issue.headroom, headroomDef.threshold),
      detail: `${issue.axisId}: headroom=${issue.headroom} (${issue.entries}/${issue.capacity})`,
      target: issue.axisId,
      measuredAt: now,
    });
  }
  // headroom report에 포함되지 않은 축 중 threshold 이하인 것만 추가 보고
  for (const axis of axisData) {
    if (results.some(r => r.id === `metric:headroom:${axis.id}`)) continue;
    const headroom = axis.capacity - axis.entries;
    const status = evaluateStatus(headroom, headroomDef.threshold);
    if (status === "ok") continue; // 건강한 축은 대시보드에서 생략
    results.push({
      id: `metric:headroom:${axis.id}`,
      name: headroomDef.name,
      value: headroom,
      status,
      detail: `${axis.id}: headroom=${headroom} (${axis.entries}/${axis.capacity})`,
      target: axis.id,
      measuredAt: now,
    });
  }

  // ── skew ── (only if usage data available)
  if (usage && usage.versionUsages.length > 0) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
    const skewDef = METRIC_DEFS.find(m => m.id === "metric:skew")!;
    const skews = analyzeDeploymentSkew(usage.versionUsages);
    for (const s of skews) {
      results.push({
        id: `metric:skew:${s.prefix}`,
        name: skewDef.name,
        value: s.activeVersions.length,
        status: s.severity,
        detail: s.summary,
        target: s.prefix,
        measuredAt: now,
      });
    }
  }

  // ── coverage ── (only if usage data available)
  if (usage && usage.entryUsages.length > 0) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
    const covDef = METRIC_DEFS.find(m => m.id === "metric:coverage")!;
    const report = analyzeEntryCoverage(catalog, usage.entryUsages, usage.addressUsages);
    for (const p of report.prefixes) {
      const pct = Math.round(p.coverageRate * 100);
      results.push({
        id: `metric:coverage:${p.prefixId}`,
        name: covDef.name,
        value: pct,
        status: evaluateStatus(pct, covDef.threshold),
        detail: p.summary,
        target: p.prefixId,
        measuredAt: now,
      });
    }
  }

  // ── overlap ──
  // Decision(DEC-SEP-*)으로 수용된 overlap은 warning으로 다운그레이드.
  // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
  const overlapDef = METRIC_DEFS.find(m => m.id === "metric:overlap")!;
  const entriesMap = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    if (latest && "entries" in latest) {
      entriesMap.set(id, [...((latest as AxisVersionSnapshotLike).entries ?? [])]);
    }
  }
  const overlaps = scanAxisOverlaps(graph, entriesMap);
  for (const o of overlaps) {
    const pct = Math.round(o.overlapRatio * 100);
    let status = evaluateStatus(pct, overlapDef.threshold);

    // DEC-SEP-* Decision이 두 축을 justifies하고 있으면 → acknowledged
    if (status === "critical" || status === "warning") {
      // bootstrap에서 DEC-SEP ID 형식: DEC-SEP-{a}-{b} (정렬 없이 overlap 순서대로)
      // 두 가지 조합 모두 확인
      const candidates = [
        `DEC-SEP-${o.a}-${o.b}`,
        `DEC-SEP-${o.b}-${o.a}`,
      ];
      const sepDec = candidates
        .map(id => graph.getNode(id) as GraphNodeLike & Record<string, unknown> | undefined)
        .find(d => d && d.kind === "decision" && d.lifecycle === "active");
      if (sepDec) {
        status = "ok"; // Decision으로 수용됨
      }
    }

    results.push({
      id: `metric:overlap:${o.a}:${o.b}`,
      name: overlapDef.name,
      value: pct,
      status,
      detail: `${o.a}↔${o.b}: ${pct}% (${o.recommendation}${status === "ok" && pct >= 80 ? ", DEC-SEP 수용" : ""})`,
      target: `${o.a}:${o.b}`,
      measuredAt: now,
    });
  }

  // ── conflict ──
  // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
  const conflictDef = METRIC_DEFS.find(m => m.id === "metric:conflict:decisions")!;
  const conflicts = scanDecisionConflicts(graph);
  results.push({
    id: "metric:conflict:decisions",
    name: conflictDef.name,
    value: conflicts.length,
    status: evaluateStatus(conflicts.length, conflictDef.threshold),
    detail: conflicts.length > 0 ? `${conflicts.length}건: ${conflicts.map(c => `${c.a}↔${c.b}`).join(", ")}` : "충돌 없음",
    measuredAt: now,
  });

  // ── health ──
  // NOTE: convergence → dkg/skills 의존 금지이므로 checkDomainHealth를 직접 호출하지 않는다.
  // 정밀한 도메인 건강 진단은 `dkg run skill-domain-health`를 사용할 것.
  //
  // Observation intent 판정 규칙:
  //   1. obs.intent가 명시되어 있으면 그대로 사용
  //   2. obs.resolution이 있으면 → 이미 해결됨, 건너뜀
  //   3. obs.source=metric → action-needed (자동 측정이 문제를 감지)
  //   4. obs.source=manual/review + suggestion 있음 → action-needed
  //   5. obs.source=manual/review + suggestion 없음 → monitoring (설계 메모)
  //   6. prompts 엣지로 active Decision에 연결된 observation → acknowledged, 건너뜀
  //
  // health metric은 action-needed만 issue로 집계한다.
  // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
  const healthDef = METRIC_DEFS.find(m => m.id === "metric:health")!;
  const domains = graph.getNodesByKind("domain") as Array<{ kind: string; id: string; name: string; prefixes: readonly string[] }>;
  for (const domain of domains) {
    const issues: string[] = [];
    const monitoring: string[] = [];
    for (const prefixId of domain.prefixes) {
      const obsEdges = graph.edgesTo(prefixId, "observes");
      for (const obsEdge of obsEdges) {
        const obs = graph.getNode(obsEdge.from) as (GraphNodeLike & Partial<ObservationNode>) | undefined;
        if (!obs || obs.kind !== "observation") continue;
        // 이미 해결됨
        if (obs.resolution) continue;
        // prompts 엣지로 active Decision에 연결됨 → acknowledged
        const prompted = graph.neighbors(obs.id, "prompts");
        const hasActiveDecision = prompted.some(decId => {
          const dec = graph.getNode(decId) as (GraphNodeLike & Record<string, unknown>) | undefined;
          return dec && dec.kind === "decision" && dec.lifecycle === "active";
        });
        if (hasActiveDecision) continue;

        // intent 판정
        const intent: string = obs.intent
          ?? (obs.source === "metric" ? "action-needed"
            : (obs.suggestion ? "action-needed" : "monitoring"));

        if (intent === "action-needed") {
          issues.push(`${prefixId}: ${obs.id}`);
        } else {
          monitoring.push(`${prefixId}: ${obs.id}`);
        }
      }
    }
    const detail = issues.length > 0
      ? `action=${issues.length}건: ${issues.slice(0, 2).join("; ")}${monitoring.length > 0 ? ` (+${monitoring.length} monitoring)` : ""}`
      : monitoring.length > 0
        ? `monitoring ${monitoring.length}건 (action 없음)`
        : "healthy";
    results.push({
      id: `metric:health:${domain.id}`,
      name: healthDef.name,
      value: issues.length,
      status: evaluateStatus(issues.length, healthDef.threshold),
      detail,
      target: domain.id,
      measuredAt: now,
    });
  }

  // ── schema violations ── (schemaHealthAuditor 주입 시에만 실행)
  const auditFn = options?.schemaHealthAuditor;
  if (auditFn) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- METRIC_DEFS에 정적으로 정의된 ID
    const schemaDef = METRIC_DEFS.find(m => m.id === "metric:schema:violations")!;
    const schemaReport = auditFn(graph, { date: now });
    results.push({
      id: "metric:schema:violations",
      name: schemaDef.name,
      value: schemaReport.failed,
      status: evaluateStatus(schemaReport.failed, schemaDef.threshold),
      detail: schemaReport.failed > 0
        ? `${schemaReport.failed}건 위반: ${schemaReport.violations.slice(0, 3).map(v => v.prefixId).join(", ")}`
        : `${schemaReport.totalPrefixes}개 prefix 전체 적합`,
      measuredAt: now,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
//  임계값 초과 → 자동 Observation 생성
// ═══════════════════════════════════════════════════════════════

/**
 * metric 결과에서 threshold 초과 항목을 자동 Observation으로 변환한다.
 *
 * ID는 결정적 (timestamp 없음) → 동일 metric 위반은 항상 같은 ID → upsert 시 덮어쓰기.
 */
export function metricsToObservations(
  metrics: readonly MetricValue[],
  options?: { date?: string },
): ObservationNode[] {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const observations: ObservationNode[] = [];

  for (const m of metrics) {
    if (m.status === "ok") continue;

    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-METRIC-${m.id.replace(/[:/]/g, "-")}`,
      date,
      source: "metric",
      subjects: m.target ? [m.target] : [],
      finding: `[${m.status}] ${m.name}: ${m.detail ?? `value=${m.value}`}`,
      suggestion: m.status === "critical"
        ? { kind: "add-constraint", rule: `${m.id} 임계값 초과 — 즉시 조치 필요` }
        : undefined,
    };
    observations.push(obs);
  }

  return observations;
}

/**
 * metric이 ok로 복귀한 경우, 이전에 생성된 observation을 자동 해소한다.
 *
 * 반환: resolution이 추가된 ObservationNode[] (store에 저장해야 함).
 */
export function resolveRecoveredMetrics(
  metrics: readonly MetricValue[],
  existingObservations: readonly ObservationNode[],
  options?: { date?: string },
): ObservationNode[] {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const resolved: ObservationNode[] = [];

  // ok로 복귀한 metric의 예상 observation ID 목록
  const okMetricObsIds = new Set<string>();
  for (const m of metrics) {
    if (m.status === "ok") {
      okMetricObsIds.add(`OBS-METRIC-${m.id.replace(/[:/]/g, "-")}`);
    }
  }

  // 기존 미해결 observation 중 ok 복귀 대상을 찾아 resolve
  for (const obs of existingObservations) {
    if (obs.kind !== "observation") continue;
    if (obs.resolution) continue; // 이미 해결됨
    if (!obs.id.startsWith("OBS-METRIC-")) continue; // metric observation만
    if (!okMetricObsIds.has(obs.id)) continue; // ok 복귀 대상만

    resolved.push({
      ...obs,
      date,
      resolution: {
        decisionId: "AUTO-RESOLVE",
        outcome: "accepted",
        note: `metric이 ok로 복귀하여 자동 해소 (${date})`,
      },
    } as ObservationNode);
  }

  return resolved;
}
