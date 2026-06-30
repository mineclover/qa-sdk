// @def.doc definition-service

import { normalizeSemanticText } from "./normalize.js";
import type { FeedbackProposalDraft, FeedbackProposalInput } from "./types.js";

export function buildFeedbackProposal(input: FeedbackProposalInput): FeedbackProposalDraft {
  const normalizedTerm = normalizeSemanticText(input.term);
  return {
    kind: input.kind,
    term: input.term,
    normalizedTerm,
    dedupeKey: `${input.kind}:${normalizedTerm}`,
    payload: {
      ...(input.query ? { query: input.query } : {}),
    },
    evidence: input.evidence ?? {},
  };
}
