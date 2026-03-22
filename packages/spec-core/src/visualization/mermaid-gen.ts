/**
 * mermaid-gen — DKG 그래프에서 Mermaid sequenceDiagram 텍스트를 생성.
 *
 * 순수 함수. I/O 없음. 문자열 반환만 수행.
 * CLI에서 파일 저장 + mmdc 렌더링을 담당.
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { IntentLinkNode, DslBundleNode, DomainNode, ConstraintNode, TableNode, ObservationNode, DecisionNode, PrefixNode } from "../dkg/dkg.types.js";

// ── SignalDef duck type (viz-3d 의존 없이) ──────────────────

export interface SignalDefLike {
  readonly id: string;
  readonly name: string;
  readonly members: ReadonlyArray<{
    readonly prefixId: string;
    readonly role: string;
    readonly fixedValues?: Record<string, string>;
  }>;
  readonly requires?: readonly string[];
}

// ── Options ─────────────────────────────────────────────────

export interface MermaidDiagramOptions {
  /** 다이어그램 제목 */
  title?: string;
  /** invariant 주석 표시 (기본: true) */
  showInvariants?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

/** Mermaid note 안에서 특수문자 이스케이프 */
function escapeNote(text: string): string {
  return text.replace(/"/g, "#quot;").replace(/;/g, "#semi;");
}

// ── IntentLink Diagrams ─────────────────────────────────────

/**
 * 단일 IntentLink의 endpoint 흐름을 sequenceDiagram으로 생성.
 */
export function intentLinkDiagram(
  graph: GraphRegistry,
  intentLinkId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(intentLinkId) as IntentLinkNode | undefined;
  if (!node || node.kind !== "intent-link") {
    throw new Error(`IntentLink not found: ${intentLinkId}`);
  }

  const showInv = options?.showInvariants !== false;
  const lines: string[] = ["sequenceDiagram"];

  const title = options?.title ?? `${node.id}: ${node.intent}`;
  lines.push(`  title ${title}`);

  // participants
  for (const ep of node.endpoints) {
    lines.push(`  participant ${ep}`);
  }

  // via annotation
  lines.push(`  note over ${node.endpoints[0]},${node.endpoints[node.endpoints.length - 1]}: via ${node.via}`);

  // sequential arrows between endpoints
  for (let i = 0; i < node.endpoints.length - 1; i++) {
    lines.push(`  ${node.endpoints[i]} ->> ${node.endpoints[i + 1]}: ${node.endpoints[i + 1]}`);
  }

  // invariant note
  if (showInv && node.invariant) {
    const first = node.endpoints[0];
    const last = node.endpoints[node.endpoints.length - 1];
    lines.push(`  note over ${first},${last}: ${escapeNote(node.invariant)}`);
  }

  return lines.join("\n");
}

/**
 * 전체 IntentLink를 하나의 sequenceDiagram으로 통합.
 */
export function allIntentLinksDiagram(
  graph: GraphRegistry,
  options?: MermaidDiagramOptions,
): string {
  const nodes = graph.getNodesByKind("intent-link") as IntentLinkNode[];
  if (nodes.length === 0) return "sequenceDiagram\n  note right of Actor: IntentLink 없음";

  const showInv = options?.showInvariants !== false;
  const lines: string[] = ["sequenceDiagram"];
  lines.push(`  title ${options?.title ?? "전체 IntentLink 흐름"}`);

  // 모든 endpoint를 중복 없이 수집
  const allEndpoints = new Set<string>();
  for (const n of nodes) {
    for (const ep of n.endpoints) allEndpoints.add(ep);
  }
  for (const ep of allEndpoints) {
    lines.push(`  participant ${ep}`);
  }

  // 각 IntentLink별 블록
  for (const n of nodes) {
    lines.push("");
    lines.push(`  rect rgb(240, 248, 255)`);
    lines.push(`  note right of ${n.endpoints[0]}: ${n.id} — ${escapeNote(n.intent)}`);

    for (let i = 0; i < n.endpoints.length - 1; i++) {
      lines.push(`  ${n.endpoints[i]} ->> ${n.endpoints[i + 1]}: ${n.endpoints[i + 1]}`);
    }

    if (showInv && n.invariant) {
      lines.push(`  note over ${n.endpoints[0]},${n.endpoints[n.endpoints.length - 1]}: ${escapeNote(n.invariant)}`);
    }
    lines.push(`  end`);
  }

  return lines.join("\n");
}

// ── DSL Bundle Diagrams ─────────────────────────────────────

/**
 * DSL 번들의 멤버 prefix 흐름을 sequenceDiagram으로 생성.
 */
export function dslDiagram(
  graph: GraphRegistry,
  dslId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(dslId) as DslBundleNode | undefined;
  if (!node || node.kind !== "dsl-bundle") {
    throw new Error(`DslBundle not found: ${dslId}`);
  }

  const showInv = options?.showInvariants !== false;
  const lines: string[] = ["sequenceDiagram"];

  const title = options?.title ?? `${node.id}: ${node.name}`;
  lines.push(`  title ${title}`);

  // participants = memberPrefixes 순서
  for (const mp of node.memberPrefixes) {
    lines.push(`  participant ${mp}`);
  }

  // fixedDims annotation
  if (node.fixedDims.length > 0) {
    const first = node.memberPrefixes[0];
    const last = node.memberPrefixes[node.memberPrefixes.length - 1];
    lines.push(`  note over ${first},${last}: fixedDims: ${node.fixedDims.join(", ")}`);
  }

  // sequential arrows
  for (let i = 0; i < node.memberPrefixes.length - 1; i++) {
    lines.push(`  ${node.memberPrefixes[i]} ->> ${node.memberPrefixes[i + 1]}: ${node.memberPrefixes[i + 1]}`);
  }

  // invariant notes
  if (showInv && node.invariants) {
    for (const inv of node.invariants) {
      const first = node.memberPrefixes[0];
      const last = node.memberPrefixes[node.memberPrefixes.length - 1];
      lines.push(`  note over ${first},${last}: ${escapeNote(inv)}`);
    }
  }

  return lines.join("\n");
}

// ── Signal Diagrams ─────────────────────────────────────────

/**
 * Signal requires 체인을 sequenceDiagram으로 생성.
 */
export function signalDiagram(
  signalDefs: readonly SignalDefLike[],
  signalId: string,
  options?: MermaidDiagramOptions,
): string {
  const signal = signalDefs.find(s => s.id === signalId);
  if (!signal) {
    throw new Error(`Signal not found: ${signalId}. Available: ${signalDefs.map(s => s.id).join(", ")}`);
  }

  const lines: string[] = ["sequenceDiagram"];

  const title = options?.title ?? `Signal: ${signal.id} (${signal.name})`;
  lines.push(`  title ${title}`);

  // requires annotation
  if (signal.requires && signal.requires.length > 0) {
    lines.push(`  note left of Actor: requires: ${signal.requires.join(", ")}`);
  }

  lines.push(`  actor Actor`);

  // participants = members in order, annotated with role
  for (const m of signal.members) {
    lines.push(`  participant ${m.prefixId} as ${m.prefixId} [${m.role}]`);
  }

  // Actor → first member, then chained arrows
  if (signal.members.length > 0) {
    const first = signal.members[0];
    const firstLabel = first.fixedValues
      ? Object.values(first.fixedValues).join("/")
      : first.prefixId;
    lines.push(`  Actor ->> ${first.prefixId}: ${firstLabel}`);

    for (let i = 0; i < signal.members.length - 1; i++) {
      const from = signal.members[i];
      const to = signal.members[i + 1];
      const label = to.fixedValues
        ? Object.values(to.fixedValues).join("/")
        : to.prefixId;
      lines.push(`  ${from.prefixId} ->> ${to.prefixId}: ${label}`);
    }
  }

  return lines.join("\n");
}

// ── Types ───────────────────────────────────────────────────

/** 다이어그램 리스트 항목 */
export interface DiagramEntry {
  readonly kind: string;
  readonly id: string;
  readonly label: string;
}

/** ServiceTopology duck type (service-topology.ts 직접 의존 없이) */
export interface ServiceTopologyLike {
  listServices(): ReadonlyArray<{ serviceId: string; name: string; ownedPrefixes: readonly string[] }>;
  getConsumers(prefixId: string): string[];
}

// ── Domain Diagram ──────────────────────────────────────────

/**
 * 도메인 소속 prefix를 sequenceDiagram으로 생성.
 */
export function domainDiagram(
  graph: GraphRegistry,
  domainId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(domainId) as DomainNode | undefined;
  if (!node || node.kind !== "domain") {
    throw new Error(`Domain not found: ${domainId}`);
  }

  const lines: string[] = ["sequenceDiagram"];
  const title = options?.title ?? `Domain: ${node.name} (${node.id})`;
  lines.push(`  title ${title}`);

  // participants = domain 소속 prefix 순서
  for (const pid of node.prefixes) {
    const pNode = graph.getNode(pid) as PrefixNode | undefined;
    const label = pNode ? `${pid} [${pNode.category ?? "entity"}]` : pid;
    lines.push(`  participant ${pid} as ${label}`);
  }

  // sequential arrows between prefixes
  for (let i = 0; i < node.prefixes.length - 1; i++) {
    lines.push(`  ${node.prefixes[i]} ->> ${node.prefixes[i + 1]}: ${node.prefixes[i + 1]}`);
  }

  // shared axes annotation
  if (node.sharedAxes.length > 0) {
    const first = node.prefixes[0];
    const last = node.prefixes[node.prefixes.length - 1];
    lines.push(`  note over ${first},${last}: sharedAxes: ${node.sharedAxes.join(", ")}`);
  }

  // boundary annotation
  if (node.boundary.exports.length > 0 || node.boundary.internal.length > 0) {
    const first = node.prefixes[0];
    const last = node.prefixes[node.prefixes.length - 1];
    if (node.boundary.exports.length > 0) {
      lines.push(`  note over ${first},${last}: exports: ${node.boundary.exports.join(", ")}`);
    }
    if (node.boundary.internal.length > 0) {
      lines.push(`  note over ${first},${last}: internal: ${node.boundary.internal.join(", ")}`);
    }
  }

  // constraints on this domain's prefixes
  if (options?.showInvariants !== false) {
    for (const pid of node.prefixes) {
      const constraints = graph.activeConstraints(pid);
      for (const c of constraints) {
        lines.push(`  note right of ${pid}: ${escapeNote(c.rule)}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Service Diagram ─────────────────────────────────────────

/**
 * 서비스의 prefix 소유/소비 관계를 sequenceDiagram으로 생성.
 */
export function serviceDiagram(
  graph: GraphRegistry,
  topo: ServiceTopologyLike,
  serviceId: string,
  options?: MermaidDiagramOptions,
): string {
  const services = topo.listServices();
  const svc = services.find(s => s.serviceId === serviceId);
  if (!svc) {
    throw new Error(`Service not found: ${serviceId}. Available: ${services.map(s => s.serviceId).join(", ")}`);
  }

  const lines: string[] = ["sequenceDiagram"];
  const title = options?.title ?? `Service: ${svc.name} (${serviceId})`;
  lines.push(`  title ${title}`);

  // service as actor
  lines.push(`  actor ${serviceId} as ${svc.name}`);

  // owned prefixes as participants
  const consumedByOthers = new Set<string>();
  for (const pid of svc.ownedPrefixes) {
    const pNode = graph.getNode(pid) as PrefixNode | undefined;
    const label = pNode ? `${pid} [${pNode.category ?? "entity"}]` : pid;
    lines.push(`  participant ${pid} as ${label}`);

    const consumers = topo.getConsumers(pid);
    for (const c of consumers) {
      consumedByOthers.add(c);
    }
  }

  // consumer services as participants
  for (const cId of consumedByOthers) {
    if (cId !== serviceId) {
      const cSvc = services.find(s => s.serviceId === cId);
      lines.push(`  participant ${cId} as ${cSvc?.name ?? cId}`);
    }
  }

  // ownership arrows
  lines.push(`  rect rgb(230, 245, 230)`);
  lines.push(`  note right of ${serviceId}: owned prefixes`);
  for (const pid of svc.ownedPrefixes) {
    lines.push(`  ${serviceId} ->> ${pid}: owns`);
  }
  lines.push(`  end`);

  // consumption arrows
  for (const pid of svc.ownedPrefixes) {
    const consumers = topo.getConsumers(pid);
    for (const cId of consumers) {
      if (cId !== serviceId) {
        lines.push(`  ${pid} ->> ${cId}: consumes`);
      }
    }
  }

  return lines.join("\n");
}

// ── Constraint Diagram ──────────────────────────────────────

/**
 * constraint의 대상 노드를 sequenceDiagram으로 생성.
 */
export function constraintDiagram(
  graph: GraphRegistry,
  constraintId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(constraintId) as ConstraintNode | undefined;
  if (!node || node.kind !== "constraint") {
    throw new Error(`Constraint not found: ${constraintId}`);
  }

  const lines: string[] = ["sequenceDiagram"];
  const title = options?.title ?? `Constraint: ${constraintId}`;
  lines.push(`  title ${title}`);

  // constraint as actor
  lines.push(`  actor ${constraintId} as ${constraintId} [${node.lifecycle}]`);

  // targets from constrains edges
  const targets = graph.neighbors(constraintId, "constrains");

  for (const tid of targets) {
    const tNode = graph.getNode(tid);
    const label = tNode ? `${tid} [${tNode.kind}]` : tid;
    lines.push(`  participant ${tid} as ${label}`);
  }

  // rule note
  lines.push(`  note right of ${constraintId}: ${escapeNote(node.rule)}`);

  // formal note
  if (node.formal) {
    lines.push(`  note right of ${constraintId}: formal: ${escapeNote(node.formal)}`);
  }

  // arrows to targets
  for (const tid of targets) {
    lines.push(`  ${constraintId} ->> ${tid}: constrains`);
  }

  // scope annotation
  if (node.scope.length > 0) {
    lines.push(`  note right of ${constraintId}: scope: ${node.scope.join(", ")}`);
  }

  return lines.join("\n");
}

// ── Table Diagram ───────────────────────────────────────────

/**
 * 테이블의 FK/prefix 참조를 sequenceDiagram으로 생성.
 */
export function tableDiagram(
  graph: GraphRegistry,
  tableId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(tableId) as TableNode | undefined;
  if (!node || node.kind !== "table") {
    throw new Error(`Table not found: ${tableId}`);
  }

  const lines: string[] = ["sequenceDiagram"];
  const title = options?.title ?? `Table: ${node.name} (${tableId})`;
  lines.push(`  title ${title}`);

  // table as participant
  lines.push(`  participant ${tableId} as ${node.name}`);

  // prefix references via getPrefixesForTable
  const prefixRefs = graph.getPrefixesForTable(tableId);
  for (const pr of prefixRefs) {
    if (!lines.some(l => l.includes(`participant ${pr.prefixId}`))) {
      lines.push(`  participant ${pr.prefixId} as ${pr.prefixId}`);
    }
  }

  // column-level references
  const colRefs = graph.getTableColumnRefs(tableId);
  const participantIds = new Set<string>([tableId, ...prefixRefs.map(p => p.prefixId)]);

  for (const cr of colRefs) {
    if (!participantIds.has(cr.targetId)) {
      participantIds.add(cr.targetId);
      const tNode = graph.getNode(cr.targetId);
      const label = tNode ? `${cr.targetId} [${tNode.kind}]` : cr.targetId;
      lines.push(`  participant ${cr.targetId} as ${label}`);
    }
  }

  // prefix_ref arrows
  for (const pr of prefixRefs) {
    lines.push(`  ${pr.prefixId} ->> ${tableId}: table_ref (${pr.dimLabel})`);
  }

  // column-level ref arrows
  for (const cr of colRefs) {
    const refLabel = cr.refKind === "fk" ? "FK" : cr.refKind === "column_axis" ? "axis" : "prefix_ref";
    lines.push(`  ${tableId} ->> ${cr.targetId}: ${cr.column} (${refLabel})`);
  }

  // columns note
  if (node.columns.length > 0) {
    const colText = node.columns.join(", ");
    lines.push(`  note right of ${tableId}: columns: ${escapeNote(colText)}`);
  }

  return lines.join("\n");
}

// ── Observation Loop Diagram ────────────────────────────────

/**
 * observation → decision 루프를 sequenceDiagram으로 생성.
 */
export function observationLoopDiagram(
  graph: GraphRegistry,
  options?: MermaidDiagramOptions,
): string {
  const observations = graph.getNodesByKind("observation") as ObservationNode[];
  const decisions = graph.getNodesByKind("decision") as DecisionNode[];

  const lines: string[] = ["sequenceDiagram"];
  const title = options?.title ?? "Observation Loop";
  lines.push(`  title ${title}`);

  if (observations.length === 0 && decisions.length === 0) {
    lines.push(`  note right of Actor: observation/decision 없음`);
    return lines.join("\n");
  }

  lines.push(`  actor Runtime`);
  lines.push(`  participant Observations`);
  lines.push(`  participant Decisions`);

  // open observations (no resolution)
  const open = observations.filter(o => !o.resolution);
  const linked = observations.filter(o => {
    const promptEdges = graph.edgesFrom(o.id, "prompts");
    return promptEdges.length > 0 && !o.resolution;
  });
  const closed = observations.filter(o => o.resolution);

  // summary notes
  lines.push(`  note over Observations: total: ${observations.length} (open: ${open.length}, linked: ${linked.length}, closed: ${closed.length})`);
  lines.push(`  note over Decisions: total: ${decisions.length}`);

  // open observations → prompts → decisions
  for (const obs of observations) {
    const source = obs.source;
    const intent = obs.intent ?? "action-needed";
    lines.push(`  Runtime ->> Observations: ${obs.id} [${source}/${intent}]`);

    // prompts edges
    const promptTargets = graph.neighbors(obs.id, "prompts");
    for (const dt of promptTargets) {
      lines.push(`  Observations ->> Decisions: prompts ${dt}`);
    }

    // resolution
    if (obs.resolution) {
      lines.push(`  Decisions -->> Observations: resolved (${obs.resolution.outcome})`);
    }
  }

  return lines.join("\n");
}

// ── List All Diagrams ───────────────────────────────────────

/**
 * 사용 가능한 모든 다이어그램 목록을 종류별로 반환.
 */
export function listAllDiagrams(
  graph: GraphRegistry,
  topo?: ServiceTopologyLike,
): Record<string, DiagramEntry[]> {
  const result: Record<string, DiagramEntry[]> = {};

  // intent-links
  const intentLinks = graph.getNodesByKind("intent-link") as IntentLinkNode[];
  if (intentLinks.length > 0) {
    result["intent-links"] = intentLinks.map(il => ({
      kind: "intent-links",
      id: il.id,
      label: il.intent,
    }));
  }

  // dsl
  const dslBundles = graph.getNodesByKind("dsl-bundle") as DslBundleNode[];
  if (dslBundles.length > 0) {
    result["dsl"] = dslBundles.map(d => ({
      kind: "dsl",
      id: d.id,
      label: d.name,
    }));
  }

  // domain
  const domains = graph.getNodesByKind("domain") as DomainNode[];
  if (domains.length > 0) {
    result["domain"] = domains.map(d => ({
      kind: "domain",
      id: d.id,
      label: `${d.name} (${d.prefixes.length} prefixes)`,
    }));
  }

  // service (if topology provided)
  if (topo) {
    const services = topo.listServices();
    if (services.length > 0) {
      result["service"] = services.map(s => ({
        kind: "service",
        id: s.serviceId,
        label: `${s.name} (${s.ownedPrefixes.length} owned)`,
      }));
    }
  }

  // constraint
  const constraints = graph.getNodesByKind("constraint") as ConstraintNode[];
  if (constraints.length > 0) {
    result["constraint"] = constraints.map(c => ({
      kind: "constraint",
      id: c.id,
      label: c.rule.length > 60 ? c.rule.slice(0, 57) + "..." : c.rule,
    }));
  }

  // table
  const tables = graph.getNodesByKind("table") as TableNode[];
  if (tables.length > 0) {
    result["table"] = tables.map(t => ({
      kind: "table",
      id: t.id,
      label: t.name,
    }));
  }

  // observation-loop (always available as single entry)
  const observations = graph.getNodesByKind("observation");
  const decisions = graph.getNodesByKind("decision");
  result["observation-loop"] = [{
    kind: "observation-loop",
    id: "observation-loop",
    label: `${observations.length} observations, ${decisions.length} decisions`,
  }];

  return result;
}
