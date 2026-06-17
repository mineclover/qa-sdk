// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * DKG 초기 부트스트랩 — 카탈로그 파생 + 설정 기반 메타데이터 등록.
 *
 * logic tier enrichment(dkg-enrichment) 전 Base 단계.
 */

import type { Catalog } from "@qa-sdk/core";
import { GraphRegistry } from "./graph-registry.js";
import { deriveFromCatalog } from "./catalog-derive.js";
import type { ConstraintNode, ObservationNode } from "./dkg.types.js";
import { toTransitionSpecNodes, deriveInterSpecEdges, deriveDslSatisfiesEdges } from "./dkg-bridge.js";
import { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeAllVersionSkew } from "./dsl-bundle.js";
import type { BootstrapDkgOptions } from "./bootstrap-types.js";

export type { BootstrapDkgOptions, DkgConfigInput, FlowSchemaEntry } from "./bootstrap-types.js";

/**
 * catalog 파생 + config 노드(IntentLink까지) 등록.
 * flow schema / headroom / overlap enrichment는 dkg-enrichment에서 수행.
 */
export function bootstrapDkgBase(options: BootstrapDkgOptions): GraphRegistry {
  const catalog = options.catalog;
  const config = options.config;

  const graph = deriveFromCatalog(catalog);

  const domains = config.domains;
  for (const domain of domains) {
    graph.addNode(domain);
    for (const prefixId of domain.prefixes) {
      graph.addEdge("contains", domain.id, prefixId);
    }
  }

  for (const consumer of config.consumers) {
    graph.addNode(consumer);
    for (const domain of domains) {
      const overlap = consumer.intendedPrefixes.filter((p) => domain.prefixes.includes(p));
      if (overlap.length > 0) {
        graph.addEdge("consumes", consumer.id, domain.id);
      }
    }
  }

  for (const constraint of config.constraints) {
    graph.addNode(constraint);
    for (const target of constraint.scope) {
      graph.addEdge("constrains", constraint.id, target);
    }
  }

  const dslBundles = config.dslBundles;
  for (const bundle of dslBundles) {
    graph.addNode(bundle);
    for (const prefixId of bundle.memberPrefixes) {
      graph.addEdge("contains", bundle.id, prefixId);
    }
    graph.addEdge("binds", bundle.id, bundle.serviceBindingPrefix);
  }

  for (const link of config.intentLinks) {
    graph.addNode(link);
    for (const endpoint of link.endpoints) {
      graph.addEdge("binds", link.id, endpoint);
    }
  }

  return graph;
}

/**
 * DSL skew / spec / skill / transition spec 등록 — enrichment 이후 호출.
 */
export function bootstrapDkgFinalize(
  graph: GraphRegistry,
  options: BootstrapDkgOptions,
): GraphRegistry {
  const catalog = options.catalog;
  const config = options.config;
  const date = options.date ?? "2026-03-20";
  const existing = options.existingGraph;
  const dslBundles = config.dslBundles;

  const dslRegistry = new DslBundleRegistry();
  for (const bundle of dslBundles) {
    dslRegistry.register(
      defineDslBundle(catalog, {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        serviceBinding: { prefixId: bundle.serviceBindingPrefix, fixedDims: [...bundle.fixedDims] },
        members: bundle.memberPrefixes.map((p) => ({ prefixId: p, role: "observation" as const })),
      }),
    );
  }

  const skewReports = analyzeAllVersionSkew(catalog, dslRegistry);
  for (const report of skewReports) {
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

    const obsId = `OBS-SKEW-${report.bundleId}`;
    const existingObs = (existing?.getNode(obsId) ?? graph.getNode(obsId)) as ObservationNode | undefined;
    if (existingObs?.kind === "observation" && existingObs.resolution) continue;

    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-SKEW-${report.bundleId}`,
      date,
      source: "metric",
      subjects: [report.bundleId, ...report.members.map((m) => m.prefixId)],
      finding: report.summary,
      suggestion: report.axisConflicts.length > 0
        ? { kind: "revise-decision", decisionId: report.bundleId, reason: `축 버전 충돌 ${report.axisConflicts.length}건: ${report.axisConflicts.map((c) => c.axisId).join(", ")}` }
        : undefined,
    };
    graph.addNode(obs);
    graph.addEdge("observes", obs.id, report.bundleId);
    for (const member of report.members) {
      graph.addEdge("observes", obs.id, member.prefixId);
    }

    const slowMembers = report.members.filter((m) => m.versionCount === 1).map((m) => m.prefixId);
    const fastMembers = report.members.filter((m) => m.versionCount > 1).map((m) => `${m.prefixId}(${m.versionCount}v)`);
    const isMinor = report.severity === "minor";
    const dec = {
      kind: "decision" as const,
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
      reversalConditions: isMinor ? [`격차가 4 이상으로 확대되면 재검토`] : undefined,
      lifecycle: "active" as const,
    };
    graph.addNode(dec);
    graph.addEdge("prompts", obs.id, dec.id);
    graph.addEdge("justifies", dec.id, report.bundleId);
    for (const prefixId of slowMembers) {
      graph.addEdge("governs", dec.id, prefixId);
    }
  }

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

  for (const spec of config.specs ?? []) {
    graph.addNode(spec);
    if (Array.isArray(spec.governs)) {
      for (const target of spec.governs) {
        graph.addEdge("governs", spec.id, target);
      }
    }
  }

  for (const skill of config.skills) {
    graph.addNode(skill);
    if (skill.depends) {
      for (const depId of skill.depends) {
        graph.addEdge("depends-on", skill.id, depId);
      }
    }
  }

  for (const decision of config.decisions ?? []) {
    graph.addNode(decision);
    if (decision.id.startsWith("DEC-NEW-AXIS-")) {
      const axisId = decision.id.replace("DEC-NEW-AXIS-", "");
      if (graph.getNode(axisId)) {
        graph.addEdge("justifies", decision.id, axisId);
      }
    }
  }

  const configTspecs = config.transitionSpecs ?? [];
  const derivedTspecs = options.transitionSpecs ? toTransitionSpecNodes(options.transitionSpecs) : [];
  const seenTspecIds = new Set<string>();
  const allTspecs = [...configTspecs, ...derivedTspecs].filter((t) => {
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

  if (allTspecs.length > 0) {
    for (const edge of deriveInterSpecEdges(allTspecs)) {
      graph.addEdge(edge.type, edge.from, edge.to, edge.meta);
    }
    for (const edge of deriveDslSatisfiesEdges(allTspecs, graph)) {
      graph.addEdge(edge.type, edge.from, edge.to, edge.meta);
    }

    const effectConstraint: ConstraintNode = {
      kind: "constraint",
      id: "CON-EFFECT-VOCAB",
      rule: "transition effect kind는 정규 vocabulary만 허용 (create/update/move/consume/open/close). 새 effect 추가 시 DKG Decision 필수.",
      scope: allTspecs.map((t) => t.id),
      lifecycle: "active",
    };
    graph.addNode(effectConstraint);
    for (const tspec of allTspecs) {
      graph.addEdge("constrains", effectConstraint.id, tspec.id);
    }
  }

  return graph;
}
