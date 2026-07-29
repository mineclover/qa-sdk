// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { type DefDataSource, type DefFeedbackRequestSummary } from 'definition-catalog';

type FeedbackTraceMatch = {
  anchorDocId: string;
  request: DefFeedbackRequestSummary;
};

const BOUNDARY_LEVELS = new Set(['group', 'module']);

export async function collectFeedbackMatches(
  source: DefDataSource,
  docIds: readonly string[],
): Promise<FeedbackTraceMatch[]> {
  const seen = new Set<string>();
  const matches: FeedbackTraceMatch[] = [];
  for (const docId of docIds) {
    const requests = await source.getFeedbackRequestsByDocId(docId, 20);
    for (const request of requests) {
      const key = `${docId}:${request.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ anchorDocId: docId, request });
    }
  }
  return matches.toSorted((left, right) =>
    right.request.createdAt.localeCompare(left.request.createdAt),
  );
}
