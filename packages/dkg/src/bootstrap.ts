// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * DKG 초기 부트스트랩 — 카탈로그 파생 + 설정 기반 메타데이터 등록.
 *
 * deriveFromCatalog로 구조를 파생한 후,
 * DkgConfig의 Domain, Consumer, Constraint 등 설계 메타데이터를 등록한다.
 *
 * 기본값: DEMO_CATALOG + DEMO_DKG_CONFIG (하위 호환).
 */

import type { Catalog } from "@qa-sdk/core";
import { analyzeGateStructure, identifyCoreGates, type FlowSchema } from "decision-flow";
import { GraphRegistry } from "./graph-registry.js";
import { deriveFromCatalog } from "./catalog-derive.js";
import { attachFlowSchemaEdges } from "./flow-schema-relations.js";
import type { DomainNode, ConsumerNode, ConstraintNode, IntentLinkNode, DslBundleNode, ObservationNode, DecisionNode, SpecNode, SkillNode, TransitionSpecNode, FlowSchemaNode } from "./dkg.types.js";
import type { TransitionSpec } from "spec-transition";
import { toTransitionSpecNodes, deriveInterSpecEdges, deriveDslSatisfiesEdges } from "./dkg-bridge.js";
import { analyzeHeadroom, applyHeadroomDecisions, scanAxisOverlaps, comparePrefixes, recordSeparation, applySeparationRecord } from "@qa-sdk/convergence";
import { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeAllVersionSkew } from "./dsl-bundle.js";

// ── Config 타입 (구조적 호환) ────────────────────────────────

interface DkgConfigInput {
  readonly domains: readonly DomainNode[];
  readonly consumers: readonly ConsumerNode[];
  readonly constraints: readonly ConstraintNode[];
  readonly dslBundles: readonly DslBundleNode[];
  readonly intentLinks: readonly IntentLinkNode[];
  readonly skills: readonly SkillNode[];
  readonly specs?: readonly SpecNode[];
  readonly decisions?: readonly DecisionNode[];
  readonly flowSchemas?: readonly FlowSchemaEntry[];
  readonly transitionSpecs?: readonly TransitionSpecNode[];
  readonly reviewPairs?: readonly { readonly a: string; readonly b: string; readonly reason: string }[];
}

interface FlowSchemaEntry {
  readonly schema: FlowSchema;
  readonly observedPrefixIds?: readonly string[];
  readonly axisIds?: readonly string[];
  readonly domainId?: string;
}

/**
 * 완전한 DKG 그래프를 부트스트랩한다.
 *
 * @param options.catalog - 카탈로그 (기본: DEMO_CATALOG)
 * @param options.config  - DKG 설정 (기본: DEMO_DKG_CONFIG)
 * @param options.date    - 날짜 (기본: 2026-03-20)
 *
 * 1. catalog에서 Axis/Prefix/composes/references 자동 파생
 * 2. config의 Domain/Consumer/Constraint/DslBundle/IntentLink/Skill/Spec 등록
 * 3. Headroom Decision 자동 생성
 * 4. 알려진 분리 유지 기록
 * 5. DSL 버전 스큐 분석 → Observation 자동 생성
 */
export function bootstrapDkg(options: {
  catalog: Catalog;
  config: DkgConfigInput;
  date?: string;
  /** TransitionSpec 배열 → 자동 변환 후 DKG 등록. config.transitionSpecs와 병합. */
  transitionSpecs?: readonly TransitionSpec[];
  /** refresh 시 기존 그래프. resolved observation 재생성 방지용. */
  existingGraph?: GraphRegistry;
}): GraphRegistry {
  const catalog = options.catalog;
  const config = options.config;
  const date = options?.date ?? "2026-03-20";
  const existing = options.existingGraph;

  const graph = deriveFromCatalog(catalog);

  // ── Domain 등록 ──────────────────────────────────────
  const domains = config.domains;
  for (const domain of domains) {
    graph.addNode(domain);
    for (const prefixId of domain.prefixes) {
      graph.addEdge("contains", domain.id, prefixId);
    }
  }

  // ── Consumer 등록 ──────────────────────────────────────
  const consumers = config.consumers;
  for (const consumer of consumers) {
    graph.addNode(consumer);
    for (const domain of domains) {
      const overlap = consumer.intendedPrefixes.filter(p => domain.prefixes.includes(p));
      if (overlap.length > 0) {
        graph.addEdge("consumes", consumer.id, domain.id);
      }
    }
  }

  // ── Constraint 등록 ──────────────────────────────────────
  for (const constraint of config.constraints) {
    graph.addNode(constraint);
    for (const target of constraint.scope) {
      graph.addEdge("constrains", constraint.id, target);
    }
  }

  // ── DslBundle 등록 ──────────────────────────────────────
  const dslBundles = config.dslBundles;
  for (const bundle of dslBundles) {
    graph.addNode(bundle);
    for (const prefixId of bundle.memberPrefixes) {
      graph.addEdge("contains", bundle.id, prefixId);
    }
    graph.addEdge("binds", bundle.id, bundle.serviceBindingPrefix);
  }

  // ── IntentLink 등록 ──────────────────────────────────────
  for (const link of config.intentLinks) {
    graph.addNode(link);
    for (const endpoint of link.endpoints) {
      graph.addEdge("binds", link.id, endpoint);
    }
  }

  // ── FlowSchema 등록 + 자동 관계 생성 ─────────────────────
  const flowSchemas = config.flowSchemas ?? [];
  const flowSchemaMap = new Map(flowSchemas.map((entry) => [entry.schema.id, entry.schema]));
  const flowSchemaTotalPaths = new Map<string, number>();

  for (const entry of flowSchemas) {
    const schema = entry.schema as FlowSchema;
    const gateProfiles = analyzeGateStructure(schema);
    const node: FlowSchemaNode = {
      kind: "flow-schema",
      id: schema.id,
      name: schema.name,
      version: schema.version,
      gates: schema.gates.map((gate) => ({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        weight: gate.weight ?? "tactical",
      })),
      totalPaths: resolveFlowSchemaTotalPaths(schema.id, flowSchemaMap, flowSchemaTotalPaths, new Set()),
      coreGateIds: identifyCoreGates(gateProfiles).map((profile) => profile.gateId),
    };
    graph.addNode(node);
  }

  for (const entry of flowSchemas) {
    const observedPrefixIds = dedupeIds(entry.observedPrefixIds ?? []);
    const axisIds = dedupeIds([
      ...deriveAxisIdsFromObservedPrefixes(catalog, observedPrefixIds),
      ...(entry.axisIds ?? []),
    ]);
    const domainId = entry.domainId ?? inferFlowSchemaDomainId(domains, observedPrefixIds);
    const subFlowIds = dedupeIds(
      entry.schema.gates.flatMap((gate: FlowSchema["gates"][number]) => (gate.subFlowId ? [gate.subFlowId] : [])),
    );

    attachFlowSchemaEdges(graph, {
      flowSchemaId: entry.schema.id,
      axisIds,
      observedPrefixIds,
      domainId,
      subFlowIds,
    });
  }

  // ── Headroom Decision 자동 생성 ────────────────────────
  const axisData = Object.entries(catalog.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    const entries = latest.entries.length;
    const capacity = latest.capacity ?? entries;
    return { id, name: axis.name, entries, capacity };
  });

  const headroomReport = analyzeHeadroom(axisData, { date, graph });
  applyHeadroomDecisions(graph, headroomReport);

  // ── 알려진 분리 유지 기록 ────────────────────────────────
  const entriesMap = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    entriesMap.set(id, [...latest.entries]);
  }

  const overlaps = scanAxisOverlaps(graph, entriesMap);
  for (const overlap of overlaps) {
    if (overlap.recommendation === "merge" && overlap.overlapRatio >= 0.9) {
      const record = recordSeparation(overlap, {
        id: `DEC-SEP-${overlap.a}-${overlap.b}`,
        date,
        rationale: `${overlap.a}(${getUsedBy(graph, overlap.a)})와 ${overlap.b}(${getUsedBy(graph, overlap.b)})는 entries가 동일하지만 다른 도메인 컨텍스트에서 사용된다. 향후 분기 가능성이 있으므로 분리 유지.`,
      });
      applySeparationRecord(graph, record);
    }
    const pairKey = [overlap.a, overlap.b].toSorted().join(":");
    if (pairKey === "migration_pattern:verdict_result") {
      const dec: DecisionNode = {
        kind: "decision", id: "DEC-SEP-verdict-migration", date,
        title: "verdict_result와 migration_pattern의 'unknown' 공유 수용",
        context: `두 축이 '${overlap.sharedEntries.join(",")}' entry를 공유 (${(overlap.overlapRatio * 100).toFixed(0)}%)`,
        rationale: "'unknown'은 범용 예약어로 두 축에서 독립적으로 사용됨. verdict의 unknown은 '판정 불가', migration의 unknown은 '패턴 미식별'. 의미가 다르므로 분리 유지.",
        lifecycle: "active",
      };
      graph.addNode(dec);
      graph.addEdge("justifies", dec.id, "verdict_result");
      graph.addEdge("justifies", dec.id, "migration_pattern");
    }
  }

  // ── Prefix 구조 유사도 review → 분리 유지 Decision ────────
  const prefixIds = Object.keys(catalog.prefixes);
  const reviewPairs = config.reviewPairs ?? [];

  for (const pair of reviewPairs) {
    if (prefixIds.includes(pair.a) && prefixIds.includes(pair.b)) {
      const sim = comparePrefixes(graph, pair.a, pair.b);
      if (sim.recommendation === "review") {
        const dec: DecisionNode = {
          kind: "decision", id: `DEC-SEP-${pair.a}-${pair.b}`, date,
          title: `${pair.a}과 ${pair.b} 분리 유지`,
          context: `구조 유사도 ${(sim.structuralSimilarity * 100).toFixed(0)}%: ${sim.sharedAxes.join(",")} 축 공유`,
          rationale: pair.reason,
          lifecycle: "active",
        };
        graph.addNode(dec);
        graph.addEdge("justifies", dec.id, pair.a);
        graph.addEdge("justifies", dec.id, pair.b);
      }
    }
  }

  // ── DSL 버전 스큐 분석 → Observation + Decision 자동 생성 ──
  const dslRegistry = new DslBundleRegistry();
  for (const bundle of dslBundles) {
    dslRegistry.register(
      defineDslBundle(catalog, {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        serviceBinding: { prefixId: bundle.serviceBindingPrefix, fixedDims: [...bundle.fixedDims] },
        members: bundle.memberPrefixes.map(p => ({ prefixId: p, role: "observation" as const })),
      }),
    );
  }

  const skewReports = analyzeAllVersionSkew(catalog, dslRegistry);
  for (const report of skewReports) {
    // severity ok → 이전 OBS-SKEW가 있으면 자동 해소
    if (report.severity === "ok") {
      const obsId = `OBS-SKEW-${report.bundleId}`;
      const existingObs = (existing?.getNode(obsId) ?? graph.getNode(obsId)) as ObservationNode | undefined;
      if (existingObs?.kind === "observation" && !existingObs.resolution) {
        graph.addNode({
          ...existingObs,
          resolution: {
            decisionId: `DEC-SKEW-${report.bundleId}`,
            outcome: "accepted",
            note: `severity ok로 복귀하여 자동 해소 (${date})`,
          },
        } as ObservationNode);
      }
      continue;
    }

    // 이미 resolved된 observation은 재생성하지 않음 (refresh 안정성)
    const obsId = `OBS-SKEW-${report.bundleId}`;
    const existingObs = (existing?.getNode(obsId) ?? graph.getNode(obsId)) as ObservationNode | undefined;
    if (existingObs?.kind === "observation" && existingObs.resolution) continue;

    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-SKEW-${report.bundleId}`,
      date,
      source: "metric",
      subjects: [report.bundleId, ...report.members.map(m => m.prefixId)],
      finding: report.summary,
      suggestion: report.axisConflicts.length > 0
        ? { kind: "revise-decision", decisionId: report.bundleId, reason: `축 버전 충돌 ${report.axisConflicts.length}건: ${report.axisConflicts.map(c => c.axisId).join(", ")}` }
        : undefined,
    };
    graph.addNode(obs);
    graph.addEdge("observes", obs.id, report.bundleId);
    for (const member of report.members) {
      graph.addEdge("observes", obs.id, member.prefixId);
    }

    const slowMembers = report.members.filter(m => m.versionCount === 1).map(m => m.prefixId);
    const fastMembers = report.members.filter(m => m.versionCount > 1).map(m => `${m.prefixId}(${m.versionCount}v)`);
    const isMinor = report.severity === "minor";
    const dec: DecisionNode = {
      kind: "decision",
      id: `DEC-SKEW-${report.bundleId}`,
      date,
      title: `${report.bundleId} 버전 ${isMinor ? "격차 수용" : "정렬 필요"}`,
      context: report.summary,
      rationale: isMinor
        ? `${fastMembers.join(",")}이 빠르게 진화했지만, 느린 멤버(${slowMembers.join(",")})는 아직 변경 사유 없음. 현재 격차(${report.maxVersionSpread})는 호환 범위 내이므로 수용. 느린 멤버에 변경 사유 발생 시 자연스럽게 해소.`
        : `${fastMembers.join(",")}이 빠르게 진화한 반면 ${slowMembers.join(",")}은 v1 유지. 동일 DSL 내 버전 격차 ${report.maxVersionSpread}. 멤버 간 호환성 검증 필요.`,
      alternatives: [
        `느린 멤버(${slowMembers.join(",")})에 v2 생성하여 격차 해소`,
        "DSL 번들에서 버전 핀 명시 (minVersion 제약)",
        "현재 상태 유지 — 격차를 수용하고 호환성만 확인",
      ],
      reversalConditions: isMinor
        ? [`격차가 4 이상으로 확대되면 재검토`]
        : undefined,
      lifecycle: isMinor ? "active" : "active",
    };
    graph.addNode(dec);
    graph.addEdge("prompts", obs.id, dec.id);
    graph.addEdge("justifies", dec.id, report.bundleId);
    for (const prefixId of slowMembers) {
      graph.addEdge("governs", dec.id, prefixId);
    }
  }

  // DSL 커버리지 분석 → uncovered prefix Observation
  const dslCoverage = analyzeDslCoverage(catalog, dslRegistry);
  if (dslCoverage.uncovered.length > 0) {
    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-DSL-UNCOVERED",
      date,
      source: "metric",
      subjects: dslCoverage.uncovered as string[],
      finding: `DSL에 포함되지 않은 prefix ${dslCoverage.uncovered.length}개: ${dslCoverage.uncovered.join(", ")}`,
      suggestion: { kind: "add-constraint", rule: "모든 관측/이벤트 prefix는 DSL 번들에 포함되어야 한다" },
    };
    graph.addNode(obs);
    for (const prefixId of dslCoverage.uncovered) {
      if (graph.getNode(prefixId)) {
        graph.addEdge("observes", obs.id, prefixId);
      }
    }
  }

  // ── Spec 노드 등록 ───────────────────────────────────────
  const specs = config.specs ?? [];
  for (const spec of specs) {
    graph.addNode(spec);
    // governs 엣지: spec의 governs 필드에서
    if (Array.isArray(spec.governs)) {
      for (const target of spec.governs) {
        graph.addEdge("governs", spec.id, target);
      }
    }
  }

  // ── Skill 노드 등록 ──────────────────────────────────────
  for (const skill of config.skills) {
    graph.addNode(skill);
    if (skill.depends) {
      for (const depId of skill.depends) {
        graph.addEdge("depends-on", skill.id, depId);
      }
    }
  }

  // ── Decision 노드 등록 (config 정의분) ─────────────────
  const configDecisions = config.decisions ?? [];
  for (const decision of configDecisions) {
    graph.addNode(decision);
    // DEC-NEW-AXIS-{axisId} → justifies → axisId (축 신설 근거 연결)
    if (decision.id.startsWith("DEC-NEW-AXIS-")) {
      const axisId = decision.id.replace("DEC-NEW-AXIS-", "");
      if (graph.getNode(axisId)) {
        graph.addEdge("justifies", decision.id, axisId);
      }
    }
  }

  // ── TransitionSpec 노드 등록 ───────────────────────────
  // config.transitionSpecs (직접 정의) + options.transitionSpecs (자동 변환) 병합
  const configTspecs = config.transitionSpecs ?? [];
  const derivedTspecs = options.transitionSpecs ? toTransitionSpecNodes(options.transitionSpecs) : [];
  const seenTspecIds = new Set<string>();
  const allTspecs = [...configTspecs, ...derivedTspecs].filter(t => {
    if (seenTspecIds.has(t.id)) return false;
    seenTspecIds.add(t.id);
    return true;
  });
  for (const tspec of allTspecs) {
    graph.addNode(tspec);
    for (const slotRef of tspec.slotRefs) {
      if (graph.getNode(slotRef)) {
        graph.addEdge("consumes", tspec.id, slotRef);
      }
    }
  }

  // ── TransitionSpec 간 상태 의존 + DSL satisfies ──────
  if (allTspecs.length > 0) {
    for (const edge of deriveInterSpecEdges(allTspecs)) {
      graph.addEdge(edge.type, edge.from, edge.to, edge.meta);
    }
    for (const edge of deriveDslSatisfiesEdges(allTspecs, graph)) {
      graph.addEdge(edge.type, edge.from, edge.to, edge.meta);
    }

    // CON-EFFECT-VOCAB: effect kind 정규 vocabulary 제약
    const effectConstraint: ConstraintNode = {
      kind: "constraint",
      id: "CON-EFFECT-VOCAB",
      rule: "transition effect kind는 정규 vocabulary만 허용 (create/update/move/consume/open/close). 새 effect 추가 시 DKG Decision 필수.",
      scope: allTspecs.map(t => t.id),
      lifecycle: "active",
    };
    graph.addNode(effectConstraint);
    for (const tspec of allTspecs) {
      graph.addEdge("constrains", effectConstraint.id, tspec.id);
    }
  }

  return graph;
}

function getUsedBy(graph: GraphRegistry, axisId: string): string {
  const prefixes = graph.reverseNeighbors(axisId, "composes");
  return prefixes.join(",") || "미사용";
}

function dedupeIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function deriveAxisIdsFromObservedPrefixes(
  catalog: Catalog,
  prefixIds: readonly string[],
): string[] {
  const axisIds = new Set<string>();

  for (const prefixId of prefixIds) {
    const prefix = catalog.prefixes[prefixId];
    const latest = prefix?.versions[prefix.versions.length - 1];
    if (!prefix || !latest) continue;

    for (const label of prefix.labels) {
      const dim = prefix.dims[label];
      if (dim?.kind === "axis") {
        axisIds.add(dim.axisId);
      }
    }
  }

  return [...axisIds];
}

function inferFlowSchemaDomainId(
  domains: readonly DomainNode[],
  observedPrefixIds: readonly string[],
): string | undefined {
  if (observedPrefixIds.length === 0) return undefined;

  const exactMatch = domains.find((domain) =>
    observedPrefixIds.every((prefixId) => domain.prefixes.includes(prefixId)),
  );
  if (exactMatch) return exactMatch.id;

  const partialMatch = domains.find((domain) =>
    observedPrefixIds.some((prefixId) => domain.prefixes.includes(prefixId)),
  );
  return partialMatch?.id;
}

function resolveFlowSchemaTotalPaths(
  schemaId: string,
  schemas: ReadonlyMap<string, FlowSchema>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(schemaId);
  if (cached !== undefined) return cached;
  if (visiting.has(schemaId)) {
    throw new Error(`FlowSchema subFlow cycle detected: ${schemaId}`);
  }

  const schema = schemas.get(schemaId);
  if (!schema) {
    throw new Error(`FlowSchema "${schemaId}" not found in DkgConfig.flowSchemas`);
  }

  visiting.add(schemaId);

  let totalPaths = 1;
  for (const gate of schema.gates) {
    if (gate.subFlowId) {
      totalPaths *= resolveFlowSchemaTotalPaths(gate.subFlowId, schemas, memo, visiting);
      continue;
    }

    totalPaths *= gate.branches?.length ?? 0;
  }

  visiting.delete(schemaId);
  memo.set(schemaId, totalPaths);
  return totalPaths;
}
