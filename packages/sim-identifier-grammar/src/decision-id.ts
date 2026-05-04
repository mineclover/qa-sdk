// @def.boundary sim-identifier-grammar
import { z } from "zod";

export const DECISION_PASSES = ["safety", "resource"] as const;
export type DecisionPass = (typeof DECISION_PASSES)[number];

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export interface DecisionId {
  pass: DecisionPass;
  cycleId: string; // ULID
}

export const DecisionIdSchema = z.object({
  pass: z.enum(DECISION_PASSES),
  cycleId: z.string().regex(ULID_REGEX),
});

export function buildDecisionId(d: DecisionId): string {
  const v = DecisionIdSchema.parse(d);
  return `${v.pass}-decision-${v.cycleId}`;
}

export function parseDecisionId(s: string): DecisionId {
  const m = s.match(/^(safety|resource)-decision-([0-9A-HJKMNP-TV-Z]{26})$/);
  if (!m) throw new Error(`invalid decision id: ${s}`);
  return DecisionIdSchema.parse({ pass: m[1], cycleId: m[2] });
}
