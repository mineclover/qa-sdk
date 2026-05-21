import type { CognitivePhase, Evidence, FlowSchema, GateWeight } from "decision-flow";
import type { Lifecycle } from "taxonomy-engine";
import type { DecisionFile, DecisionMeta } from "./decision-file.js";
import { serializeDecisionFile } from "./decision-file.js";

export type ToMarkdownOptions = {
  schema: FlowSchema;
  lifecycle: Lifecycle;
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
 * 매핑 규칙:
 * - schema.id → meta.id
 * - schema.unit.topic → meta.subject (또는 schema.name)
 * - schema.unit.objective || schema.description → ^purpose
 * - gate.phase (default 제외) → ^phase:<phase> 마커
 * - gate.weight (default 제외) → ^weight:<weight> 마커
 * - gate.affects → ^depends_on:<id>:<kind> 마커 N건
 * - gate.branches → ## 옵션\n\n<label> ^option:<id> 형식
 * - evidence → ## 증거\n\n<content> ^evidence:<kind> weight=N
 * - outcome (lifecycle approved + outcome 있을 때) → ## 결정\n\n<outcome> ^outcome
 *
 * 전제: schema.gates.length === 1 (single gate). multi-gate는 v0.13.
 */
export function toMarkdown(opts: ToMarkdownOptions): DecisionFile {
  const { schema, lifecycle } = opts;
  if (schema.gates.length !== 1) {
    throw new Error(
      `toMarkdown: 단일 gate만 지원 (현재 ${schema.gates.length}개). multi-gate는 v0.13 이후.`,
    );
  }
  const gate = schema.gates[0];
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

  const body = buildBody({
    purpose,
    phase: gate.phase,
    weight: gate.weight ?? DEFAULT_WEIGHT,
    affects: gate.affects ?? [],
    branches: gate.branches ?? [],
    evidence: opts.evidence ?? [],
    outcome: lifecycle === "approved" ? opts.outcome : undefined,
  });

  return {
    meta,
    body,
    markers: {
      purpose,
      options: (gate.branches ?? []).map((b) => ({ id: b.id, body: b.label })),
      evidence: (opts.evidence ?? []).map((e) => ({ ...e })),
      outcome: lifecycle === "approved" ? opts.outcome : undefined,
      phase: gate.phase !== DEFAULT_PHASE ? gate.phase : undefined,
      weight: (gate.weight ?? DEFAULT_WEIGHT) !== DEFAULT_WEIGHT ? gate.weight : undefined,
      dependsOn: [...(gate.affects ?? [])],
    },
  };
}

/**
 * DecisionFile을 markdown 텍스트로 직렬화 (frontmatter + body).
 * serializeDecisionFile의 wrapper — `toMarkdown(opts).body` 만 필요한 경우 사용.
 */
export function toMarkdownText(opts: ToMarkdownOptions): string {
  return serializeDecisionFile(toMarkdown(opts));
}

function buildBody(opts: {
  purpose: string;
  phase: CognitivePhase;
  weight: GateWeight;
  affects: readonly { gateId: string; kind: "constrains" | "enables" | "invalidates" }[];
  branches: readonly { id: string; label: string }[];
  evidence: readonly Evidence[];
  outcome: string | undefined;
}): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`# Decision\n`);

  // purpose + phase/weight/depends_on inline
  const purposeMarkers: string[] = ["^purpose"];
  if (opts.phase !== DEFAULT_PHASE) purposeMarkers.push(`^phase:${opts.phase}`);
  if (opts.weight !== DEFAULT_WEIGHT) purposeMarkers.push(`^weight:${opts.weight}`);
  for (const dep of opts.affects) {
    purposeMarkers.push(`^depends_on:${dep.gateId}:${dep.kind}`);
  }
  lines.push(`${opts.purpose} ${purposeMarkers.join(" ")}\n`);

  if (opts.branches.length > 0) {
    lines.push("## 옵션\n");
    for (const b of opts.branches) {
      lines.push(`${b.label} ^option:${b.id}\n`);
    }
  }

  if (opts.evidence.length > 0) {
    lines.push("## 증거\n");
    for (const e of opts.evidence) {
      lines.push(`${e.content} ^evidence:${e.kind} weight=${e.weight}\n`);
    }
  }

  if (opts.outcome) {
    lines.push("## 결정\n");
    lines.push(`${opts.outcome} ^outcome\n`);
  }

  return lines.join("\n");
}
