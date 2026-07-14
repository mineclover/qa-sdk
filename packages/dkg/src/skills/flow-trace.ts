// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * flow-trace — address_context 기반 IntentLink/DSL invariant 검증.
 */

import type { GraphPort } from 'spec-schema';
import type { DslBundleNode, IntentLinkNode, ObservationNode } from '../dkg.types.js';

export interface AddressContextRecord {
  readonly address_context?: Readonly<Record<string, string>>;
  readonly timestamp?: string;
  readonly session_id?: string;
}

export interface FlowViolation {
  readonly intentLinkId: string;
  readonly invariant: string;
  readonly presentPrefixes: readonly string[];
  readonly missingPrefixes: readonly string[];
  readonly count: number;
}

export interface DslInvariantViolation {
  readonly bundleId: string;
  readonly invariant: string;
  readonly presentPrefixes: readonly string[];
  readonly missingPrefixes: readonly string[];
  readonly count: number;
}

export interface DslInvariantResult {
  readonly totalRecords: number;
  readonly checkedRecords: number;
  readonly violations: readonly DslInvariantViolation[];
  readonly observations: readonly ObservationNode[];
  readonly summary: string;
}

export interface FlowTraceResult {
  readonly totalRecords: number;
  readonly checkedRecords: number;
  readonly violations: readonly FlowViolation[];
  readonly observations: readonly ObservationNode[];
  readonly summary: string;
}

export function traceFlows(
  graph: GraphPort,
  records: readonly AddressContextRecord[],
  options?: { date?: string },
): FlowTraceResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const intentLinks = graph.getNodesByKind('intent-link') as IntentLinkNode[];
  const violationMap = new Map<string, Omit<FlowViolation, 'count'>>();
  const countMap = new Map<string, number>();
  let checkedRecords = 0;

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) continue;
    const presentPrefixes = new Set(Object.keys(ctx));
    checkedRecords += 1;

    for (const link of intentLinks) {
      const matchedEndpoints = link.endpoints.filter((endpoint) => presentPrefixes.has(endpoint));
      if (matchedEndpoints.length === 0) continue;
      const missingEndpoints = link.endpoints.filter((endpoint) => !presentPrefixes.has(endpoint));
      if (missingEndpoints.length === 0) continue;
      if (
        link.invariant &&
        !checkInvariantViolation(link.invariant, presentPrefixes, link.endpoints)
      )
        continue;

      const key = `${link.id}:${missingEndpoints.toSorted().join(',')}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
      if (!violationMap.has(key)) {
        violationMap.set(key, {
          intentLinkId: link.id,
          invariant: link.invariant ?? `endpoints ${link.endpoints.join(',')} 불완전`,
          presentPrefixes: matchedEndpoints,
          missingPrefixes: missingEndpoints,
        });
      }
    }
  }

  const violations = toCountedViolations(violationMap, countMap);
  const observations = violations.map((violation) => {
    const obs: ObservationNode = {
      kind: 'observation',
      id: `OBS-FLOW-${violation.intentLinkId}-${violation.missingPrefixes.join('_')}`,
      date,
      source: 'runtime',
      subjects: [
        violation.intentLinkId,
        ...violation.presentPrefixes,
        ...violation.missingPrefixes,
      ],
      finding: `${violation.intentLinkId} invariant 위반 ${violation.count}건: ${violation.missingPrefixes.join(',')} 누락 (${violation.presentPrefixes.join(',')}만 있음)`,
      suggestion: {
        kind: 'revise-decision',
        decisionId: violation.intentLinkId,
        reason: violation.invariant,
      },
    };
    graph.addNode(obs);
    graph.addEdge('observes', obs.id, violation.intentLinkId);
    return obs;
  });

  return {
    totalRecords: records.length,
    checkedRecords,
    violations,
    observations,
    summary:
      violations.length > 0
        ? `${violations.length}종 흐름 위반 (${violations.reduce((sum, violation) => sum + violation.count, 0)}건)`
        : `흐름 위반 없음 (${checkedRecords}건 검사)`,
  };
}

export function validateDslInvariants(
  graph: GraphPort,
  records: readonly AddressContextRecord[],
  options?: { date?: string; excludeBundles?: readonly string[] },
): DslInvariantResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const exclude = new Set(options?.excludeBundles ?? []);
  const bundles = (graph.getNodesByKind('dsl-bundle') as DslBundleNode[]).filter(
    (bundle) => bundle.invariants && bundle.invariants.length > 0 && !exclude.has(bundle.id),
  );
  const violationMap = new Map<string, Omit<DslInvariantViolation, 'count'>>();
  const countMap = new Map<string, number>();
  let checkedRecords = 0;

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) continue;
    const presentPrefixes = new Set(Object.keys(ctx));
    checkedRecords += 1;

    for (const bundle of bundles) {
      const matched = bundle.memberPrefixes.filter((prefix) => presentPrefixes.has(prefix));
      if (matched.length === 0) continue;
      const missing = bundle.memberPrefixes.filter((prefix) => !presentPrefixes.has(prefix));

      for (const invariant of bundle.invariants ?? []) {
        if (!checkInvariantViolation(invariant, presentPrefixes, bundle.memberPrefixes)) continue;
        const key = `${bundle.id}:${invariant.slice(0, 60)}`;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
        if (!violationMap.has(key)) {
          violationMap.set(key, {
            bundleId: bundle.id,
            invariant,
            presentPrefixes: matched,
            missingPrefixes: missing,
          });
        }
      }
    }
  }

  const violations = [...violationMap.entries()]
    .map(([key, violation]) => ({ ...violation, count: countMap.get(key) ?? 1 }))
    .toSorted((a, b) => b.count - a.count);
  const observations = violations.map((violation) => {
    const obs: ObservationNode = {
      kind: 'observation',
      id: `OBS-DSL-${violation.bundleId}-${violation.invariant.slice(0, 30).replace(/[^a-zA-Z0-9_가-힣]/g, '_')}`,
      date,
      source: 'runtime',
      subjects: [violation.bundleId, ...violation.presentPrefixes, ...violation.missingPrefixes],
      finding: `${violation.bundleId} invariant 위반 ${violation.count}건: ${violation.invariant}`,
      suggestion: {
        kind: 'revise-decision',
        decisionId: violation.bundleId,
        reason: violation.invariant,
      },
    };
    graph.addNode(obs);
    graph.addEdge('observes', obs.id, violation.bundleId);
    return obs;
  });

  return {
    totalRecords: records.length,
    checkedRecords,
    violations,
    observations,
    summary:
      violations.length > 0
        ? `${violations.length}종 DSL 불변조건 위반 (${violations.reduce((sum, violation) => sum + violation.count, 0)}건)`
        : `DSL 불변조건 위반 없음 (${bundles.length}개 번들, ${checkedRecords}건 검사)`,
  };
}

function toCountedViolations(
  violationMap: Map<string, Omit<FlowViolation, 'count'>>,
  countMap: Map<string, number>,
): FlowViolation[] {
  return [...violationMap.entries()]
    .map(([key, violation]) => ({ ...violation, count: countMap.get(key) ?? 1 }))
    .toSorted((a, b) => b.count - a.count);
}

function checkInvariantViolation(
  invariant: string,
  present: Set<string>,
  endpoints: readonly string[],
): boolean {
  for (const endpoint of endpoints) {
    if (
      invariant.includes(`${endpoint} 없이`) ||
      (invariant.includes(`${endpoint}(`) && invariant.includes('없이'))
    ) {
      const withoutIndex = invariant.indexOf('없이');
      const endpointIndex = invariant.indexOf(endpoint);
      if (endpointIndex < withoutIndex && !present.has(endpoint)) {
        return endpoints.some((other) => other !== endpoint && present.has(other));
      }
    }
  }

  for (let i = 0; i < endpoints.length; i += 1) {
    const required = endpoints[i]!;
    if (present.has(required)) continue;
    for (let j = i + 1; j < endpoints.length; j += 1) {
      const dependent = endpoints[j]!;
      if (present.has(dependent) && invariant.includes(required) && invariant.includes(dependent))
        return true;
    }
  }
  return false;
}
