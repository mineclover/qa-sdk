// @def.doc definition-service

import type { DocRecord } from '../types.js';
import type {
  GroundingPlan,
  GroundingPlannerOptions,
  SemanticDocumentMergeInput,
  SemanticResolution,
} from './types.js';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

export function planDocumentSearch(
  query: string,
  resolution: SemanticResolution,
  options: GroundingPlannerOptions = {},
): GroundingPlan {
  if (!resolution.query.normalized) {
    return {
      kind: 'document-search',
      query,
      candidateDocIds: [],
      candidates: [],
      fallbackReason: 'empty-query',
    };
  }

  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const candidates = resolution.candidates.filter((candidate) => candidate.confidence >= threshold);
  const candidateDocIds = [
    ...new Set(
      candidates
        .map((candidate) => candidate.docId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const fallbackReason =
    resolution.candidates.length > 0 ? 'no-confident-candidate' : 'no-candidate';

  return {
    kind: 'document-search',
    query,
    candidateDocIds,
    candidates,
    ...(candidates.length === 0 ? { fallbackReason } : {}),
  };
}

export function mergeSemanticDocumentResults(
  input: SemanticDocumentMergeInput,
): readonly DocRecord[] {
  const order = new Map(input.candidateDocIds.map((docId, index) => [docId, index]));
  const semanticDocs = [...input.semanticDocs].toSorted(
    (left, right) =>
      (order.get(left.docId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.docId) ?? Number.MAX_SAFE_INTEGER) ||
      left.docId.localeCompare(right.docId),
  );
  const seen = new Set<string>();
  const merged: DocRecord[] = [];

  for (const doc of [...semanticDocs, ...input.legacyDocs]) {
    if (seen.has(doc.docId)) continue;
    seen.add(doc.docId);
    merged.push(doc);
  }

  return merged.slice(input.offset, input.offset + input.limit);
}
