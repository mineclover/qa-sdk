// @def.doc definition-catalog-spec

import type {
  DefCodeReference,
  DefDoc,
  DefFileBoundaryResolution,
  DefBoundaryResolutionCandidate,
} from './data-source.js';

export interface ResolveCodeBoundaryInput {
  codePath: string;
  references: readonly DefCodeReference[];
  docs: readonly DefDoc[];
}

/**
 * Resolve the authoritative code owner without promoting evidence to ownership.
 *
 * `sources` and `@def.doc` are supporting relationships. Only an explicit
 * `@def.boundary` relationship can produce a unique authoritative result.
 */
export function resolveCodeBoundary(input: ResolveCodeBoundaryInput): DefFileBoundaryResolution {
  const references = [...input.references];
  if (references.length === 0) {
    return { kind: 'none', codePath: input.codePath, references };
  }

  const docsById = new Map(input.docs.map((doc) => [doc.docId, doc] as const));
  const supportingDocs = [...docsById.values()].toSorted((left, right) =>
    left.docId.localeCompare(right.docId),
  );
  if (supportingDocs.length === 0) {
    return { kind: 'none', codePath: input.codePath, references };
  }

  const boundaryDocIds = [
    ...new Set(
      references
        .filter(
          (reference) =>
            reference.sourceKind === 'code_comment' && reference.relationType === 'boundary',
        )
        .map((reference) => reference.docId),
    ),
  ];
  const validBoundaryDocIds = boundaryDocIds.filter((docId) => docsById.has(docId));

  if (validBoundaryDocIds.length > 1) {
    const candidates: DefBoundaryResolutionCandidate[] = validBoundaryDocIds.map((docId) => ({
      anchor: docsById.get(docId)!,
      supportingDocs: supportingDocs.filter((doc) => doc.docId === docId),
      references,
    }));
    return { kind: 'ambiguous', codePath: input.codePath, candidates, references };
  }

  if (validBoundaryDocIds.length === 1 && boundaryDocIds.length === validBoundaryDocIds.length) {
    const anchor = docsById.get(validBoundaryDocIds[0]!)!;
    return {
      kind: 'unique',
      codePath: input.codePath,
      anchor,
      supportingDocs,
      references,
    };
  }

  return {
    kind: 'evidence-only',
    codePath: input.codePath,
    supportingDocs,
    references,
  };
}
