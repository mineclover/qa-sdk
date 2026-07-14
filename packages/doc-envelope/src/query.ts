// @def.doc doc-envelope

import type { DocumentCollectionQuery, DocumentEnvelope } from './types.js';

export function matchesDocumentQuery(
  envelope: DocumentEnvelope,
  query: DocumentCollectionQuery | undefined,
): boolean {
  if (!query) return true;
  if (query.kind && envelope.kind !== query.kind) return false;
  if (query.stableIds && !query.stableIds.includes(envelope.stableId)) return false;
  if (query.familyId && envelope.familyId !== query.familyId) return false;
  if (query.paths) {
    const paths = new Set(query.paths.map(normalizePath));
    if (!paths.has(envelope.path) && !paths.has(envelope.rawSource.path)) return false;
  }
  if (query.metadata) {
    for (const [key, expected] of Object.entries(query.metadata)) {
      const actual = envelope.metadata[key];
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) return false;
        continue;
      }
      if (actual !== expected) return false;
    }
  }
  return true;
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/');
}
