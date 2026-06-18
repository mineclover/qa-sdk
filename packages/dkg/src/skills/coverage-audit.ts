// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * coverage-audit — catalog entry 관측 커버리지 감사.
 *
 * dkg는 convergence 런타임에 정적 의존하지 않는다. 이 모듈은 store tier의
 * UsageData shape만 받아 CLI skill과 DKG observation 생성에 필요한 최소
 * coverage report를 로컬에서 계산한다.
 */

import type { Catalog } from "@qa-sdk/core";
import type { GraphPort } from "spec-schema";
import type { ObservationNode, DecisionNode } from "../dkg.types.js";
import type { AddressUsage, EntryUsage } from "../store/usage-types.js";

export type CoverageEntryStatus = "observed" | "dormant" | "phantom";

export interface CoverageEntryReport {
  readonly prefixId: string;
  readonly axisId: string;
  readonly entry: string;
  readonly count: number;
  readonly status: CoverageEntryStatus;
}

export interface CoverageDimReport {
  readonly total: number;
  readonly observed: number;
  readonly dormant: number;
  readonly phantom: number;
  readonly entries: readonly CoverageEntryReport[];
}

export interface PrefixCoverageReport {
  readonly prefixId: string;
  readonly coverageRate: number;
  readonly observedEntries: number;
  readonly totalEntries: number;
  readonly dims: Record<string, CoverageDimReport>;
}

export interface CoverageReport {
  readonly overallCoverageRate: number;
  readonly dormantCount: number;
  readonly phantomCount: number;
  readonly prefixes: readonly PrefixCoverageReport[];
  readonly allEntries: readonly CoverageEntryReport[];
}

export interface CoverageAuditResult {
  readonly report: CoverageReport;
  readonly observations: readonly ObservationNode[];
  readonly decisions: readonly DecisionNode[];
}

export function auditCoverage(
  catalog: Catalog,
  graph: GraphPort,
  entryUsages: readonly EntryUsage[],
  _addressUsages: readonly AddressUsage[],
  options?: { date?: string; lowCoverageThreshold?: number },
): CoverageAuditResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const threshold = options?.lowCoverageThreshold ?? 0.5;
  const report = buildCoverageReport(catalog, entryUsages);
  const observations: ObservationNode[] = [];
  const decisions: DecisionNode[] = [];

  for (const prefix of report.prefixes.filter((p) => p.coverageRate > 0 && p.coverageRate < threshold)) {
    const dormantDims = Object.entries(prefix.dims)
      .filter(([, dim]) => dim.dormant > 0)
      .map(([label, dim]) => {
        const dormant = dim.entries.filter((entry) => entry.status === "dormant").map((entry) => entry.entry);
        return `${label}:[${dormant.join(",")}]`;
      });

    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-COV-${prefix.prefixId}`,
      date,
      source: "metric",
      subjects: [prefix.prefixId],
      finding: `${prefix.prefixId} 커버리지 ${(prefix.coverageRate * 100).toFixed(0)}% — dormant: ${dormantDims.join("; ")}`,
      suggestion: {
        kind: "add-constraint",
        rule: `${prefix.prefixId} 커버리지 개선: 테스트 보강 또는 dormant entry 비활성화`,
      },
    };
    observations.push(obs);
    graph.addNode(obs);
    if (graph.getNode(prefix.prefixId)) graph.addEdge("observes", obs.id, prefix.prefixId);

    const totalDormant = Object.values(prefix.dims).reduce((sum, dim) => sum + dim.dormant, 0);
    const dec: DecisionNode = {
      kind: "decision",
      id: `DEC-COV-${prefix.prefixId}`,
      date,
      title: `${prefix.prefixId} 관측 사각지대 해소`,
      context: `커버리지 ${(prefix.coverageRate * 100).toFixed(0)}%, dormant entry ${totalDormant}개`,
      rationale: `정의된 entry 중 ${totalDormant}개가 실 트래픽에서 관측되지 않음. 테스트 부족인지 미사용 entry인지 확인 필요.`,
      alternatives: [
        "dormant entry를 커버하는 테스트 시나리오 추가",
        "사용되지 않는 entry 비활성화",
        "현재 상태 유지 후 트래픽 증가 시 재평가",
      ],
      lifecycle: "active",
    };
    decisions.push(dec);
    graph.addNode(dec);
    graph.addEdge("prompts", obs.id, dec.id);
    if (graph.getNode(prefix.prefixId)) graph.addEdge("governs", dec.id, prefix.prefixId);
  }

  const zeroPrefixes = report.prefixes.filter((p) => p.coverageRate === 0);
  if (zeroPrefixes.length > 0) {
    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-COV-ZERO",
      date,
      source: "metric",
      subjects: zeroPrefixes.map((p) => p.prefixId),
      finding: `${zeroPrefixes.length}개 prefix 트래픽 전무: ${zeroPrefixes.map((p) => p.prefixId).join(", ")}`,
      intent: "monitoring",
    };
    observations.push(obs);
    graph.addNode(obs);
    for (const prefix of zeroPrefixes) {
      if (graph.getNode(prefix.prefixId)) graph.addEdge("observes", obs.id, prefix.prefixId);
    }
  }

  const phantoms = report.allEntries.filter((entry) => entry.status === "phantom");
  if (phantoms.length > 0) {
    const first = phantoms[0]!;
    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-COV-PHANTOM",
      date,
      source: "metric",
      subjects: [...new Set(phantoms.map((entry) => entry.prefixId))],
      finding: `phantom entry ${phantoms.length}개: ${phantoms.map((entry) => `${entry.axisId}=${entry.entry}`).join(", ")}. catalog에 없는 값이 트래픽에서 관측됨.`,
      suggestion: { kind: "add-entry", axis: first.axisId, entry: first.entry },
    };
    observations.push(obs);
    graph.addNode(obs);
  }

  return { report, observations, decisions };
}

function buildCoverageReport(catalog: Catalog, entryUsages: readonly EntryUsage[]): CoverageReport {
  const usageByPrefix = new Map<string, Map<string, number>>();
  for (const usage of entryUsages) {
    const prefixUsage = usageByPrefix.get(usage.prefixId) ?? new Map<string, number>();
    prefixUsage.set(usage.entryId, (prefixUsage.get(usage.entryId) ?? 0) + usage.count);
    usageByPrefix.set(usage.prefixId, prefixUsage);
  }

  const prefixes: PrefixCoverageReport[] = [];
  const allEntries: CoverageEntryReport[] = [];

  for (const prefix of Object.values(catalog.prefixes)) {
    const usage = usageByPrefix.get(prefix.id) ?? new Map<string, number>();
    const consumedUsageEntries = new Set<string>();
    const dims: Record<string, CoverageDimReport> = {};
    let prefixTotal = 0;
    let prefixObserved = 0;

    const latest = prefix.versions[prefix.versions.length - 1];
    for (const [label, dim] of Object.entries(prefix.dims)) {
      if (dim.kind !== "axis") continue;
      const axisVersion = latest?.axisVersions[label] ?? latest?.axisVersions[dim.axisId] ?? latest?.version ?? "v1";
      const entries = catalog.axes[dim.axisId]?.versions[axisVersion]?.entries ?? [];
      const reports: CoverageEntryReport[] = entries.map((entry) => {
        const count = usage.get(entry) ?? 0;
        if (count > 0) consumedUsageEntries.add(entry);
        return {
          prefixId: prefix.id,
          axisId: dim.axisId,
          entry,
          count,
          status: count > 0 ? "observed" : "dormant",
        };
      });
      const observed = reports.filter((entry) => entry.status === "observed").length;
      dims[label] = {
        total: reports.length,
        observed,
        dormant: reports.length - observed,
        phantom: 0,
        entries: reports,
      };
      prefixTotal += reports.length;
      prefixObserved += observed;
      allEntries.push(...reports);
    }

    const phantomReports: CoverageEntryReport[] = [];
    for (const [entry, count] of usage.entries()) {
      if (consumedUsageEntries.has(entry)) continue;
      phantomReports.push({
        prefixId: prefix.id,
        axisId: "__unknown__",
        entry,
        count,
        status: "phantom",
      });
    }
    if (phantomReports.length > 0) {
      dims.__phantom__ = {
        total: 0,
        observed: 0,
        dormant: 0,
        phantom: phantomReports.length,
        entries: phantomReports,
      };
      allEntries.push(...phantomReports);
    }

    prefixes.push({
      prefixId: prefix.id,
      coverageRate: prefixTotal > 0 ? prefixObserved / prefixTotal : 0,
      observedEntries: prefixObserved,
      totalEntries: prefixTotal,
      dims,
    });
  }

  const totalEntries = prefixes.reduce((sum, prefix) => sum + prefix.totalEntries, 0);
  const observedEntries = prefixes.reduce((sum, prefix) => sum + prefix.observedEntries, 0);
  return {
    overallCoverageRate: totalEntries > 0 ? observedEntries / totalEntries : 0,
    dormantCount: allEntries.filter((entry) => entry.status === "dormant").length,
    phantomCount: allEntries.filter((entry) => entry.status === "phantom").length,
    prefixes,
    allEntries,
  };
}
