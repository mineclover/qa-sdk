/**
 * trace — DKG 노드 역추적 skill.
 *
 * 임의의 노드 ID를 받아 구성, 소속, 제약, 인과 체인,
 * 의도 링크, 서비스 토폴로지, cascade를 한 번에 추적한다.
 */

import type { DemoCatalog } from "demo-snapshot";
import type { GraphRegistry } from "../graph-registry.js";
import type { ServiceTopologyRegistry } from "../service-topology.js";
import type {
  DkgNodeKind,
  PrefixNode,
  AxisNode,
  DslBundleNode,
  DecisionNode,
  ObservationNode,
  ConstraintNode,
  DomainNode,
} from "../dkg.types.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface CompositionEntry {
  readonly label: string;
  readonly targetId: string;
  readonly dimKind: string;
  readonly targetName: string;
  readonly entries?: readonly string[];
  readonly capacity?: number;
}

export interface CausalLink {
  readonly observation: { id: string; finding: string; suggestion?: unknown };
  readonly decisions: readonly {
    id: string;
    title: string;
    rationale: string;
    lifecycle: string;
  }[];
}

export interface DirectDecision {
  readonly id: string;
  readonly title: string;
  readonly context: string;
  readonly rationale: string;
  readonly lifecycle: string;
  readonly edgeType: string;
}

export interface TraceResult {
  readonly id: string;
  readonly kind: DkgNodeKind;
  readonly name: string;
  readonly details: Record<string, unknown>;

  /** 구성 축/참조 (prefix 기준) */
  readonly composition: readonly CompositionEntry[];
  /** 참조하는 prefix (references edge) */
  readonly references: readonly string[];
  /** 소속 (domain, dsl-bundle — contains 역방향) */
  readonly membership: readonly { id: string; kind: string; name: string }[];
  /** 적용되는 제약 */
  readonly constraints: readonly { id: string; rule: string }[];
  /** 관측 → 의사결정 인과 체인 */
  readonly causalChain: readonly CausalLink[];
  /** 직접 연결된 의사결정 (governs/justifies) */
  readonly directDecisions: readonly DirectDecision[];
  /** 의도 링크 */
  readonly intentLinks: readonly { id: string; intent: string; invariant?: string }[];

  /** 서비스 토폴로지 (prefix인 경우) */
  readonly topology: { owner: string | null; consumers: readonly string[] } | null;
  /** cascade 영향 */
  readonly cascade: {
    domains: readonly string[];
    consumers: readonly string[];
    affectedPrefixes?: readonly string[];
  } | null;

  /** 현재 claim (작업중 표시) */
  readonly claim: { by: string; at: string } | null;

  /** 적용 가능한 skill (전문화된 skill은 specialization 포함) */
  readonly applicableSkills: readonly {
    id: string;
    name: string;
    category: string;
    description: string;
    specialized: boolean;
  }[];
}

// ═══════════════════════════════════════════════════════════════
//  traceNode
// ═══════════════════════════════════════════════════════════════

export function traceNode(
  graph: GraphRegistry,
  catalog: DemoCatalog,
  nodeId: string,
  options?: {
    topo?: ServiceTopologyRegistry;
    getClaim?: (id: string) => { by: string; at: string } | null;
  },
): TraceResult | null {
  const node = graph.getNode(nodeId);
  if (!node) return null;

  const topo = options?.topo;
  const getClaim = options?.getClaim;

  // ── 기본 정보 ──
  const name = extractName(node);
  const details = extractDetails(node);

  // ── composition (prefix: composes edges) ──
  const composition: CompositionEntry[] = [];
  if (node.kind === "prefix") {
    for (const edge of graph.edgesFrom(nodeId, "composes")) {
      const target = graph.getNode(edge.to);
      const entry: CompositionEntry = {
        label: (edge.meta?.label as string) ?? edge.to,
        targetId: edge.to,
        dimKind: (edge.meta?.dimKind as string) ?? "unknown",
        targetName: extractName(target),
        ...getAxisEntries(catalog, edge.to, edge.meta?.dimKind as string),
      };
      composition.push(entry);
    }
  }

  // ── references ──
  const references = graph.edgesFrom(nodeId, "references").map(e => e.to);

  // ── membership (contains 역방향) ──
  const membership: { id: string; kind: string; name: string }[] = [];
  for (const edge of graph.edgesTo(nodeId, "contains")) {
    const parent = graph.getNode(edge.from);
    if (parent) {
      membership.push({ id: parent.id, kind: parent.kind, name: extractName(parent) });
    }
  }

  // ── constraints (constrains 역방향) ──
  const constraints: { id: string; rule: string }[] = [];
  for (const edge of graph.edgesTo(nodeId, "constrains")) {
    const c = graph.getNode(edge.from) as ConstraintNode | undefined;
    if (c?.kind === "constraint") constraints.push({ id: c.id, rule: c.rule });
  }

  // ── causal chain: observation → prompts → decision ──
  const causalChain: CausalLink[] = [];
  for (const edge of graph.edgesTo(nodeId, "observes")) {
    const obs = graph.getNode(edge.from) as ObservationNode | undefined;
    if (!obs || obs.kind !== "observation") continue;

    const decisions: CausalLink["decisions"][number][] = [];
    for (const decId of graph.neighbors(obs.id, "prompts")) {
      const dec = graph.getNode(decId) as DecisionNode | undefined;
      if (dec?.kind === "decision") {
        decisions.push({
          id: dec.id,
          title: dec.title,
          rationale: dec.rationale,
          lifecycle: dec.lifecycle,
        });
      }
    }

    causalChain.push({
      observation: { id: obs.id, finding: obs.finding, suggestion: obs.suggestion },
      decisions,
    });
  }

  // ── direct decisions (governs/justifies 역방향) ──
  const directDecisions: DirectDecision[] = [];
  const seenDec = new Set<string>();
  for (const edgeType of ["governs", "justifies"] as const) {
    for (const edge of graph.edgesTo(nodeId, edgeType)) {
      if (seenDec.has(edge.from)) continue;
      const dec = graph.getNode(edge.from) as DecisionNode | undefined;
      if (dec?.kind === "decision") {
        seenDec.add(dec.id);
        directDecisions.push({
          id: dec.id,
          title: dec.title,
          context: dec.context,
          rationale: dec.rationale,
          lifecycle: dec.lifecycle,
          edgeType,
        });
      }
    }
  }

  // ── intent-links (binds 역방향) ──
  const intentLinks = graph.intentLinksFor(nodeId);

  // ── topology ──
  let topology: TraceResult["topology"] = null;
  if (node.kind === "prefix" && topo) {
    topology = {
      owner: topo.getOwner(nodeId) ?? null,
      consumers: topo.getConsumers(nodeId),
    };
  }

  // ── cascade ──
  let cascade: TraceResult["cascade"] = null;
  if (node.kind === "prefix") {
    const c = graph.cascadeFromPrefix(nodeId);
    cascade = {
      domains: c.domains.map(d => d.id),
      consumers: c.consumers.map(c => c.id),
    };
  } else if (node.kind === "axis") {
    const affected = graph.cascadeFromAxis(nodeId);
    cascade = {
      domains: [],
      consumers: [],
      affectedPrefixes: affected.map(a => a.id),
    };
  }

  // ── claim ──
  const claim = getClaim?.(nodeId) ?? null;

  // ── applicable skills ──
  // 1) specialization에 이 nodeId가 명시된 skill (전문 skill)
  // 2) targetKinds만 일치하고 specialization 없는 skill (범용 skill)
  const applicableSkills: TraceResult["applicableSkills"][number][] = [];
  for (const sn of graph.getNodesByKind("skill")) {
    const skill = sn as import("../dkg.types.js").SkillNode;
    const spec = skill.specialization;

    // 전문 skill: specialization.prefixes/domains/dslBundles/intentLinks에 이 nodeId가 포함
    if (spec) {
      const mentioned = [
        ...(spec.prefixes ?? []),
        ...(spec.domains ?? []),
        ...(spec.dslBundles ?? []),
        ...(spec.intentLinks ?? []),
        ...(spec.constraints ?? []),
      ];
      if (mentioned.includes(nodeId)) {
        applicableSkills.push({ id: skill.id, name: skill.name, category: skill.category, description: skill.description, specialized: true });
        continue;
      }
    }

    // 범용 skill: specialization 없고 targetKinds 일치
    if (!spec && (skill.targetKinds.length === 0 || skill.targetKinds.includes(node.kind))) {
      applicableSkills.push({ id: skill.id, name: skill.name, category: skill.category, description: skill.description, specialized: false });
    }
  }

  return {
    id: nodeId,
    kind: node.kind,
    name,
    details,
    composition,
    references,
    membership,
    constraints,
    causalChain,
    directDecisions,
    intentLinks,
    topology,
    cascade,
    claim,
    applicableSkills,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function extractName(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  return (n.name as string) ?? (n.title as string) ?? (n.finding as string)?.slice(0, 50) ?? (n.id as string) ?? "";
}

function extractDetails(node: object): Record<string, unknown> {
  const skip = new Set(["kind", "id", "name"]);
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!skip.has(key)) details[key] = value;
  }
  return details;
}

function getAxisEntries(
  catalog: DemoCatalog,
  targetId: string,
  dimKind?: string,
): { entries?: readonly string[]; capacity?: number } {
  if (dimKind !== "axis") return {};
  const axis = catalog.axes[targetId];
  if (!axis) return {};
  const versions = Object.keys(axis.versions);
  const latest = axis.versions[versions[versions.length - 1]];
  if (!latest) return {};
  return {
    entries: latest.entries,
    capacity: latest.capacity ?? latest.entries.length,
  };
}
