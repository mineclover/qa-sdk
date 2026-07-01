// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import type { SemanticIndexingPromotionProposal, SemanticIndexingPromotionProposalInput } from "./types.js";

function normalizeDisplayTerm(term: string): string {
  return term.trim().replace(/\s+/g, " ");
}

function normalizeLookupTerm(term: string): string {
  return normalizeDisplayTerm(term).toLowerCase();
}

export function buildSemanticIndexingPromotionProposal(
  input: SemanticIndexingPromotionProposalInput,
): SemanticIndexingPromotionProposal {
  const term = normalizeDisplayTerm(input.term);
  const normalizedTerm = normalizeLookupTerm(input.term);

  return {
    kind: input.kind,
    term,
    normalizedTerm,
    dedupeKey: `${input.kind}:${normalizedTerm}`,
    evidence: input.evidence ?? {},
  };
}
