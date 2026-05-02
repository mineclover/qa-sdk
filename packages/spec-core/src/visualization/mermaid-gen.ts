// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * mermaid-gen — DKG 그래프에서 Mermaid sequenceDiagram 텍스트를 생성.
 *
 * 순수 함수. I/O 없음. 문자열 반환만 수행.
 * CLI에서 파일 저장 + mmdc 렌더링을 담당.
 */

import type { GraphRegistry } from "dkg";
import type { IntentLinkNode, DslBundleNode, DomainNode, ConstraintNode, TableNode, PrefixNode, TransitionSpecNode } from "dkg";

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
  const nodes = graph.getNodesByKind("intent-link");
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
  readonly endpoints?: readonly string[];
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
/**
 * 단일 테이블 ER 다이어그램.
 *
 * 해당 테이블 + FK로 연결된 테이블 + 참조하는 prefix/축을 erDiagram으로 표현.
 * 컬럼별 타입과 참조 관계가 한눈에 보인다.
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

  const lines: string[] = ["erDiagram"];
  const title = options?.title ?? `Table: ${node.name}`;
  lines.push(`  %% ${title}`);

  // 관련 테이블 수집 (FK 관계)
  const relatedTables = new Set<string>();
  const colRefs = graph.getTableColumnRefs(tableId);
  for (const cr of colRefs) {
    if (cr.refKind === "fk") relatedTables.add(cr.targetId);
  }

  // 역방향 FK (이 테이블을 참조하는 테이블)
  const allTables = graph.getNodesByKind("table") as TableNode[];
  for (const t of allTables) {
    if (t.id === tableId) continue;
    const refs = graph.getTableColumnRefs(t.id);
    if (refs.some(r => r.refKind === "fk" && r.targetId === tableId)) {
      relatedTables.add(t.id);
    }
  }

  // 엔티티 정의 (컬럼 포함)
  const tablesToRender = [tableId, ...relatedTables];
  for (const tid of tablesToRender) {
    const tNode = graph.getNode(tid) as TableNode | undefined;
    if (!tNode) continue;
    lines.push(`  ${safeId(tid)} {`);
    for (const col of tNode.columns) {
      const refs = graph.getTableColumnRefs(tid);
      const colRef = refs.find(r => r.column === col);
      const typeLabel = colRef
        ? colRef.refKind === "fk" ? "FK"
        : colRef.refKind === "column_axis" ? `axis(${colRef.targetId})`
        : `ref(${colRef.targetId})`
        : "scalar";
      const pk = col === "id" ? "PK" : "";
      lines.push(`    string ${col} ${pk ? pk + " " : ""}"${typeLabel}"`);
    }
    lines.push(`  }`);
  }

  // FK 관계
  for (const cr of colRefs) {
    if (cr.refKind === "fk") {
      lines.push(`  ${safeId(tableId)} }o--|| ${safeId(cr.targetId)} : "${cr.column}"`);
    }
  }

  // 역방향 FK
  for (const tid of relatedTables) {
    if (tid === tableId) continue;
    const refs = graph.getTableColumnRefs(tid);
    for (const r of refs) {
      if (r.refKind === "fk" && r.targetId === tableId) {
        lines.push(`  ${safeId(tid)} }o--|| ${safeId(tableId)} : "${r.column}"`);
      }
    }
  }

  // prefix 참조 (이 테이블을 table_ref로 사용하는 prefix)
  const prefixRefs = graph.getPrefixesForTable(tableId);
  if (prefixRefs.length > 0) {
    lines.push(`  %% prefix references`);
    for (const pr of prefixRefs) {
      lines.push(`  ${safeId(pr.prefixId)}["${pr.prefixId} (prefix)"] }o..|| ${safeId(tableId)} : "${pr.dimLabel}"`);
    }
  }

  return lines.join("\n");
}

/**
 * 전체 테이블 ER 다이어그램 — 모든 테이블 + FK + prefix 참조.
 */
export function tableErDiagram(
  graph: GraphRegistry,
  options?: MermaidDiagramOptions & { ddlStatus?: Record<string, "deployed" | "catalog-only" | "ddl-only"> },
): string {
  const allTables = graph.getNodesByKind("table") as TableNode[];
  if (allTables.length === 0) return "erDiagram\n  %% No tables";

  const lines: string[] = ["erDiagram"];
  const title = options?.title ?? `All Tables (${allTables.length})`;
  lines.push(`  %% ${title}`);

  // 모든 테이블 엔티티
  for (const t of allTables) {
    lines.push(`  ${safeId(t.id)} {`);
    for (const col of t.columns) {
      const refs = graph.getTableColumnRefs(t.id);
      const colRef = refs.find(r => r.column === col);
      let typeLabel: string;
      if (!colRef) {
        typeLabel = "scalar";
      } else if (colRef.refKind === "fk") {
        typeLabel = `FK(${colRef.targetId})`;
      } else if (colRef.refKind === "column_axis") {
        typeLabel = `axis(${colRef.targetId})`;
      } else {
        typeLabel = `ref(${colRef.targetId})`;
      }
      lines.push(`    string ${col} "${typeLabel}"`);
    }
    lines.push(`  }`);
  }

  // FK 관계 (중복 방지)
  const seenEdges = new Set<string>();
  for (const t of allTables) {
    const refs = graph.getTableColumnRefs(t.id);
    for (const r of refs) {
      if (r.refKind === "fk") {
        const edgeKey = `${t.id}->${r.targetId}:${r.column}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        lines.push(`  ${safeId(t.id)} }o--|| ${safeId(r.targetId)} : "${r.column}"`);
      }
    }
  }

  return lines.join("\n");
}

/** Mermaid erDiagram 예약어 — 엔티티 이름으로 사용 불가 */
const MERMAID_RESERVED = new Set([
  "entry", "order", "group", "index", "table", "key", "type",
  "string", "int", "float", "boolean", "date", "datetime",
]);

/** Mermaid ID에 안전한 문자열 변환 (예약어 + 특수문자 처리) */
function safeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  // 예약어 충돌 시 접두사 추가
  if (MERMAID_RESERVED.has(cleaned.toLowerCase())) {
    return `tbl_${cleaned}`;
  }
  return cleaned;
}

// ── Observation Loop Diagram ────────────────────────────────

/**
 * observation → decision 루프를 sequenceDiagram으로 생성.
 */
export function observationLoopDiagram(
  graph: GraphRegistry,
  options?: MermaidDiagramOptions,
): string {
  const observations = graph.getNodesByKind("observation");
  const decisions = graph.getNodesByKind("decision");

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
  const intentLinks = graph.getNodesByKind("intent-link");
  if (intentLinks.length > 0) {
    result["intent-links"] = intentLinks.map(il => ({
      kind: "intent-links",
      id: il.id,
      label: il.intent,
      endpoints: il.endpoints,
    }));
  }

  // dsl
  const dslBundles = graph.getNodesByKind("dsl-bundle");
  if (dslBundles.length > 0) {
    result["dsl"] = dslBundles.map(d => ({
      kind: "dsl",
      id: d.id,
      label: d.name,
    }));
  }

  // domain
  const domains = graph.getNodesByKind("domain");
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
  const constraints = graph.getNodesByKind("constraint");
  if (constraints.length > 0) {
    result["constraint"] = constraints.map(c => ({
      kind: "constraint",
      id: c.id,
      label: c.rule.length > 60 ? c.rule.slice(0, 57) + "..." : c.rule,
    }));
  }

  // table
  const tables = graph.getNodesByKind("table");
  if (tables.length > 0) {
    result["table"] = tables.map(t => ({
      kind: "table",
      id: t.id,
      label: t.name,
    }));
    result["table-er"] = [{
      kind: "table-er",
      id: "table-er",
      label: `All Tables ER (${tables.length})`,
    }];
  }

  // observation-loop (always available as single entry)
  const observations = graph.getNodesByKind("observation");
  const decisions = graph.getNodesByKind("decision");
  result["observation-loop"] = [{
    kind: "observation-loop",
    id: "observation-loop",
    label: `${observations.length} observations, ${decisions.length} decisions`,
  }];

  // transition-spec
  const tspecs = graph.getNodesByKind("transition-spec");
  if (tspecs.length > 0) {
    result["transition-spec"] = tspecs.map(t => ({
      kind: "transition-spec",
      id: t.id,
      label: `${t.transition} (${t.effectKind})`,
    }));
    // inter-spec DAG (전체 전이 관계도)
    result["transition-dag"] = [{
      kind: "transition-dag",
      id: "transition-dag",
      label: `${tspecs.length} specs — depends-on + satisfies`,
    }];
  }

  // Note: traces are dynamic (runtime), not from DKG graph — excluded here.

  return result;
}

// ── Trace Sequence Diagrams (런타임 이벤트 기반) ────────────

export interface TraceStepLike {
  readonly timestamp: string;
  readonly prefixId: string;
  readonly layer: number;
  readonly serialized: string;
}

export interface TracePathLike {
  readonly traceId: string;
  readonly steps: readonly TraceStepLike[];
  readonly duration: number;
}

/**
 * 실제 이벤트 TracePath를 sequenceDiagram으로 생성.
 *
 * participants: layer별 그룹 (L0 UI / L1 Business / L2 Infra)
 * messages: timestamp순 prefix 활성화
 * 동시 발생(같은 timestamp) prefix는 같은 시점으로 표시.
 */
export function traceSequenceDiagram(
  trace: TracePathLike,
  options?: MermaidDiagramOptions & { decode?: (serialized: string) => Record<string, string | number> | null },
): string {
  const lines: string[] = ["sequenceDiagram"];
  lines.push(`  title Trace: ${trace.traceId} (${trace.duration}ms)`);

  // 빈 trace 가드
  if (trace.steps.length === 0) {
    lines.push(`  note right of Actor: 이벤트 없음`);
    return lines.join("\n");
  }

  // prefix → layer 매핑 수집
  const prefixLayers = new Map<string, number>();
  for (const s of trace.steps) prefixLayers.set(s.prefixId, s.layer);

  const layerNames = ["L0 UI", "L1 Business", "L2 Infra", "L3 Data"];
  const byLayer = new Map<number, string[]>();
  for (const [pid, layer] of prefixLayers) {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- set above guarantees presence
    byLayer.get(layer)!.push(pid);
  }

  // layer별 participant 그룹
  for (const [layer, pids] of [...byLayer.entries()].toSorted((a, b) => a[0] - b[0])) {
    lines.push(`  box ${layerNames[layer] ?? `L${layer}`}`);
    for (const pid of pids) lines.push(`    participant ${pid}`);
    lines.push(`  end`);
  }

  // timestamp순 메시지
  let prevPrefix: string | null = null;
  let prevTs: string | null = null;

  for (const step of trace.steps) {
    let label = step.prefixId;
    if (options?.decode) {
      try {
        const vals = options.decode(step.serialized);
        if (vals) {
          label = Object.entries(vals).map(([k, v]) => `${k}=${v}`).join(", ");
          if (label.length > 50) label = label.slice(0, 47) + "...";
        }
      } catch { /* decode 실패 시 prefixId 사용 */ }
    }

    const ts = step.timestamp.split("T")[1]?.slice(0, 12) ?? step.timestamp;
    const sameTime = prevTs === step.timestamp;

    if (!prevPrefix) {
      // 첫 번째 스텝
      lines.push(`  note over ${step.prefixId}: ${ts}`);
      lines.push(`  ${step.prefixId} ->> ${step.prefixId}: ${label}`);
    } else if (prevPrefix === step.prefixId) {
      // 같은 prefix 반복 활성화 (self-arrow)
      lines.push(`  ${step.prefixId} -->> ${step.prefixId}: ${label}`);
    } else if (sameTime) {
      // 동시 발생 (같은 timestamp) — 점선 화살표
      lines.push(`  ${prevPrefix} -->> ${step.prefixId}: ${label}`);
    } else {
      // 시간순 이동
      lines.push(`  ${prevPrefix} ->> ${step.prefixId}: ${label}`);
    }

    prevPrefix = step.prefixId;
    prevTs = step.timestamp;
  }

  // 요약
  const first = trace.steps[0].prefixId;
  const last = trace.steps[trace.steps.length - 1].prefixId;
  lines.push(`  note over ${first},${last}: ${trace.duration}ms / ${trace.steps.length} steps`);

  return lines.join("\n");
}

// ── Transition Spec Diagrams ──────────────────────────────

/**
 * 단일 TransitionSpec의 match→input→output 흐름 다이어그램.
 *
 * 참여자: Event(이벤트 매칭) → State(상태 조건) → Transition(전이 실행) → Effect(결과)
 * 축 역할별로 화살표 색상 구분.
 */
export function transitionSpecDiagram(
  graph: GraphRegistry,
  specId: string,
  options?: MermaidDiagramOptions,
): string {
  const node = graph.getNode(specId) as TransitionSpecNode | undefined;
  if (!node || node.kind !== "transition-spec") return `sequenceDiagram\n  note right of Actor: ${specId} not found`;

  const title = options?.title ?? `Transition: ${node.transition} (${node.version})`;
  const lines: string[] = ["sequenceDiagram"];
  lines.push(`  title ${title}`);

  // 참여자
  lines.push(`  participant Event as 🎯 Event Match`);
  lines.push(`  participant State as 📋 State Check`);
  lines.push(`  participant Engine as ⚙️ ${node.transition}`);
  lines.push(`  participant Output as 📤 State Mutate`);

  // match 단계
  lines.push(`  rect rgb(230, 245, 255)`);
  lines.push(`  note over Event: match: ${node.matchMode} (${node.coordinateCount}개 좌표)`);
  for (const axis of node.matchAxes) {
    lines.push(`  Event->>Engine: ${axis}`);
  }
  lines.push(`  end`);

  // input 단계
  if (node.inputAxes.length > 0) {
    lines.push(`  rect rgb(255, 245, 230)`);
    lines.push(`  note over State: input 전제조건`);
    for (const axis of node.inputAxes) {
      lines.push(`  State->>Engine: ${axis} ✓`);
    }
    lines.push(`  end`);
  }

  // output 단계
  if (node.outputAxes.length > 0) {
    lines.push(`  rect rgb(230, 255, 230)`);
    lines.push(`  note over Output: output 상태 변경`);
    for (const axis of node.outputAxes) {
      lines.push(`  Engine->>Output: ${axis} ←`);
    }
    lines.push(`  end`);
  }

  // effect 주석
  lines.push(`  note over Engine: effect: ${node.effectKind}`);

  // depends-on 관계
  const dependsOn = graph.edgesFrom(specId, "depends-on");
  if (dependsOn.length > 0) {
    lines.push(`  note right of Engine: depends-on: ${dependsOn.map(e => (graph.getNode(e.to) as TransitionSpecNode)?.transition ?? e.to).join(", ")}`);
  }

  // satisfies 관계
  const satisfies = graph.edgesFrom(specId, "satisfies");
  if (satisfies.length > 0) {
    lines.push(`  note right of Output: satisfies: ${satisfies.map(e => e.to).join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * 전체 TransitionSpec 간 관계 DAG.
 *
 * depends-on + satisfies 엣지를 Mermaid graph로 표현.
 * sequenceDiagram이 아닌 graph TD (방향 그래프).
 */
export function transitionDagDiagram(
  graph: GraphRegistry,
  options?: MermaidDiagramOptions,
): string {
  const tspecs = graph.getNodesByKind("transition-spec") as TransitionSpecNode[];
  if (tspecs.length === 0) return "graph TD\n  EMPTY[No transition specs]";

  const title = options?.title ?? "Transition Spec DAG";
  const lines: string[] = [`graph TD`];
  lines.push(`  %% ${title}`);

  // 노드 정의
  for (const t of tspecs) {
    const label = `${t.transition}\\n${t.effectKind} | ${t.matchMode}(${t.coordinateCount})`;
    lines.push(`  ${t.id}["${label}"]`);
  }

  // depends-on 엣지
  for (const t of tspecs) {
    const deps = graph.edgesFrom(t.id, "depends-on");
    for (const e of deps) {
      const shared = Array.isArray(e.meta?.sharedAxes) ? e.meta.sharedAxes as string[] : undefined;
      const label = shared ? shared.join(",") : "state";
      lines.push(`  ${t.id} -->|${label}| ${e.to}`);
    }
  }

  // satisfies 엣지 (DSL 연결)
  const dslIds = new Set<string>();
  for (const t of tspecs) {
    const sats = graph.edgesFrom(t.id, "satisfies");
    for (const e of sats) {
      if (!dslIds.has(e.to)) {
        const dsl = graph.getNode(e.to) as DslBundleNode | undefined;
        lines.push(`  ${e.to}[/"${dsl?.name ?? e.to}"/]`);
        dslIds.add(e.to);
      }
      lines.push(`  ${t.id} -.->|satisfies| ${e.to}`);
    }
  }

  // 스타일
  for (const t of tspecs) {
    const color = t.effectKind === "create" ? "#e8f5e9"
      : t.effectKind === "close" ? "#fce4ec"
      : t.effectKind === "open" ? "#e3f2fd"
      : "#fff3e0";
    lines.push(`  style ${t.id} fill:${color}`);
  }

  return lines.join("\n");
}
