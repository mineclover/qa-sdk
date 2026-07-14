// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { CompletedRecordState, DocumentDiagnostic, DocumentEnvelope } from 'doc-envelope';

export type CompletedRecordCleanupAction =
  | 'keep-as-evidence'
  | 'archive-review'
  | 'memo-conversion-review'
  | 'promote-spec-review';

export interface CompletedRecordCleanupDocumentSummary {
  readonly stableId: string;
  readonly kind: string;
  readonly path: string;
  readonly title: string;
}

export interface CompletedRecordCleanupCandidate {
  readonly record: CompletedRecordState;
  readonly recommendation: {
    readonly action: CompletedRecordCleanupAction;
    readonly reason: string;
  };
  readonly allowedActions: readonly CompletedRecordCleanupAction[];
  readonly primaryDocument?: CompletedRecordCleanupDocumentSummary;
  readonly pairedDocument?: CompletedRecordCleanupDocumentSummary;
  readonly familyId?: string;
  readonly relatedDocuments: readonly CompletedRecordCleanupDocumentSummary[];
  readonly evidenceSummary: {
    readonly documents: number;
    readonly sources: number;
    readonly evidence: number;
    readonly diagnostics: number;
  };
}

export interface CompletedRecordCleanupReview {
  readonly candidates: readonly CompletedRecordCleanupCandidate[];
  readonly diagnostics: readonly DocumentDiagnostic[];
}

export interface BuildCompletedRecordCleanupReviewOptions {
  readonly documents: readonly DocumentEnvelope[];
  readonly completedRecords: readonly CompletedRecordState[];
}

const CLEANUP_ACTIONS = [
  'keep-as-evidence',
  'archive-review',
  'memo-conversion-review',
  'promote-spec-review',
] as const satisfies readonly CompletedRecordCleanupAction[];

export function buildCompletedRecordCleanupReview(
  options: BuildCompletedRecordCleanupReviewOptions,
): CompletedRecordCleanupReview {
  const diagnostics: DocumentDiagnostic[] = [];
  const candidates = options.completedRecords.map((record) => {
    const primaryDocument = findRecordDocument(record, options.documents);
    const pairedDocument = findPairedDocument(record, options.documents);
    const relatedDocuments = relatedDocumentsForRecord(
      record,
      primaryDocument,
      pairedDocument,
      options.documents,
    );

    if (!primaryDocument) {
      diagnostics.push({
        code: 'completed-record-review-primary-document-missing',
        severity: 'warning',
        message: `Completed record ${record.path} is no longer present in the scoped cleanup review.`,
        rawSource: {
          path: record.path,
          metadata: {},
        },
        metadata: {
          documentId: record.documentId,
          kind: record.kind,
          source: 'completed-record-review',
        },
      });
    }

    return {
      record,
      recommendation: recommendationForRecord(record, primaryDocument, relatedDocuments),
      allowedActions: CLEANUP_ACTIONS,
      ...(primaryDocument ? { primaryDocument: summarizeDocument(primaryDocument) } : {}),
      ...(pairedDocument ? { pairedDocument: summarizeDocument(pairedDocument) } : {}),
      ...(primaryDocument?.familyId ? { familyId: primaryDocument.familyId } : {}),
      relatedDocuments: relatedDocuments.map(summarizeDocument),
      evidenceSummary: {
        documents: relatedDocuments.length,
        sources: relatedDocuments.reduce((count, document) => count + document.sources.length, 0),
        evidence: relatedDocuments.reduce((count, document) => count + document.evidence.length, 0),
        diagnostics: relatedDocuments.reduce(
          (count, document) => count + document.diagnostics.length,
          0,
        ),
      },
    } satisfies CompletedRecordCleanupCandidate;
  });

  return {
    candidates,
    diagnostics,
  };
}

function recommendationForRecord(
  record: CompletedRecordState,
  primaryDocument: DocumentEnvelope | undefined,
  relatedDocuments: readonly DocumentEnvelope[],
): CompletedRecordCleanupCandidate['recommendation'] {
  if (record.kind === 'prd') {
    return {
      action: 'keep-as-evidence',
      reason:
        'Completed PRD markdown remains execution evidence unless an operator explicitly chooses archive or memo conversion.',
    };
  }

  if (
    record.kind === 'todo' &&
    relatedDocuments.some(
      (document) =>
        document.kind === 'spec' ||
        document.kind === 'rule' ||
        document.kind === 'cases' ||
        document.kind === 'test',
    )
  ) {
    return {
      action: 'promote-spec-review',
      reason:
        'Completed TODO already has same-family authority documents; review spec assimilation before pruning or archive decisions.',
    };
  }

  if (primaryDocument?.metadata.type === 'knowledge' || primaryDocument?.kind === 'memo') {
    return {
      action: 'keep-as-evidence',
      reason:
        'Knowledge-oriented completed records usually preserve rationale; keep them as evidence unless a stronger archive policy exists.',
    };
  }

  return {
    action: 'memo-conversion-review',
    reason:
      'Completed record has no stronger same-family authority signal; review memo conversion before cleanup.',
  };
}

function findRecordDocument(
  record: CompletedRecordState,
  documents: readonly DocumentEnvelope[],
): DocumentEnvelope | undefined {
  return documents.find(
    (document) => document.path === record.path || document.stableId === record.documentId,
  );
}

function findPairedDocument(
  record: CompletedRecordState,
  documents: readonly DocumentEnvelope[],
): DocumentEnvelope | undefined {
  if (record.pairedPath) {
    const pairedByPath = documents.find((document) => document.path === record.pairedPath);
    if (pairedByPath) return pairedByPath;
  }
  if (record.pairedDocumentId) {
    const pairedById = documents.find((document) => document.stableId === record.pairedDocumentId);
    if (pairedById) return pairedById;
  }
  return undefined;
}

function relatedDocumentsForRecord(
  record: CompletedRecordState,
  primaryDocument: DocumentEnvelope | undefined,
  pairedDocument: DocumentEnvelope | undefined,
  documents: readonly DocumentEnvelope[],
): readonly DocumentEnvelope[] {
  const related = new Map<string, DocumentEnvelope>();
  const add = (document: DocumentEnvelope | undefined) => {
    if (!document) return;
    related.set(documentKey(document), document);
  };

  add(primaryDocument);
  add(pairedDocument);

  if (primaryDocument?.familyId) {
    for (const document of documents) {
      if (document.familyId === primaryDocument.familyId) add(document);
    }
  }

  if (record.pairedPath) {
    for (const document of documents) {
      if (document.path === record.pairedPath) add(document);
    }
  }

  return [...related.values()].toSorted(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.kind.localeCompare(right.kind) ||
      left.stableId.localeCompare(right.stableId),
  );
}

function summarizeDocument(document: DocumentEnvelope): CompletedRecordCleanupDocumentSummary {
  return {
    stableId: document.stableId,
    kind: document.kind,
    path: document.path,
    title: titleOf(document),
  };
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ['title', 'name', 'defId'] as const) {
    const value = document.metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}
