import type {
  BranchSchema,
  Evidence,
  EvidenceKind,
  FlowSchema,
  GateSchema,
} from "decision-flow";
import type { DecisionFile } from "./decision-file.js";

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

  const branches: readonly BranchSchema[] = markers.options.map((o) => ({
    id: o.id,
    label: o.body || o.id,
  }));

  const evidenceKinds = uniqueEvidenceKinds(markers.evidence);
  const decideGate: GateSchema = {
    id: "decide",
    name: "결정",
    phase: "decide",
    weight: "tactical",
    branches,
    requiredEvidence: evidenceKinds.length > 0 ? evidenceKinds : undefined,
  };

  const includeOutcomes = meta.lifecycle === "approved" && !!markers.outcome;
  const outcomes = includeOutcomes
    ? [{ id: "approved", label: markers.outcome! }]
    : undefined;

  return {
    id: meta.id,
    name: `Decision: ${meta.subject}`,
    description: purpose,
    version: "1",
    gates: [decideGate],
    outcomes,
    unit: {
      topic: meta.subject,
      objective: purpose,
      successCriteria: [],
    },
  };
}

/**
 * markdown markers.evidence → decision-flow Evidence[] (source 채움).
 */
export function extractEvidence(
  decision: DecisionFile,
  opts: ToFlowSchemaOptions = {},
): Evidence[] {
  const source = opts.sourcePath ?? "";
  return decision.markers.evidence.map((e) => ({
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
