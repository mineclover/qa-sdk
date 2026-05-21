import type {
  BranchSchema,
  Evidence,
  EvidenceKind,
  FlowSchema,
  GateSchema,
} from "decision-flow";
import type { DecisionFile, GateMarkers } from "./decision-file.js";

export type ToFlowSchemaOptions = {
  /** evidence.source 기본값으로 채울 markdown 파일 path. 미지정 시 빈 문자열. */
  sourcePath?: string;
};

/**
 * DecisionFile → FlowSchema 1:1 단순 매핑.
 *
 * 매핑 규칙 (Stage 4 spec):
 * - meta.id → FlowSchema.id
 * - meta.subject → unit.topic
 * - markers.purpose → unit.objective + FlowSchema.description
 * - markers.options[] → 단일 gate("decide")의 branches[]
 * - markers.evidence kind 집합 → gate.requiredEvidence
 * - markers.outcome → FlowSchema.outcomes (lifecycle === "approved"일 때만)
 *
 * 단일 gate phase="decide", weight="tactical". multi-gate markdown은 scope 외.
 */
export function toFlowSchema(
  decision: DecisionFile,
  opts: ToFlowSchemaOptions = {},
): FlowSchema {
  const { meta, markers } = decision;
  const purpose = markers.purpose ?? "(목적 미정)";

  // markers.gates 채워졌으면 multi-gate, 아니면 single-gate(backward compat).
  const gates: GateSchema[] =
    markers.gates.length > 0
      ? markers.gates.map(gateMarkersToSchema)
      : [singleGateFromMarkers(markers)];

  const includeOutcomes = meta.lifecycle === "approved" && !!markers.outcome;
  const outcomes = includeOutcomes
    ? [{ id: "approved", label: markers.outcome! }]
    : undefined;

  return {
    id: meta.id,
    name: `Decision: ${meta.subject}`,
    description: purpose,
    version: "1",
    gates,
    outcomes,
    unit: {
      topic: meta.subject,
      objective: purpose,
      successCriteria: [],
    },
  };
}

function singleGateFromMarkers(markers: DecisionFile["markers"]): GateSchema {
  const branches: readonly BranchSchema[] = markers.options.map((o) => ({
    id: o.id,
    label: o.body || o.id,
  }));
  const evidenceKinds = uniqueEvidenceKinds(markers.evidence);
  return {
    id: "decide",
    name: "결정",
    phase: markers.phase ?? "decide",
    weight: markers.weight ?? "tactical",
    branches,
    requiredEvidence: evidenceKinds.length > 0 ? evidenceKinds : undefined,
    affects: markers.dependsOn.length > 0 ? markers.dependsOn : undefined,
  };
}

function gateMarkersToSchema(g: GateMarkers): GateSchema {
  const branches: readonly BranchSchema[] = g.options.map((o) => ({
    id: o.id,
    label: o.body || o.id,
  }));
  const evidenceKinds = uniqueEvidenceKinds(g.evidence);
  return {
    id: g.id,
    name: g.name ?? g.id,
    phase: g.phase ?? "decide",
    weight: g.weight ?? "tactical",
    branches,
    requiredEvidence: evidenceKinds.length > 0 ? evidenceKinds : undefined,
    affects: g.dependsOn.length > 0 ? g.dependsOn : undefined,
  };
}

/**
 * markdown 전체 evidence → decision-flow Evidence[] (source 채움).
 * multi-gate decision일 경우 모든 gate의 evidence를 합쳐 반환 (gate 순서 유지).
 */
export function extractEvidence(
  decision: DecisionFile,
  opts: ToFlowSchemaOptions = {},
): Evidence[] {
  const source = opts.sourcePath ?? "";
  const all =
    decision.markers.gates.length > 0
      ? decision.markers.gates.flatMap((g) => g.evidence)
      : decision.markers.evidence;
  return all.map((e) => ({
    kind: e.kind,
    weight: e.weight,
    content: e.content,
    source: e.source || source,
  }));
}

function uniqueEvidenceKinds(evidence: readonly Evidence[]): EvidenceKind[] {
  const seen = new Set<EvidenceKind>();
  const out: EvidenceKind[] = [];
  for (const e of evidence) {
    if (!seen.has(e.kind)) {
      seen.add(e.kind);
      out.push(e.kind);
    }
  }
  return out;
}
