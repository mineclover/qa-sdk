/**
 * DKG Bridge — TransitionSpec → TransitionSpecNode 자동 변환.
 *
 * TransitionSpec이 SSOT. DKG 노드는 파생.
 * 축 참조를 역할별로 분리: matchAxes / inputAxes / outputAxes.
 * 이 분리가 전이 간 상태 의존성 분석의 기반.
 */

import type { TransitionSpec } from "spec-transition";
import type { TransitionSpecNode, DkgEdge, DkgEdgeType } from "./dkg.types.js";

/** match.coordinates에서 차원 이름 수집 */
function collectMatchAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const coord of spec.match.coordinates) {
    for (const dim of Object.keys(coord)) axes.add(dim);
  }
  return [...axes].toSorted();
}

/** input.all에서 축 이름 수집 */
function collectInputAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const cond of spec.input.all) axes.add(cond.axis);
  return [...axes].toSorted();
}

/** output.set에서 축 이름 수집 */
function collectOutputAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const assign of spec.output.set) axes.add(assign.axis);
  return [...axes].toSorted();
}

/**
 * TransitionSpec → TransitionSpecNode 변환.
 *
 * id 형식: `TSPEC-<transition이름의 . → - 변환>`
 */
export function toTransitionSpecNode(spec: TransitionSpec): TransitionSpecNode {
  const matchAxes = collectMatchAxes(spec);
  const inputAxes = collectInputAxes(spec);
  const outputAxes = collectOutputAxes(spec);

  // slotRefs = 전체 합집합
  const all = new Set([...matchAxes, ...inputAxes, ...outputAxes]);

  return {
    kind: "transition-spec",
    id: `TSPEC-${spec.transition.replace(/\./g, "-")}`,
    transition: spec.transition,
    version: spec.version,
    matchMode: spec.match.mode,
    coordinateCount: spec.match.coordinates.length,
    effectKind: spec.effect.kind,
    slotRefs: [...all].toSorted(),
    matchAxes,
    inputAxes,
    outputAxes,
  };
}

/**
 * TransitionSpec 배열 → TransitionSpecNode 배열.
 */
export function toTransitionSpecNodes(specs: readonly TransitionSpec[]): TransitionSpecNode[] {
  return specs.map(toTransitionSpecNode);
}

// ═══════════════════════════════════════════════════════════════
//  Inter-spec 상태 의존성 + DSL satisfies 파생
// ═══════════════════════════════════════════════════════════════

/**
 * TransitionSpec 간 상태 의존성 파생.
 * A.outputAxes ∩ B.inputAxes → B depends-on A (B가 A의 output을 전제조건으로 요구)
 */
export function deriveInterSpecEdges(
  specs: readonly TransitionSpecNode[],
): DkgEdge[] {
  const edges: DkgEdge[] = [];

  for (const consumer of specs) {
    const inputSet = new Set(consumer.inputAxes);
    for (const producer of specs) {
      if (producer.id === consumer.id) continue;
      const shared = producer.outputAxes.filter(a => inputSet.has(a));
      if (shared.length > 0) {
        edges.push({
          type: "depends-on",
          from: consumer.id,
          to: producer.id,
          meta: { sharedAxes: shared, kind: "state-dependency" },
        });
      }
    }
  }

  return edges;
}

/** 그래프 조회 최소 인터페이스 (GraphRegistry 호환) */
interface GraphLike {
  getNodesByKind(kind: string): readonly { id: string; kind: string }[];
  edgesFrom(nodeId: string, type: DkgEdgeType): readonly { to: string; meta?: Readonly<Record<string, unknown>> }[];
}

/**
 * TransitionSpec → DslBundle satisfies 연결.
 * DSL member prefix가 사용하는 축과 TransitionSpec의 slotRefs 교집합이 2개 이상이면 satisfies.
 */
export function deriveDslSatisfiesEdges(
  specs: readonly TransitionSpecNode[],
  graph: GraphLike,
): DkgEdge[] {
  const edges: DkgEdge[] = [];

  // DSL bundle별 축 집합 수집
  const dslBundles = graph.getNodesByKind("dsl-bundle");
  const dslAxesMap = new Map<string, Set<string>>();

  for (const dsl of dslBundles) {
    const axes = new Set<string>();
    // DSL → contains → prefix → composes → axis
    const containsEdges = graph.edgesFrom(dsl.id, "contains");
    for (const ce of containsEdges) {
      const composesEdges = graph.edgesFrom(ce.to, "composes");
      for (const comp of composesEdges) {
        if (comp.meta?.dimKind === "axis") {
          axes.add(comp.to);
        }
      }
    }
    if (axes.size > 0) dslAxesMap.set(dsl.id, axes);
  }

  // 각 TransitionSpec의 slotRefs와 DSL 축 교집합
  for (const spec of specs) {
    const specAxes = new Set(spec.slotRefs);
    for (const [dslId, dslAxes] of dslAxesMap) {
      const overlap = [...specAxes].filter(a => dslAxes.has(a));
      if (overlap.length >= 2) {
        edges.push({
          type: "satisfies",
          from: spec.id,
          to: dslId,
          meta: { kind: "formalizes", overlappingAxes: overlap },
        });
      }
    }
  }

  return edges;
}
