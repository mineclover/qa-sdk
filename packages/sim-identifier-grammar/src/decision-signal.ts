import { z } from "zod";

// spec 01 §2 신호 매트릭스 — 카테고리별 허용 signal 어휘 const 고정.
// #14(Task 2.15)와 병렬 작성 가능하도록 카테고리 allowlist는 inline.
export const SIGNALS_BY_CATEGORY = {
  perf: ["errorRate", "p95LatencyDelta"],
  compatibility: ["schemaCompatRate"],
  decisionQuality: ["denyRateDelta", "avgConfidenceDelta"],
  auditSafety: ["criticalAnomalyRate"],
  replicationHealth: ["replicationLagMs"],
  loadPressure: ["RPS", "p95LatencyDelta"],
  resourceHeadroom: ["CPU", "dbPoolUtilization"],
  stability: ["timeSinceLastReplicaChange"],
} as const satisfies Record<string, readonly string[]>;

export type SignalCategory = keyof typeof SIGNALS_BY_CATEGORY;
export type SignalName = (typeof SIGNALS_BY_CATEGORY)[SignalCategory][number];

export const SIGNAL_CATEGORIES = Object.keys(SIGNALS_BY_CATEGORY) as readonly SignalCategory[];
export const ALL_SIGNAL_PAIRS: ReadonlyArray<readonly [SignalCategory, string]> =
  SIGNAL_CATEGORIES.flatMap((c) =>
    (SIGNALS_BY_CATEGORY[c] as readonly string[]).map((s) => [c, s] as const),
  );

export interface DecisionSignal { category: SignalCategory; signal: SignalName }

function isAllowed(category: string, signal: string): category is SignalCategory {
  if (!(category in SIGNALS_BY_CATEGORY)) return false;
  return (SIGNALS_BY_CATEGORY[category as SignalCategory] as readonly string[]).includes(signal);
}

export const DecisionSignalSchema = z
  .object({
    category: z.enum(SIGNAL_CATEGORIES as unknown as [SignalCategory, ...SignalCategory[]]),
    signal: z.string(),
  })
  .refine((v) => isAllowed(v.category, v.signal), { message: "signal not registered for given category" });

const SIGNAL_PATTERN = /^([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)$/;
export const DecisionSignalStringSchema = z.string().regex(SIGNAL_PATTERN);

export function buildDecisionSignal(input: DecisionSignal): string {
  const v = DecisionSignalSchema.parse(input);
  return DecisionSignalStringSchema.parse(`${v.category}.${v.signal}`);
}

export function parseDecisionSignal(s: string): DecisionSignal {
  const m = SIGNAL_PATTERN.exec(s);
  if (!m) throw new Error(`invalid decision signal: ${s}`);
  const [, category, signal] = m;
  if (!isAllowed(category, signal)) throw new Error(`decision signal not in matrix: ${category}.${signal}`);
  return { category, signal: signal as SignalName };
}
