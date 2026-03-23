/**
 * lifecycle-transition — 노드 상태 전이 + 이력 기록.
 *
 * prefix/DSL/Decision/Observation의 lifecycle을 전이하고,
 * DKG 그래프에 evolves-from/supersedes 엣지로 이력을 기록한다.
 */

import type { GraphRegistry } from "../graph-registry.js";
import type {
  DecisionNode,
  ObservationNode,
  PrefixNode,
  DslBundleNode,
  DkgNode,
  VersionEventNode,
} from "../dkg.types.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface TransitionResult {
  readonly nodeId: string;
  readonly from: string;
  readonly to: string;
  readonly success: boolean;
  readonly reason?: string;
}

export interface LifecycleReport {
  readonly prefixes: readonly { id: string; lifecycle: string; category?: string }[];
  readonly dslBundles: readonly { id: string; lifecycle: string }[];
  readonly decisions: readonly { id: string; lifecycle: string; title: string }[];
  readonly observations: readonly { id: string; resolved: boolean; outcome?: string }[];
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  Transition Logic
// ═══════════════════════════════════════════════════════════════

const PREFIX_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["active"],
  active: ["deprecated"],
  deprecated: ["archived"],
  archived: [],
};

const DSL_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["active"],
  active: ["deprecated"],
  deprecated: [],
};

const DECISION_TRANSITIONS: Record<string, readonly string[]> = {
  active: ["superseded", "reversed"],
  superseded: [],
  reversed: ["active"],
};

/**
 * prefix lifecycle 전이.
 */
export function transitionPrefix(
  graph: GraphRegistry,
  prefixId: string,
  toLifecycle: NonNullable<PrefixNode["lifecycle"]>,
  options?: { date?: string; reason?: string; supersededBy?: string },
): TransitionResult {
  const node = graph.getNode(prefixId) as PrefixNode | undefined;
  if (!node || node.kind !== "prefix") {
    return { nodeId: prefixId, from: "?", to: toLifecycle, success: false, reason: "노드 없음" };
  }

  const from = node.lifecycle ?? "active";
  const allowed = PREFIX_TRANSITIONS[from];
  if (!allowed?.includes(toLifecycle)) {
    return { nodeId: prefixId, from, to: toLifecycle, success: false, reason: `${from} → ${toLifecycle} 전이 불가` };
  }

  // 노드 교체 (immutable)
  const updated: PrefixNode = { ...node, lifecycle: toLifecycle };
  graph.replaceNode(updated);

  // deprecated 시 supersedes 엣지
  if (toLifecycle === "deprecated" && options?.supersededBy) {
    graph.addEdge("supersedes", options.supersededBy, prefixId);
  }

  // version event 기록
  const evt: VersionEventNode = {
    kind: "version-event",
    id: `VE-LC-${prefixId}-${toLifecycle}`,
    subjectId: prefixId,
    subjectKind: "prefix",
    fromVersion: from,
    toVersion: toLifecycle,
    date: options?.date ?? new Date().toISOString().slice(0, 10),
    changes: [{ kind: "entry-added", detail: `lifecycle: ${from} → ${toLifecycle}` }],
    impact: options?.reason ?? `${prefixId} ${toLifecycle}`,
  };
  graph.addNode(evt);
  graph.addEdge("evolves-from", evt.id, prefixId);

  return { nodeId: prefixId, from, to: toLifecycle, success: true };
}

/**
 * Decision lifecycle 전이 + 후속 Decision 연결.
 */
export function transitionDecision(
  graph: GraphRegistry,
  decisionId: string,
  toLifecycle: "superseded" | "reversed",
  options?: { date?: string; supersededBy?: string; reason?: string },
): TransitionResult {
  const node = graph.getNode(decisionId) as DecisionNode | undefined;
  if (!node || node.kind !== "decision") {
    return { nodeId: decisionId, from: "?", to: toLifecycle, success: false, reason: "노드 없음" };
  }

  const from = node.lifecycle;
  const allowed = DECISION_TRANSITIONS[from];
  if (!allowed?.includes(toLifecycle)) {
    return { nodeId: decisionId, from, to: toLifecycle, success: false, reason: `${from} → ${toLifecycle} 전이 불가` };
  }

  const updated: DecisionNode = { ...node, lifecycle: toLifecycle };
  graph.replaceNode(updated);

  if (toLifecycle === "superseded" && options?.supersededBy) {
    graph.addEdge("supersedes", options.supersededBy, decisionId);
  }

  return { nodeId: decisionId, from, to: toLifecycle, success: true };
}

/**
 * Observation resolution 기록.
 */
export function resolveObservation(
  graph: GraphRegistry,
  observationId: string,
  resolution: { decisionId: string; outcome: "accepted" | "deferred" | "rejected"; note?: string },
): TransitionResult {
  const node = graph.getNode(observationId) as ObservationNode | undefined;
  if (!node || node.kind !== "observation") {
    return { nodeId: observationId, from: "open", to: resolution.outcome, success: false, reason: "노드 없음" };
  }

  const updated: ObservationNode = { ...node, resolution };
  graph.replaceNode(updated);

  return { nodeId: observationId, from: "open", to: resolution.outcome, success: true };
}

// ═══════════════════════════════════════════════════════════════
//  Lifecycle Report
// ═══════════════════════════════════════════════════════════════

/**
 * 전체 DKG 그래프의 lifecycle 상태를 요약한다.
 */
export function generateLifecycleReport(graph: GraphRegistry): LifecycleReport {
  const prefixes = graph.getNodesByKind("prefix").map(p => ({
    id: p.id,
    lifecycle: p.lifecycle ?? "active",
    category: p.category,
  }));

  const dslBundles = graph.getNodesByKind("dsl-bundle").map(d => ({
    id: d.id,
    lifecycle: d.lifecycle ?? "active",
  }));

  const decisions = graph.getNodesByKind("decision").map(d => ({
    id: d.id,
    lifecycle: d.lifecycle,
    title: d.title,
  }));

  const observations = graph.getNodesByKind("observation").map(o => ({
    id: o.id,
    resolved: !!o.resolution,
    outcome: o.resolution?.outcome,
  }));

  const activeP = prefixes.filter(p => p.lifecycle === "active").length;
  const deprecatedP = prefixes.filter(p => p.lifecycle === "deprecated").length;
  const activeDsl = dslBundles.filter(d => d.lifecycle === "active").length;
  const activeDec = decisions.filter(d => d.lifecycle === "active").length;
  const supersededDec = decisions.filter(d => d.lifecycle === "superseded").length;
  const openObs = observations.filter(o => !o.resolved).length;
  const resolvedObs = observations.filter(o => o.resolved).length;

  return {
    prefixes,
    dslBundles,
    decisions,
    observations,
    summary: [
      `prefix: ${activeP} active, ${deprecatedP} deprecated`,
      `DSL: ${activeDsl} active`,
      `Decision: ${activeDec} active, ${supersededDec} superseded`,
      `Observation: ${openObs} open, ${resolvedObs} resolved`,
    ].join(" | "),
  };
}
