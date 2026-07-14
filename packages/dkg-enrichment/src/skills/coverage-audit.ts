// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * coverage-audit — entry 관측 커버리지 감사 + 자동 Observation/Decision 생성.
 *
 * catalog에 정의된 entry vs 실 트래픽에서 관측된 entry를 대조하여:
 * 1. dormant entry → Observation (관측 사각지대)
 * 2. phantom entry → Observation (catalog 미반영)
 * 3. 저커버리지 prefix → Decision (테스트 보강 또는 entry 정리 필요)
 */

import type { Catalog } from '@qa-sdk/core';
import type { GraphPort, EntryUsage, AddressUsage, CoverageReport } from '@qa-sdk/convergence';
import type { ObservationNode, DecisionNode } from 'dkg';
import { analyzeEntryCoverage } from '@qa-sdk/convergence';

export interface CoverageAuditResult {
  readonly report: CoverageReport;
  readonly observations: readonly ObservationNode[];
  readonly decisions: readonly DecisionNode[];
}

/**
 * entry 관측 커버리지를 감사하고, DKG에 Observation/Decision을 생성한다.
 */
export function auditCoverage(
  catalog: Catalog,
  graph: GraphPort,
  entryUsages: readonly EntryUsage[],
  addressUsages: readonly AddressUsage[],
  options?: { date?: string; lowCoverageThreshold?: number },
): CoverageAuditResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const threshold = options?.lowCoverageThreshold ?? 0.5;

  const report = analyzeEntryCoverage(catalog, entryUsages, addressUsages);
  const observations: ObservationNode[] = [];
  const decisions: DecisionNode[] = [];

  // 1. 저커버리지 prefix → Observation + Decision
  const lowCoveragePrefixes = report.prefixes.filter(
    (p) => p.coverageRate < threshold && p.coverageRate > 0,
  );

  for (const pc of lowCoveragePrefixes) {
    const dormantDims = Object.entries(pc.dims)
      .filter(([, d]) => d.dormant > 0)
      .map(([label, d]) => {
        const dormants = d.entries.filter((e) => e.status === 'dormant').map((e) => e.entry);
        return `${label}:[${dormants.join(',')}]`;
      });

    const obs: ObservationNode = {
      kind: 'observation',
      id: `OBS-COV-${pc.prefixId}`,
      date,
      source: 'metric',
      subjects: [pc.prefixId],
      finding: `${pc.prefixId} 커버리지 ${(pc.coverageRate * 100).toFixed(0)}% — dormant: ${dormantDims.join('; ')}`,
      suggestion: {
        kind: 'add-constraint',
        rule: `${pc.prefixId} 커버리지 개선: 테스트 보강 또는 dormant entry 비활성화`,
      },
    };
    observations.push(obs);
    graph.addNode(obs);
    if (graph.getNode(pc.prefixId)) {
      graph.addEdge('observes', obs.id, pc.prefixId);
    }

    // Decision: 테스트 보강 or entry 정리
    const totalDormant = Object.values(pc.dims).reduce((s, d) => s + d.dormant, 0);
    const dec: DecisionNode = {
      kind: 'decision',
      id: `DEC-COV-${pc.prefixId}`,
      date,
      title: `${pc.prefixId} 관측 사각지대 해소`,
      context: `커버리지 ${(pc.coverageRate * 100).toFixed(0)}%, dormant entry ${totalDormant}개`,
      rationale: `정의된 entry 중 ${totalDormant}개가 실 트래픽에서 관측되지 않음. 해당 분기가 실제로 사용되지 않는 것인지, 테스트가 부족한 것인지 확인 필요.`,
      alternatives: [
        `dormant entry를 커버하는 테스트 시나리오 추가`,
        `사용되지 않는 entry 비활성화 (EntryFlagStore)`,
        `현재 상태 유지 — 추후 트래픽 증가 시 자연 해소 대기`,
      ],
      lifecycle: 'active',
    };
    decisions.push(dec);
    graph.addNode(dec);
    graph.addEdge('prompts', obs.id, dec.id);
    if (graph.getNode(pc.prefixId)) {
      graph.addEdge('governs', dec.id, pc.prefixId);
    }
  }

  // 2. 0% 커버리지 prefix (트래픽 전무) → 집합 Observation
  const zeroPrefixes = report.prefixes.filter((p) => p.coverageRate === 0);
  if (zeroPrefixes.length > 0) {
    const obs: ObservationNode = {
      kind: 'observation',
      id: 'OBS-COV-ZERO',
      date,
      source: 'metric',
      subjects: zeroPrefixes.map((p) => p.prefixId),
      finding: `${zeroPrefixes.length}개 prefix 트래픽 전무: ${zeroPrefixes.map((p) => p.prefixId).join(', ')}`,
    };
    observations.push(obs);
    graph.addNode(obs);
    for (const p of zeroPrefixes) {
      if (graph.getNode(p.prefixId)) {
        graph.addEdge('observes', obs.id, p.prefixId);
      }
    }
  }

  // 3. phantom entry → Observation
  const phantoms = report.allEntries.filter((e) => e.status === 'phantom');
  if (phantoms.length > 0) {
    const obs: ObservationNode = {
      kind: 'observation',
      id: 'OBS-COV-PHANTOM',
      date,
      source: 'metric',
      subjects: phantoms.map((p) => p.axisId),
      finding: `phantom entry ${phantoms.length}개: ${phantoms.map((p) => `${p.axisId}=${p.entry}`).join(', ')}. catalog에 없는 값이 트래픽에서 관측됨.`,
      suggestion: { kind: 'add-entry', axis: phantoms[0].axisId, entry: phantoms[0].entry },
    };
    observations.push(obs);
    graph.addNode(obs);
  }

  return { report, observations, decisions };
}
