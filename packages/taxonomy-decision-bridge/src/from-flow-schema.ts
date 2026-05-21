import type {
  CognitivePhase,
  Evidence,
  FlowSchema,
  GateSchema,
  GateWeight,
} from "decision-flow";
import type { Lifecycle } from "taxonomy-engine";
import type {
  DecisionFile,
  DecisionMeta,
  GateDependency,
  GateMarkers,
} from "./decision-file.js";
import { serializeDecisionFile } from "./decision-file.js";

export type ToMarkdownOptions = {
  schema: FlowSchema;
  lifecycle: Lifecycle;
  /** 전체 evidence (single-gate). multi-gate일 때는 무시되고 gate.requiredEvidence + 이 evidence 풀에서 매칭 시도. */
  evidence?: readonly Evidence[];
  /** 결정 완료 시 outcome 본문 (lifecycle === "approved"일 때만 출력). */
  outcome?: string;
  /** 기존 timestamp 보존 시 사용. 미지정 시 현재 시각. */
  created?: string;
  updated?: string;
};

const DEFAULT_PHASE: CognitivePhase = "decide";
const DEFAULT_WEIGHT: GateWeight = "tactical";

/**
 * FlowSchema → DecisionFile (markdown). toFlowSchema의 역함수.
 *
 * single-gate (schema.gates.length === 1): 기존처럼 ^purpose 라인에 inline 마커.
 * multi-gate: schema 전체 ^purpose + 각 gate별 `^gate:<id>` 섹션.
 */
export function toMarkdown(opts: ToMarkdownOptions): DecisionFile {
  const { schema, lifecycle } = opts;
  if (schema.gates.length === 0) {
    throw new Error("toMarkdown: schema에 gate가 0개");
  }
  const subject = schema.unit?.topic ?? schema.name;
  const purpose = schema.unit?.objective ?? schema.description ?? "(목적 미정)";
  const now = new Date().toISOString();

  const meta: DecisionMeta = {
    id: schema.id,
    subject,
    lifecycle,
    created: opts.created ?? now,
    updated: opts.updated ?? now,
  };

  const isMulti = schema.gates.length > 1;
  const allEvidence = opts.evidence ?? [];
  const outcomeForBody = lifecycle === "approved" ? opts.outcome : undefined;

  const body = isMulti
    ? buildMultiGateBody({
        purpose,
        gates: schema.gates,
        evidence: allEvidence,
        outcome: outcomeForBody,
      })
    : buildSingleGateBody({
        purpose,
        gate: schema.gates[0],
        evidence: allEvidence,
        outcome: outcomeForBody,
      });

  return {
    meta,
    body,
    markers: isMulti
      ? buildMultiGateMarkers({ purpose, gates: schema.gates, evidence: allEvidence, outcomeForBody })
      : buildSingleGateMarkers({ purpose, gate: schema.gates[0], evidence: allEvidence, outcomeForBody }),
  };
}

export function toMarkdownText(opts: ToMarkdownOptions): string {
  return serializeDecisionFile(toMarkdown(opts));
}

// ── single-gate ─────────────────────────────────────────

function buildSingleGateMarkers(opts: {
  purpose: string;
  gate: GateSchema;
  evidence: readonly Evidence[];
  outcomeForBody: string | undefined;
}) {
  const { gate, evidence, outcomeForBody } = opts;
  return {
    purpose: opts.purpose,
    options: (gate.branches ?? []).map((b) => ({ id: b.id, body: b.label })),
    evidence: evidence.map((e) => ({ ...e })),
    outcome: outcomeForBody,
    phase: gate.phase !== DEFAULT_PHASE ? gate.phase : undefined,
    weight:
      (gate.weight ?? DEFAULT_WEIGHT) !== DEFAULT_WEIGHT
        ? (gate.weight as GateWeight)
        : undefined,
    dependsOn: [...(gate.affects ?? [])],
    gates: [],
  };
}

function buildSingleGateBody(opts: {
  purpose: string;
  gate: GateSchema;
  evidence: readonly Evidence[];
  outcome: string | undefined;
}): string {
  const { gate, evidence, outcome } = opts;
  const lines: string[] = ["", "# Decision\n"];
  const purposeMarkers = inlineMarkers({
    phase: gate.phase,
    weight: gate.weight ?? DEFAULT_WEIGHT,
    affects: gate.affects ?? [],
  });
  lines.push(`${opts.purpose} ^purpose${formatInline(purposeMarkers)}\n`);

  lines.push(...renderOptions(gate.branches ?? []));
  lines.push(...renderEvidence(evidence));
  lines.push(...renderOutcome(outcome));

  return lines.join("\n");
}

// ── multi-gate ──────────────────────────────────────────

function buildMultiGateMarkers(opts: {
  purpose: string;
  gates: readonly GateSchema[];
  evidence: readonly Evidence[];
  outcomeForBody: string | undefined;
}) {
  return {
    purpose: opts.purpose,
    options: [],
    evidence: [],
    outcome: opts.outcomeForBody,
    dependsOn: [],
    gates: opts.gates.map((g) => gateSchemaToMarkers(g, opts.evidence)),
  };
}

function gateSchemaToMarkers(g: GateSchema, allEvidence: readonly Evidence[]): GateMarkers {
  // multi-gate evidence 분배: gate.requiredEvidence kind에 매칭되는 것만 그 gate에 할당.
  // 추정만 — 정확한 매핑은 toFlowSchema → toMarkdown 라운드트립에서만 필요.
  const required = new Set(g.requiredEvidence ?? []);
  const gateEvidence = required.size > 0
    ? allEvidence.filter((e) => required.has(e.kind))
    : [];
  return {
    id: g.id,
    name: g.name !== g.id ? g.name : undefined,
    phase: g.phase !== DEFAULT_PHASE ? g.phase : undefined,
    weight:
      (g.weight ?? DEFAULT_WEIGHT) !== DEFAULT_WEIGHT
        ? (g.weight as GateWeight)
        : undefined,
    options: (g.branches ?? []).map((b) => ({ id: b.id, body: b.label })),
    evidence: gateEvidence.map((e) => ({ ...e })),
    dependsOn: [...(g.affects ?? [])],
  };
}

function buildMultiGateBody(opts: {
  purpose: string;
  gates: readonly GateSchema[];
  evidence: readonly Evidence[];
  outcome: string | undefined;
}): string {
  const lines: string[] = ["", "# Decision\n", `${opts.purpose} ^purpose\n`];
  for (const g of opts.gates) {
    lines.push(`## Gate: ${g.name ?? g.id}\n`);
    const gateMarkers = inlineMarkers({
      phase: g.phase,
      weight: g.weight ?? DEFAULT_WEIGHT,
      affects: g.affects ?? [],
    });
    lines.push(`^gate:${g.id}${formatInline(gateMarkers)}\n`);
    lines.push(...renderOptions(g.branches ?? []));
    const required = new Set(g.requiredEvidence ?? []);
    const gateEvidence =
      required.size > 0
        ? opts.evidence.filter((e) => required.has(e.kind))
        : [];
    lines.push(...renderEvidence(gateEvidence));
  }
  lines.push(...renderOutcome(opts.outcome));
  return lines.join("\n");
}

// ── shared helpers ──────────────────────────────────────

function inlineMarkers(opts: {
  phase?: CognitivePhase;
  weight: GateWeight;
  affects: readonly GateDependency[];
}): string[] {
  const out: string[] = [];
  if (opts.phase !== undefined && opts.phase !== DEFAULT_PHASE) {
    out.push(`^phase:${opts.phase}`);
  }
  if (opts.weight !== DEFAULT_WEIGHT) out.push(`^weight:${opts.weight}`);
  for (const dep of opts.affects) {
    out.push(`^depends_on:${dep.gateId}:${dep.kind}`);
  }
  return out;
}

function formatInline(markers: string[]): string {
  return markers.length > 0 ? ` ${markers.join(" ")}` : "";
}

function renderOptions(branches: readonly { id: string; label: string }[]): string[] {
  if (branches.length === 0) return [];
  const lines: string[] = ["## 옵션\n"];
  for (const b of branches) lines.push(`${b.label} ^option:${b.id}\n`);
  return lines;
}

function renderEvidence(evidence: readonly Evidence[]): string[] {
  if (evidence.length === 0) return [];
  const lines: string[] = ["## 증거\n"];
  for (const e of evidence) {
    lines.push(`${e.content} ^evidence:${e.kind} weight=${e.weight}\n`);
  }
  return lines;
}

function renderOutcome(outcome: string | undefined): string[] {
  if (!outcome) return [];
  return ["## 결정\n", `${outcome} ^outcome\n`];
}
