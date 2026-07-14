// @def.doc definition-service

import { normalizeSemanticText, tokenizeSemanticText } from './normalize.js';
import type {
  SemanticCandidate,
  SemanticEvidence,
  SemanticResolution,
  SemanticResolveOptions,
  SemanticTermWithAliases,
} from './types.js';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_LIMIT = 10;

export function resolveSemanticCandidates(
  query: string,
  terms: readonly SemanticTermWithAliases[],
  options: SemanticResolveOptions = {},
): SemanticResolution {
  const normalized = normalizeSemanticText(query);
  const tokens = tokenizeSemanticText(query);
  const candidates = terms
    .map((term) => scoreTerm(term, normalized, tokens))
    .filter((candidate): candidate is SemanticCandidate => candidate !== null)
    .toSorted(
      (left, right) =>
        right.confidence - left.confidence ||
        left.canonicalLabel.localeCompare(right.canonicalLabel) ||
        left.termId.localeCompare(right.termId),
    )
    .slice(0, options.limit ?? DEFAULT_LIMIT);
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  return {
    query: { raw: query, normalized, tokens },
    candidates,
    confident: candidates.some((candidate) => candidate.confidence >= threshold),
  };
}

function scoreTerm(
  term: SemanticTermWithAliases,
  normalizedQuery: string,
  queryTokens: readonly string[],
): SemanticCandidate | null {
  if (!normalizedQuery) return null;

  const exactAlias = term.aliases
    .filter((alias) => alias.normalizedAlias === normalizedQuery)
    .toSorted(
      (left, right) =>
        right.confidence - left.confidence ||
        left.source.localeCompare(right.source) ||
        left.aliasId.localeCompare(right.aliasId),
    )[0];
  if (exactAlias) {
    return candidate(term, exactAlias.confidence, 'alias', [
      { kind: 'alias', ref: exactAlias.alias, weight: exactAlias.confidence },
    ]);
  }

  if (term.normalizedLabel === normalizedQuery) {
    return candidate(term, 1, 'canonical-label', [
      { kind: 'canonical-label', ref: term.canonicalLabel, weight: 1 },
    ]);
  }

  const labelTokens = tokenizeSemanticText(term.normalizedLabel);
  const overlap = queryTokens.filter((token) => labelTokens.includes(token));
  if (overlap.length > 0) {
    const confidence = Math.min(
      0.75,
      overlap.length / Math.max(queryTokens.length, labelTokens.length),
    );
    return candidate(
      term,
      confidence,
      'token-overlap',
      overlap.map((token) => ({
        kind: 'token-overlap',
        ref: token,
        weight: confidence,
      })),
    );
  }

  return null;
}

function candidate(
  term: SemanticTermWithAliases,
  confidence: number,
  matchedBy: SemanticCandidate['matchedBy'],
  evidence: readonly SemanticEvidence[],
): SemanticCandidate {
  return {
    termId: term.termId,
    canonicalLabel: term.canonicalLabel,
    confidence,
    matchedBy,
    evidence,
    ...(term.docId ? { docId: term.docId } : {}),
    ...(term.coordinate ? { coordinate: term.coordinate } : {}),
    ...(term.prefixId ? { prefixId: term.prefixId } : {}),
    ...(term.versionId ? { versionId: term.versionId } : {}),
    ...(term.address !== undefined ? { address: term.address } : {}),
  };
}
