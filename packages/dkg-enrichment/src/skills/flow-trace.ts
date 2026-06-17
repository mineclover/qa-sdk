// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * flow-trace — 분기 흐름 순서 검증.
 *
 * address_context에서 prefix 간 순서 관계를 추출하고,
 * IntentLink의 invariant와 대조하여 위반을 감지한다.
 *
 * 예: "page_view 없이 flow_point가 관측" → invariant 위반
 */

import type { GraphPort, AddressContextRecord } from "@qa-sdk/convergence";
import type { DslBundleNode, IntentLinkNode, ObservationNode } from "dkg";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface FlowViolation {
  readonly intentLinkId: string;
  readonly invariant: string;
  /** 위반 발생한 레코드의 address_context에 있었던 prefix 목록 */
  readonly presentPrefixes: readonly string[];
  /** 있어야 했지만 없었던 prefix */
  readonly missingPrefixes: readonly string[];
  /** 위반 횟수 */
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

// ═══════════════════════════════════════════════════════════════
//  Trace
// ═══════════════════════════════════════════════════════════════

/**
 * IntentLink의 invariant를 실 트래픽과 대조하여 위반을 감지한다.
 *
 * 검사 방식:
 * - IntentLink.endpoints 중 일부만 address_context에 있고 나머지가 빠지면 위반
 * - "A 없이 B" 패턴을 invariant 텍스트에서 추출하여 순서 검증
 */
export function traceFlows(
  graph: GraphPort,
  records: readonly AddressContextRecord[],
  options?: { date?: string },
): FlowTraceResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);

  const intentLinks = graph.getNodesByKind("intent-link") as IntentLinkNode[];
  const violationMap = new Map<string, Omit<FlowViolation, "count">>();
  const countMap = new Map<string, number>();
  let checkedRecords = 0;

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) continue;

    const presentPrefixes = new Set(Object.keys(ctx));
    checkedRecords++;

    for (const link of intentLinks) {
      // 이 레코드가 IntentLink의 endpoint 중 하나라도 포함하는가
      const matchedEndpoints = link.endpoints.filter(ep => presentPrefixes.has(ep));
      if (matchedEndpoints.length === 0) continue; // 이 IntentLink와 무관한 레코드

      // 일부 endpoint만 있고 나머지가 빠진 경우 → 잠재적 위반
      const missingEndpoints = link.endpoints.filter(ep => !presentPrefixes.has(ep));
      if (missingEndpoints.length === 0) continue; // 전부 있으면 OK

      // invariant가 있으면 텍스트 패턴 체크, 없으면 endpoint 불완전 자체가 위반
      if (link.invariant) {
        const hasViolation = checkInvariantViolation(
          link.invariant,
          presentPrefixes,
          link.endpoints,
        );
        if (!hasViolation) continue;
      }
      // invariant 없어도 endpoint 불완전이면 기본 위반으로 취급하지 않음 (pass)

      const key = `${link.id}:${missingEndpoints.toSorted().join(",")}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
      if (!violationMap.has(key)) {
        violationMap.set(key, {
          intentLinkId: link.id,
          invariant: link.invariant ?? `endpoints ${link.endpoints.join(",")} 불완전`,
          presentPrefixes: [...matchedEndpoints],
          missingPrefixes: missingEndpoints,
        });
      }
    }
  }

  const violations: FlowViolation[] = [...violationMap.entries()]
    .map(([key, v]) => Object.assign({}, v, { count: countMap.get(key) ?? 1 }))
    .toSorted((a, b) => b.count - a.count);

  // Observation 자동 생성
  const observations: ObservationNode[] = [];
  for (const v of violations) {
    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-FLOW-${v.intentLinkId}-${v.missingPrefixes.join("_")}`,
      date,
      source: "runtime",
      subjects: [v.intentLinkId, ...v.presentPrefixes, ...v.missingPrefixes],
      finding: `${v.intentLinkId} invariant 위반 ${v.count}건: ${v.missingPrefixes.join(",")} 누락 (${v.presentPrefixes.join(",")}만 있음)`,
      suggestion: {
        kind: "revise-decision",
        decisionId: v.intentLinkId,
        reason: v.invariant,
      },
    };
    observations.push(obs);
    graph.addNode(obs);
    graph.addEdge("observes", obs.id, v.intentLinkId);
  }

  return {
    totalRecords: records.length,
    checkedRecords,
    violations,
    observations,
    summary: violations.length > 0
      ? `${violations.length}종 흐름 위반 (${violations.reduce((s, v) => s + v.count, 0)}건)`
      : `흐름 위반 없음 (${checkedRecords}건 검사)`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  DSL Bundle Invariant Validation
// ═══════════════════════════════════════════════════════════════

/**
 * DSL 번들의 invariant를 AddressContextRecord와 대조하여 위반을 감지한다.
 *
 * IntentLink 검증(traceFlows)과 보완적:
 * - traceFlows: IntentLink의 endpoint 순서/포함 검증
 * - validateDslInvariants: DSL 번들의 memberPrefixes 간 불변조건 검증
 *
 * dsl-dev 외 모든 DSL 번들(dsl-checkout, dsl-observation, dsl-infra 등)에 적용.
 */
export function validateDslInvariants(
  graph: GraphPort,
  records: readonly AddressContextRecord[],
  options?: { date?: string; excludeBundles?: readonly string[] },
): DslInvariantResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const exclude = new Set(options?.excludeBundles ?? []);

  const bundles = (graph.getNodesByKind("dsl-bundle") as DslBundleNode[])
    .filter(b => b.invariants && b.invariants.length > 0 && !exclude.has(b.id));

  const violationMap = new Map<string, Omit<DslInvariantViolation, "count">>();
  const countMap = new Map<string, number>();
  let checkedRecords = 0;

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) continue;

    const presentPrefixes = new Set(Object.keys(ctx));
    checkedRecords++;

    for (const bundle of bundles) {
      // 이 레코드가 DSL 번들의 memberPrefix 중 하나라도 포함하는가
      const matched = bundle.memberPrefixes.filter(p => presentPrefixes.has(p));
      if (matched.length === 0) continue;

      const missing = bundle.memberPrefixes.filter(p => !presentPrefixes.has(p));

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above: b.invariants && b.invariants.length > 0
      for (const invariant of bundle.invariants!) {
        const hasViolation = checkInvariantViolation(
          invariant,
          presentPrefixes,
          bundle.memberPrefixes,
        );
        if (!hasViolation) continue;

        const key = `${bundle.id}:${invariant.slice(0, 60)}`;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
        if (!violationMap.has(key)) {
          violationMap.set(key, {
            bundleId: bundle.id,
            invariant,
            presentPrefixes: [...matched],
            missingPrefixes: missing,
          });
        }
      }
    }
  }

  const violations: DslInvariantViolation[] = [...violationMap.entries()]
    .map(([key, v]) => Object.assign({}, v, { count: countMap.get(key) ?? 1 }))
    .toSorted((a, b) => b.count - a.count);

  // Observation 자동 생성
  const observations: ObservationNode[] = [];
  for (const v of violations) {
    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-DSL-${v.bundleId}-${v.invariant.slice(0, 30).replace(/[^a-zA-Z0-9_가-힣]/g, "_")}`,
      date,
      source: "runtime",
      subjects: [v.bundleId, ...v.presentPrefixes, ...v.missingPrefixes],
      finding: `${v.bundleId} invariant 위반 ${v.count}건: ${v.invariant}`,
      suggestion: {
        kind: "revise-decision",
        decisionId: v.bundleId,
        reason: v.invariant,
      },
    };
    observations.push(obs);
    graph.addNode(obs);
    graph.addEdge("observes", obs.id, v.bundleId);
  }

  return {
    totalRecords: records.length,
    checkedRecords,
    violations,
    observations,
    summary: violations.length > 0
      ? `${violations.length}종 DSL 불변조건 위반 (${violations.reduce((s, v) => s + v.count, 0)}건)`
      : `DSL 불변조건 위반 없음 (${bundles.length}개 번들, ${checkedRecords}건 검사)`,
  };
}

/**
 * invariant 텍스트에서 위반 여부를 판단한다.
 *
 * 방식 1: invariant 텍스트에 endpoint prefix ID가 언급됨 → 해당 prefix 기준 체크
 * 방식 2: "A 없이 B" 패턴 → A가 없고 B가 있으면 위반
 */
function checkInvariantViolation(
  invariant: string,
  present: Set<string>,
  endpoints: readonly string[],
): boolean {
  // 방식 1: invariant에서 endpoint prefix ID를 직접 찾아 "없이" 관계 추출
  // "page_view 없이 flow_point" → page_view가 required, flow_point가 dependent
  for (const ep of endpoints) {
    // "ep 없이" 패턴 → ep가 있어야 하는데 없으면 위반
    if (invariant.includes(`${ep} 없이`) || (invariant.includes(`${ep}(`) && invariant.includes("없이"))) {
      // ep가 required 측인지 확인
      const withoutIdx = invariant.indexOf("없이");
      const epIdx = invariant.indexOf(ep);
      if (epIdx < withoutIdx) {
        // ep가 "없이" 앞에 있음 → ep가 required
        if (!present.has(ep)) {
          // required가 없음 → 나머지 endpoint 중 하나가 있으면 위반
          const otherPresent = endpoints.some(other => other !== ep && present.has(other));
          if (otherPresent) return true;
        }
      }
    }
  }

  // 방식 2: endpoint 순서 기반 — 앞쪽 endpoint 없이 뒤쪽만 있으면 위반
  // IntentLink endpoints 순서가 흐름 순서를 암시
  for (let i = 0; i < endpoints.length; i++) {
    if (!present.has(endpoints[i])) {
      // 이 endpoint가 없는데, 뒤쪽 endpoint가 있으면 잠재적 위반
      for (let j = i + 1; j < endpoints.length; j++) {
        if (present.has(endpoints[j])) {
          // invariant에 이 관계가 언급되어 있는지 확인
          if (invariant.includes(endpoints[i]) && invariant.includes(endpoints[j])) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
