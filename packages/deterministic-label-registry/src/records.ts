// @def.doc deterministic-label-architecture
import type { CompletedRecordState } from 'doc-envelope';
import {
  buildSemanticCoordinateCandidate,
  semanticCoordinateDiagnostic,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInput,
  type SemanticCoordinateDiagnostic,
  type SemanticCoordinateLabelKind,
  type SemanticPhysicalRef,
} from './coordinate.js';
import {
  collectSemanticCoordinateCandidatesFromDocuments,
  documentIdentityValues,
  isCandidateArchiveDocument,
  pathLikeReference,
  prdDocumentIdFromPath,
  sourceSubtype,
  type SemanticCoordinateCandidateInventoryOptions,
  type SemanticCoordinateSkippedDocument,
} from './projection.js';
import {
  asString,
  metadataStringArray,
  normalizeCoordinatePart,
  normalizeMetadata,
  normalizeRecordRefs,
  uniqueStrings,
} from './shared.js';
import { isTransientDocument } from 'doc-envelope';
import type { DocumentEnvelope, DocumentLink, DocumentMetadata, DocumentTask } from 'doc-envelope';

export interface DeterministicLabelRecord {
  readonly label: string;
  readonly kind: SemanticCoordinateLabelKind;
  readonly physicalRefs: readonly SemanticPhysicalRef[];
  readonly dependencyLabels: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly candidate: SemanticCoordinateCandidate;
  readonly metadata: DocumentMetadata;
}

export interface DeterministicLabelRecordInput {
  readonly candidate: SemanticCoordinateCandidate;
  readonly dependencyLabels?: readonly string[] | null;
  readonly sourceRefs?: readonly string[] | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly diagnostics?: readonly SemanticCoordinateDiagnostic[] | null;
  readonly metadata?: DocumentMetadata | null;
}

export interface DeterministicLabelRecordProjectionOptions extends SemanticCoordinateCandidateInventoryOptions {
  readonly completedRecords?: readonly CompletedRecordState[] | null;
}

export interface DeterministicLabelRecordProjection {
  readonly records: readonly DeterministicLabelRecord[];
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
}

export function buildDeterministicLabelRecord(
  input: DeterministicLabelRecordInput,
): DeterministicLabelRecord {
  const candidate = input.candidate;

  return {
    label: candidate.label,
    kind: candidate.kind,
    physicalRefs: candidate.physicalRefs.map((ref) => ({
      ...ref,
      metadata: normalizeMetadata(ref.metadata),
    })),
    dependencyLabels: normalizeRecordRefs(input.dependencyLabels),
    sourceRefs: normalizeRecordRefs(input.sourceRefs),
    evidenceRefs: normalizeRecordRefs(input.evidenceRefs),
    diagnostics: [...candidate.diagnostics, ...(input.diagnostics ?? [])],
    candidate,
    metadata: {
      ...candidate.metadata,
      ...normalizeMetadata(input.metadata),
    },
  };
}

export function projectDeterministicLabelRecordsFromDocuments(
  documents: readonly DocumentEnvelope[],
  options: DeterministicLabelRecordProjectionOptions = {},
): DeterministicLabelRecordProjection {
  const candidateInventory = collectSemanticCoordinateCandidatesFromDocuments(documents, options);
  const index = buildProjectionIndex(documents, candidateInventory.candidates);
  const completedRecords = buildCompletedRecordIndex(options.completedRecords);
  const records = candidateInventory.candidates
    .map((candidate) => {
      const document = index.documentByCandidate.get(candidate);
      const task = document ? taskForCandidate(document, candidate) : undefined;

      return buildDeterministicLabelRecord({
        candidate,
        dependencyLabels: document
          ? dependencyLabelsForCandidate(index, document, candidate, task)
          : [],
        sourceRefs: document ? sourceRefsForCandidate(index, document, candidate) : [],
        evidenceRefs: document ? evidenceRefsForCandidate(index, document, candidate, task) : [],
        diagnostics: document ? documentValidationDiagnosticsForCandidate(document, candidate) : [],
        metadata: document
          ? projectionRecordMetadata(document, completedRecords.get(documentKey(document)))
          : {
              projection: 'document-envelope',
              documentScope: 'unknown',
            },
      });
    })
    .toSorted(compareDeterministicLabelRecords);

  return {
    records,
    candidates: candidateInventory.candidates,
    diagnostics: candidateInventory.diagnostics,
    skippedDocuments: candidateInventory.skippedDocuments,
  };
}

/* --------------------------------------------------------------------------
 * Shared helpers (exported for use by sibling projection modules).
 * ------------------------------------------------------------------------ */

export function compareDeterministicLabelRecords(
  left: DeterministicLabelRecord,
  right: DeterministicLabelRecord,
): number {
  return (
    left.label.localeCompare(right.label) ||
    left.kind.localeCompare(right.kind) ||
    firstPhysicalRef(left).localeCompare(firstPhysicalRef(right))
  );
}

export function documentKey(document: DocumentEnvelope): string {
  return [
    document.adapterId,
    document.stableId,
    normalizeCoordinatePart(document.path) ?? document.path,
  ].join('\u001f');
}

export function candidateDocumentKey(candidate: SemanticCoordinateCandidate): string | undefined {
  const adapterId = asString(candidate.metadata.documentAdapterId);
  const stableId = asString(candidate.metadata.documentStableId);
  const path = asString(candidate.metadata.documentPath);
  if (!adapterId || !stableId || !path) return undefined;
  return [adapterId, stableId, normalizeCoordinatePart(path) ?? path].join('\u001f');
}

/* --------------------------------------------------------------------------
 * Private projection helpers.
 * ------------------------------------------------------------------------ */

interface ProjectionIndex {
  readonly documentByCandidate: ReadonlyMap<SemanticCoordinateCandidate, DocumentEnvelope>;
  readonly candidatesByDocumentKey: ReadonlyMap<string, readonly SemanticCoordinateCandidate[]>;
  readonly candidatesByReference: ReadonlyMap<string, readonly SemanticCoordinateCandidate[]>;
}

function buildProjectionIndex(
  documents: readonly DocumentEnvelope[],
  candidates: readonly SemanticCoordinateCandidate[],
): ProjectionIndex {
  const documentByKey = new Map(documents.map((document) => [documentKey(document), document]));
  const candidatesByDocumentKey = new Map<string, SemanticCoordinateCandidate[]>();
  const documentByCandidate = new Map<SemanticCoordinateCandidate, DocumentEnvelope>();
  const candidatesByReference = new Map<string, SemanticCoordinateCandidate[]>();

  for (const candidate of candidates) {
    const key = candidateDocumentKey(candidate);
    if (!key) continue;
    const document = documentByKey.get(key);
    if (!document) continue;

    documentByCandidate.set(candidate, document);
    addMapValue(candidatesByDocumentKey, key, candidate);
  }

  for (const [key, documentCandidates] of candidatesByDocumentKey.entries()) {
    const document = documentByKey.get(key);
    if (!document) continue;
    const preferred = preferredDocumentCandidates(documentCandidates);

    for (const value of documentIdentityValues(document)) {
      for (const candidate of preferred) {
        addCandidateReference(candidatesByReference, value, candidate);
      }
    }
  }

  for (const candidate of candidates) {
    addCandidateReference(candidatesByReference, candidate.label, candidate);
    addCandidateReference(candidatesByReference, candidate.id, candidate);
    addCandidateReference(candidatesByReference, candidate.originalId, candidate);
    for (const ref of candidate.physicalRefs) {
      addCandidateReference(candidatesByReference, ref.ref, candidate);
      addCandidateReference(candidatesByReference, ref.ref.split('#')[0], candidate);
    }
  }

  return {
    documentByCandidate,
    candidatesByDocumentKey,
    candidatesByReference,
  };
}

function dependencyLabelsForCandidate(
  index: ProjectionIndex,
  document: DocumentEnvelope,
  candidate: SemanticCoordinateCandidate,
  task: DocumentTask | undefined,
): readonly string[] {
  if (candidate.kind === 'source-file' || candidate.kind === 'evidence') {
    return [];
  }

  return normalizeRecordRefs([
    ...document.links.flatMap((link) => dependencyLabelsForLink(index, link)),
    ...(task ? taskDependencyLabels(index, document, task) : []),
  ]);
}

function sourceRefsForCandidate(
  index: ProjectionIndex,
  document: DocumentEnvelope,
  candidate: SemanticCoordinateCandidate,
): readonly string[] {
  if (candidate.kind === 'source-file' || candidate.kind === 'evidence') {
    return [];
  }

  return normalizeRecordRefs(
    candidatesForDocument(document, index)
      .filter(
        (item) => item.kind === 'source-file' && item.metadata.idSource === 'document.source.path',
      )
      .map((item) => item.label),
  );
}

function evidenceRefsForCandidate(
  index: ProjectionIndex,
  document: DocumentEnvelope,
  candidate: SemanticCoordinateCandidate,
  task: DocumentTask | undefined,
): readonly string[] {
  if (candidate.kind === 'source-file' || candidate.kind === 'evidence') {
    return [];
  }

  return normalizeRecordRefs([
    ...candidatesForDocument(document, index)
      .filter(
        (item) => item.kind === 'evidence' && item.metadata.idSource === 'document.evidence.id',
      )
      .map((item) => item.label),
    ...(task ? task.evidenceIds.flatMap((id) => evidenceLabelsForId(index, id)) : []),
  ]);
}

function dependencyLabelsForLink(index: ProjectionIndex, link: DocumentLink): readonly string[] {
  return labelsForReference(index, link.targetId, {
    fallbackKind: 'definition-doc',
    fallbackSubtype: 'spec',
  });
}

function taskDependencyLabels(
  index: ProjectionIndex,
  document: DocumentEnvelope,
  task: DocumentTask,
): readonly string[] {
  return taskDependencyIds(task).flatMap((dependencyId) => {
    if (isPrdStoryId(dependencyId)) {
      const label = buildSemanticCoordinateCandidate({
        kind: 'prd-story',
        parentId:
          prdDocumentIdFromPath(task.rawSource?.path ?? document.path) ??
          document.familyId ??
          document.stableId,
        id: dependencyId,
      }).candidate?.label;
      return label ? [label] : [];
    }
    return labelsForReference(index, dependencyId, {
      fallbackKind: 'definition-doc',
      fallbackSubtype: 'spec',
    });
  });
}

function evidenceLabelsForId(index: ProjectionIndex, evidenceId: string): readonly string[] {
  return labelsForReference(index, evidenceId, {
    fallbackKind: 'evidence',
    fallbackSubtype: 'evidence',
  });
}

function labelsForReference(
  index: ProjectionIndex,
  reference: string,
  fallback: {
    readonly fallbackKind: SemanticCoordinateLabelKind;
    readonly fallbackSubtype: string;
  },
): readonly string[] {
  const normalized = normalizeCoordinatePart(reference);
  if (!normalized) return [];
  if (normalized.startsWith('urn:')) return [normalized];

  const existing =
    index.candidatesByReference.get(normalized) ??
    index.candidatesByReference.get(normalized.replace(/\.(?:md|json)$/i, ''));
  if (existing && existing.length > 0) {
    return preferredDocumentCandidates(existing).map((candidate) => candidate.label);
  }

  const result = buildSemanticCoordinateCandidate(
    inferReferenceCandidateInput(normalized, fallback),
  );
  return result.candidate ? [result.candidate.label] : [];
}

function inferReferenceCandidateInput(
  reference: string,
  fallback: {
    readonly fallbackKind: SemanticCoordinateLabelKind;
    readonly fallbackSubtype: string;
  },
): SemanticCoordinateCandidateInput {
  const id = reference.replace(/\.(?:md|json)$/i, '');
  if (reference.endsWith('.json') && reference.startsWith('tasks/')) {
    return {
      kind: 'ralph-prd-json',
      id,
      version: 'v1',
    };
  }
  if (reference.endsWith('.md') && reference.startsWith('tasks/')) {
    return {
      kind: 'prd-markdown',
      id,
      version: 'v1',
    };
  }
  const sourcePath = pathLikeReference(reference);
  if (sourcePath) {
    return {
      kind: 'source-file',
      id: sourcePath,
      subtype: sourceSubtype(sourcePath),
    };
  }
  return {
    kind: fallback.fallbackKind,
    id: reference,
    subtype: fallback.fallbackSubtype,
    version: 'v1',
  };
}

function projectionRecordMetadata(
  document: DocumentEnvelope,
  completedRecord: CompletedRecordState | undefined,
): DocumentMetadata {
  const scope = documentInventoryScope(document);
  return {
    projection: 'document-envelope',
    documentScope: scope,
    activeScope: scope === 'active',
    archiveScope: scope === 'archive',
    transientScope: scope === 'transient',
    documentAdapterId: document.adapterId,
    documentKind: document.kind,
    documentStableId: document.stableId,
    ...(document.familyId ? { documentFamilyId: document.familyId } : {}),
    documentPath: document.path,
    ...(completedRecord
      ? {
          completedRecord: {
            source: completedRecord.source,
            kind: completedRecord.kind,
            documentId: completedRecord.documentId,
            path: completedRecord.path,
            state: completedRecord.state,
            title: completedRecord.title,
            ...(completedRecord.lifecycle ? { lifecycle: completedRecord.lifecycle } : {}),
            ...(completedRecord.completedCount !== undefined
              ? { completedCount: completedRecord.completedCount }
              : {}),
            ...(completedRecord.openCount !== undefined
              ? { openCount: completedRecord.openCount }
              : {}),
            ...(completedRecord.storyCount !== undefined
              ? { storyCount: completedRecord.storyCount }
              : {}),
            ...(completedRecord.passedStoryCount !== undefined
              ? { passedStoryCount: completedRecord.passedStoryCount }
              : {}),
            ...(completedRecord.pairedDocumentId
              ? { pairedDocumentId: completedRecord.pairedDocumentId }
              : {}),
            ...(completedRecord.pairedPath ? { pairedPath: completedRecord.pairedPath } : {}),
            reason: completedRecord.reason,
          },
        }
      : {}),
  };
}

function documentInventoryScope(document: DocumentEnvelope): 'active' | 'archive' | 'transient' {
  if (isTransientDocument(document)) return 'transient';
  if (isCandidateArchiveDocument(document)) return 'archive';
  return 'active';
}

function buildCompletedRecordIndex(
  records: readonly CompletedRecordState[] | null | undefined,
): ReadonlyMap<string, CompletedRecordState> {
  const index = new Map<string, CompletedRecordState>();
  for (const record of records ?? []) {
    index.set(
      [record.source, record.documentId, normalizeCoordinatePart(record.path) ?? record.path].join(
        '\u001f',
      ),
      record,
    );
  }
  return index;
}

function candidatesForDocument(
  document: DocumentEnvelope,
  index: ProjectionIndex,
): readonly SemanticCoordinateCandidate[] {
  return index.candidatesByDocumentKey.get(documentKey(document)) ?? [];
}

function taskForCandidate(
  document: DocumentEnvelope,
  candidate: SemanticCoordinateCandidate,
): DocumentTask | undefined {
  if (candidate.kind !== 'prd-story') return undefined;
  const storyId = asString(candidate.metadata.storyId) ?? candidate.originalId;
  return document.tasks.find((task) => task.id === storyId);
}

function taskDependencyIds(task: DocumentTask): readonly string[] {
  return uniqueStrings([
    ...metadataStringArray(task.metadata.dependsOn),
    ...metadataStringArray(task.metadata.prerequisites),
  ]);
}

function isPrdStoryId(value: string): boolean {
  return /^US-[A-Za-z0-9_-]+$/.test(value);
}

function preferredDocumentCandidates(
  candidates: readonly SemanticCoordinateCandidate[],
): readonly SemanticCoordinateCandidate[] {
  if (candidates.length <= 1) return candidates;
  const documentLike = candidates.filter(
    (candidate) => candidate.kind !== 'source-file' && candidate.kind !== 'evidence',
  );
  const pool = documentLike.length > 0 ? documentLike : candidates;
  const preferred =
    pool.find((candidate) => candidate.metadata.idSource === 'def.id') ??
    pool.find((candidate) => candidate.metadata.idSource === 'artifactId') ??
    pool.find((candidate) => candidate.metadata.idSource === 'packId') ??
    pool.find((candidate) => candidate.metadata.idSource === 'sourcePath') ??
    pool.find((candidate) => candidate.metadata.idSource === 'stableId') ??
    pool[0];
  return preferred ? [preferred] : [];
}

function addCandidateReference(
  map: Map<string, SemanticCoordinateCandidate[]>,
  value: string | undefined,
  candidate: SemanticCoordinateCandidate,
): void {
  const normalized = normalizeCoordinatePart(value);
  if (!normalized) return;
  addMapValue(map, normalized, candidate);
}

function addMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
    map.set(key, existing);
  }
}

function firstPhysicalRef(record: DeterministicLabelRecord): string {
  return record.physicalRefs[0]?.ref ?? '';
}

function documentValidationDiagnosticsForCandidate(
  document: DocumentEnvelope,
  candidate: SemanticCoordinateCandidate,
): readonly SemanticCoordinateDiagnostic[] {
  if (candidate.kind === 'source-file' || candidate.kind === 'evidence') {
    return [];
  }

  return document.diagnostics.map((diagnostic) =>
    semanticCoordinateDiagnostic({
      code: 'document-validation-signal',
      severity: diagnostic.severity === 'error' ? 'error' : 'warning',
      label: candidate.label,
      id: candidate.id,
      message: diagnostic.message,
      metadata: {
        projection: 'document-envelope',
        sourceCode: diagnostic.code,
        sourceSeverity: diagnostic.severity,
        ...(diagnostic.rawSource?.path ? { sourcePath: diagnostic.rawSource.path } : {}),
        ...(diagnostic.rawSource?.pointer ? { sourcePointer: diagnostic.rawSource.pointer } : {}),
        ...diagnostic.metadata,
      },
    }),
  );
}
