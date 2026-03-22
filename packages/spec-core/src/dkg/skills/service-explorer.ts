/**
 * service-explorer — 서비스/prefix/DSL/시스템 전체 탐색 skill.
 *
 * 4종의 탐색 함수:
 *   1. exploreService — 서비스 단위 전체 프로파일
 *   2. explorePrefix — prefix 단위 심층 프로파일
 *   3. exploreDsl — DSL 번들 프로파일
 *   4. systemOverview — 시스템 대시보드
 */

import type { Catalog } from "@qa-sdk/core";
import type { GraphPort } from "../../shared/graph-port.js";
import type { ServiceTopologyRegistry, SharedContract, DependencyGraph } from "../service-topology.js";
import { buildDependencyGraph } from "../service-topology.js";
import { checkAllDomainsHealth, type DomainHealthResult } from "./domain-health.js";
import type {
  AxisNode,
  PrefixNode,
  DomainNode,
  DslBundleNode,
  ObservationNode,
  DecisionNode,
  ConstraintNode,
} from "../dkg.types.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

// ── ServiceProfile ──

export interface OwnedPrefixInfo {
  readonly id: string;
  readonly category: string;
  readonly dimCount: number;
  readonly minHeadroom: { axis: string; headroom: number } | null;
}

export interface ConsumedPrefixInfo {
  readonly id: string;
  readonly contract: string | null;
}

export interface ServiceDependency {
  readonly serviceId: string;
  readonly direction: "depends-on" | "depended-by";
  readonly via: readonly string[];
}

export interface ServiceProfile {
  readonly serviceId: string;
  readonly name: string;
  readonly team: string | undefined;
  readonly status: string;
  readonly ownedPrefixes: readonly OwnedPrefixInfo[];
  readonly consumedPrefixes: readonly ConsumedPrefixInfo[];
  readonly contracts: readonly SharedContract[];
  readonly dslBindings: readonly string[];
  readonly dependencies: readonly ServiceDependency[];
  readonly observations: readonly { id: string; finding: string }[];
  readonly decisions: readonly { id: string; title: string }[];
}

// ── PrefixProfile ──

export interface PrefixDimInfo {
  readonly label: string;
  readonly kind: "axis" | "prefix_ref" | "table_ref";
  readonly ref: string; // axisId, prefixId, or table
}

export interface AxisHeadroom {
  readonly axisId: string;
  readonly entries: number;
  readonly capacity: number;
  readonly headroom: number;
}

export interface PrefixProfile {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly lifecycle: string;
  readonly dimensions: readonly PrefixDimInfo[];
  readonly headroom: readonly AxisHeadroom[];
  readonly owner: string | null;
  readonly consumers: readonly string[];
  readonly domains: readonly string[];
  readonly dslBundles: readonly string[];
  readonly constraints: readonly { id: string; rule: string }[];
  readonly observations: readonly { id: string; finding: string }[];
  readonly decisions: readonly { id: string; title: string }[];
  readonly intentLinks: readonly { id: string; intent: string }[];
}

// ── DslProfile ──

export interface DslMemberInfo {
  readonly prefixId: string;
  readonly role: string;
  readonly svcRefLabel: string | undefined;
}

export interface DslProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly members: readonly DslMemberInfo[];
  readonly serviceBinding: { prefixId: string; fixedDims: readonly string[] };
  readonly invariants: readonly string[];
  readonly versionSkew: {
    severity: string;
    summary: string;
    axisConflicts: readonly { axisId: string; spread: number }[];
  };
}

// ── SystemOverview ──

export interface ServiceSummary {
  readonly serviceId: string;
  readonly name: string;
  readonly status: string;
  readonly ownedCount: number;
  readonly consumedCount: number;
}

export interface HotSpot {
  readonly type: "headroom-zero" | "constraint-violation" | "observation";
  readonly target: string;
  readonly detail: string;
}

export interface DependencyGraphSummary {
  readonly roots: readonly string[];
  readonly leaves: readonly string[];
  readonly cycles: readonly string[][];
  readonly maxDepth: number;
  readonly edgeCount: number;
}

export interface DomainHealthSummary {
  readonly domainId: string;
  readonly health: string;
  readonly issueCount: number;
}

export interface SystemOverview {
  readonly services: readonly ServiceSummary[];
  readonly hotSpots: readonly HotSpot[];
  readonly dependencyGraph: DependencyGraphSummary;
  readonly domainHealth: readonly DomainHealthSummary[];
  readonly nodeCount: number;
  readonly edgeCount: number;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function getAxisHeadroom(catalog: Catalog, axisId: string): AxisHeadroom | null {
  const axis = catalog.axes[axisId];
  if (!axis) return null;
  const versions = Object.keys(axis.versions);
  const latest = axis.versions[versions[versions.length - 1]];
  if (!latest) return null;
  const entries = latest.entries.length;
  const capacity = latest.capacity ?? entries;
  return { axisId, entries, capacity, headroom: capacity - entries };
}

function getMinHeadroom(
  catalog: Catalog,
  prefixId: string,
): OwnedPrefixInfo["minHeadroom"] {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) return null;

  let min: { axis: string; headroom: number } | null = null;
  for (const [, dimRef] of Object.entries(prefix.dims)) {
    if (dimRef.kind !== "axis") continue;
    const hr = getAxisHeadroom(catalog, dimRef.axisId);
    if (!hr) continue;
    if (min === null || hr.headroom < min.headroom) {
      min = { axis: hr.axisId, headroom: hr.headroom };
    }
  }
  return min;
}

// ═══════════════════════════════════════════════════════════════
//  1. exploreService
// ═══════════════════════════════════════════════════════════════

export function exploreService(
  graph: GraphPort,
  topo: ServiceTopologyRegistry,
  catalog: Catalog,
  serviceId: string,
): ServiceProfile | null {
  const services = topo.listServices();
  const svc = services.find(s => s.serviceId === serviceId);
  if (!svc) return null;

  // owned prefixes
  const ownedPrefixes: OwnedPrefixInfo[] = svc.ownedPrefixes.map(pid => {
    const node = graph.getNode(pid) as PrefixNode | undefined;
    return {
      id: pid,
      category: node?.category ?? "unknown",
      dimCount: node?.dimLabels.length ?? 0,
      minHeadroom: getMinHeadroom(catalog, pid),
    };
  });

  // consumed prefixes + contracts
  const allContracts = getAllContracts(topo);
  const consumedPrefixes: ConsumedPrefixInfo[] = svc.consumedPrefixes.map(pid => {
    const contract = allContracts.find(
      c => c.prefixId === pid && c.consumers.includes(serviceId),
    );
    return { id: pid, contract: contract?.id ?? null };
  });

  // contracts (as provider or consumer)
  const contracts = allContracts.filter(
    c => c.provider === serviceId || c.consumers.includes(serviceId),
  );

  // dependencies
  const depGraph = buildDependencyGraph(topo);
  const dependencies: ServiceDependency[] = [];
  for (const edge of depGraph.edges) {
    if (edge.from === serviceId) {
      dependencies.push({ serviceId: edge.to, direction: "depends-on", via: edge.via });
    }
    if (edge.to === serviceId) {
      dependencies.push({ serviceId: edge.from, direction: "depended-by", via: edge.via });
    }
  }

  // related observations/decisions via owned prefixes
  const observations: { id: string; finding: string }[] = [];
  const decisions: { id: string; title: string }[] = [];
  const seenObs = new Set<string>();
  const seenDec = new Set<string>();

  for (const pid of svc.ownedPrefixes) {
    // observations → prefix
    for (const edge of graph.edgesTo(pid, "observes")) {
      if (!seenObs.has(edge.from)) {
        seenObs.add(edge.from);
        const node = graph.getNode(edge.from) as ObservationNode | undefined;
        if (node) observations.push({ id: node.id, finding: node.finding });
      }
    }
    // decisions → prefix (governs/justifies)
    for (const type of ["governs", "justifies"] as const) {
      for (const edge of graph.edgesTo(pid, type)) {
        if (!seenDec.has(edge.from)) {
          seenDec.add(edge.from);
          const node = graph.getNode(edge.from) as DecisionNode | undefined;
          if (node) decisions.push({ id: node.id, title: node.title });
        }
      }
    }
  }

  return {
    serviceId: svc.serviceId,
    name: svc.name,
    team: svc.team,
    status: svc.status,
    ownedPrefixes,
    consumedPrefixes,
    contracts,
    dslBindings: [...svc.dslBindings],
    dependencies,
    observations,
    decisions,
  };
}

// ═══════════════════════════════════════════════════════════════
//  2. explorePrefix
// ═══════════════════════════════════════════════════════════════

export function explorePrefix(
  graph: GraphPort,
  topo: ServiceTopologyRegistry,
  catalog: Catalog,
  prefixId: string,
): PrefixProfile | null {
  const node = graph.getNode(prefixId) as PrefixNode | undefined;
  if (!node || node.kind !== "prefix") return null;

  const prefix = catalog.prefixes[prefixId];

  // dimensions
  const dimensions: PrefixDimInfo[] = prefix
    ? Object.entries(prefix.dims).map(([label, dimRef]) => ({
        label,
        kind: dimRef.kind,
        ref: dimRef.kind === "axis"
          ? dimRef.axisId
          : dimRef.kind === "prefix_ref"
            ? dimRef.prefixId
            : (dimRef as { table: string }).table,
      }))
    : [];

  // headroom (axis dims only)
  const headroom: AxisHeadroom[] = [];
  if (prefix) {
    for (const dimRef of Object.values(prefix.dims)) {
      if (dimRef.kind === "axis") {
        const hr = getAxisHeadroom(catalog, dimRef.axisId);
        if (hr) headroom.push(hr);
      }
    }
  }

  // owner/consumers
  const owner = topo.getOwner(prefixId) ?? null;
  const consumers = topo.getConsumers(prefixId);

  // domains + dsl bundles (같은 "contains" edge에서 kind로 분류)
  const domainEdges = graph.edgesTo(prefixId, "contains");
  const domains: string[] = [];
  const dslBundles: string[] = [];
  for (const edge of domainEdges) {
    const dn = graph.getNode(edge.from);
    if (dn?.kind === "domain") domains.push(dn.id);
    else if (dn?.kind === "dsl-bundle") dslBundles.push(dn.id);
  }

  // constraints
  const constraintEdges = graph.edgesTo(prefixId, "constrains");
  const constraints: { id: string; rule: string }[] = [];
  for (const edge of constraintEdges) {
    const cn = graph.getNode(edge.from) as ConstraintNode | undefined;
    if (cn?.kind === "constraint") constraints.push({ id: cn.id, rule: cn.rule });
  }

  // observations
  const obsEdges = graph.edgesTo(prefixId, "observes");
  const observations: { id: string; finding: string }[] = [];
  for (const edge of obsEdges) {
    const on = graph.getNode(edge.from) as ObservationNode | undefined;
    if (on?.kind === "observation") observations.push({ id: on.id, finding: on.finding });
  }

  // decisions
  const decisions: { id: string; title: string }[] = [];
  for (const type of ["governs", "justifies"] as const) {
    for (const edge of graph.edgesTo(prefixId, type)) {
      const dn = graph.getNode(edge.from) as DecisionNode | undefined;
      if (dn?.kind === "decision") decisions.push({ id: dn.id, title: dn.title });
    }
  }

  // intent-links
  const intentLinks = graph.intentLinksFor(prefixId);

  return {
    id: prefixId,
    name: node.name,
    category: node.category ?? "unknown",
    lifecycle: node.lifecycle ?? "active",
    dimensions,
    headroom,
    owner,
    consumers,
    domains,
    dslBundles,
    constraints,
    observations,
    decisions,
    intentLinks,
  };
}

// ═══════════════════════════════════════════════════════════════
//  3. exploreDsl
// ═══════════════════════════════════════════════════════════════

export function exploreDsl(
  graph: GraphPort,
  catalog: Catalog,
  dslId: string,
): DslProfile | null {
  const node = graph.getNode(dslId) as DslBundleNode | undefined;
  if (!node || node.kind !== "dsl-bundle") return null;

  // members with role info — reconstruct from graph edges
  const memberPrefixIds = graph.neighbors(dslId, "contains");
  const members: DslMemberInfo[] = memberPrefixIds.map(pid => {
    const prefix = catalog.prefixes[pid];
    let svcRefLabel: string | undefined;
    if (prefix) {
      for (const [label, dimRef] of Object.entries(prefix.dims)) {
        if (dimRef.kind === "prefix_ref" && dimRef.prefixId === node.serviceBindingPrefix) {
          svcRefLabel = label;
          break;
        }
      }
    }
    // Infer role from prefix category
    const pNode = graph.getNode(pid) as PrefixNode | undefined;
    const cat = pNode?.category ?? "unknown";
    let role: string;
    if (cat === "observation") role = "observation";
    else if (cat === "event") role = "event";
    else if (cat === "policy") role = "infra";
    else if (cat === "entity" && pid === node.serviceBindingPrefix) role = "context";
    else role = "observation";

    return { prefixId: pid, role, svcRefLabel };
  });

  // version skew — analyze from catalog
  const axisVersionMap = new Map<string, Map<string, string>>();
  for (const pid of memberPrefixIds) {
    const prefix = catalog.prefixes[pid];
    if (!prefix || prefix.versions.length === 0) continue;
    const latest = prefix.versions[prefix.versions.length - 1];
    for (const [label, axisVer] of Object.entries(latest.axisVersions)) {
      const dimRef = prefix.dims[label];
      if (!dimRef || dimRef.kind !== "axis") continue;
      const axisId = dimRef.axisId;
      if (!axisVersionMap.has(axisId)) axisVersionMap.set(axisId, new Map());
      axisVersionMap.get(axisId)!.set(pid, axisVer);
    }
  }

  const axisConflicts: { axisId: string; spread: number }[] = [];
  for (const [axisId, prefixVersions] of axisVersionMap) {
    const uniqueVersions = new Set(prefixVersions.values());
    if (uniqueVersions.size > 1) {
      const nums = [...uniqueVersions].map(v => parseInt(v.replace(/\D/g, ""), 10) || 0);
      axisConflicts.push({ axisId, spread: Math.max(...nums) - Math.min(...nums) });
    }
  }

  const severity = axisConflicts.some(c => c.spread >= 3)
    ? "major"
    : axisConflicts.length > 0
      ? "minor"
      : "ok";

  const summary = axisConflicts.length > 0
    ? `축 버전 충돌 ${axisConflicts.length}건: ${axisConflicts.map(c => `${c.axisId}(spread=${c.spread})`).join(", ")}`
    : "버전 스큐 없음";

  return {
    id: node.id,
    name: node.name,
    description: node.description,
    members,
    serviceBinding: {
      prefixId: node.serviceBindingPrefix,
      fixedDims: [...node.fixedDims],
    },
    invariants: node.invariants ? [...node.invariants] : [],
    versionSkew: { severity, summary, axisConflicts },
  };
}

// ═══════════════════════════════════════════════════════════════
//  4. systemOverview
// ═══════════════════════════════════════════════════════════════

export function systemOverview(
  graph: GraphPort,
  topo: ServiceTopologyRegistry,
  catalog: Catalog,
): SystemOverview {
  // services
  const allServices = topo.listServices();
  const services: ServiceSummary[] = allServices.map(s => ({
    serviceId: s.serviceId,
    name: s.name,
    status: s.status,
    ownedCount: s.ownedPrefixes.length,
    consumedCount: s.consumedPrefixes.length,
  }));

  // hot spots
  const hotSpots: HotSpot[] = [];

  // headroom=0 axes
  for (const [axisId, axis] of Object.entries(catalog.axes)) {
    const hr = getAxisHeadroom(catalog, axisId);
    if (hr && hr.headroom === 0) {
      hotSpots.push({
        type: "headroom-zero",
        target: axisId,
        detail: `${axis.name}: entries=${hr.entries}, capacity=${hr.capacity}`,
      });
    }
  }

  // active constraints with violations — check constraint nodes
  const constraints = graph.getNodesByKind("constraint") as ConstraintNode[];
  for (const c of constraints) {
    if (c.lifecycle !== "active") continue;
    // Check if there are observations about this constraint
    const obsEdges = graph.edgesTo(c.id, "observes");
    for (const edge of obsEdges) {
      const obs = graph.getNode(edge.from) as ObservationNode | undefined;
      if (obs) {
        hotSpots.push({
          type: "constraint-violation",
          target: c.id,
          detail: obs.finding,
        });
      }
    }
  }

  // active observations
  const observations = graph.getNodesByKind("observation") as ObservationNode[];
  for (const obs of observations) {
    if (obs.suggestion && !obs.resolution) {
      hotSpots.push({
        type: "observation",
        target: obs.id,
        detail: obs.finding.slice(0, 80),
      });
    }
  }

  // dependency graph
  const depGraph = buildDependencyGraph(topo);
  const dependencyGraph: DependencyGraphSummary = {
    roots: depGraph.roots,
    leaves: depGraph.leaves,
    cycles: depGraph.cycles,
    maxDepth: depGraph.maxDepth,
    edgeCount: depGraph.edges.length,
  };

  // domain health
  const healthResults = checkAllDomainsHealth(graph);
  const domainHealth: DomainHealthSummary[] = healthResults.map(r => ({
    domainId: r.domainId,
    health: r.overallHealth,
    issueCount: r.issues.length,
  }));

  return {
    services,
    hotSpots,
    dependencyGraph,
    domainHealth,
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Internal helpers
// ═══════════════════════════════════════════════════════════════

function getAllContracts(topo: ServiceTopologyRegistry): SharedContract[] {
  // 토폴로지 리포트에서 계약 목록 가져오기
  const report = topo.generateReport([]);
  return [...report.contracts];
}
