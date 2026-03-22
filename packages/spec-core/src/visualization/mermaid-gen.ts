/**
 * mermaid-gen — DKG 그래프에서 Mermaid sequenceDiagram 텍스트를 생성.
 *
 * 순수 함수. I/O 없음. 문자열 반환만 수행.
 * CLI에서 파일 저장 + mmdc 렌더링을 담당.
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { IntentLinkNode, DslBundleNode } from "../dkg/dkg.types.js";

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
