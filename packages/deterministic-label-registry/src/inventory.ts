// @def.doc deterministic-label-architecture
import { detectCompletedRecords, type CompletedRecordState } from 'doc-envelope';
import {
  projectDeterministicLabelRecordsFromDocuments,
  SEMANTIC_COORDINATE_LABEL_KINDS,
  type DeterministicLabelRecord,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInventoryOptions,
  type SemanticCoordinateDiagnostic,
  type SemanticCoordinateDiagnosticCode,
  type SemanticCoordinateLabelKind,
  type SemanticCoordinateSkippedDocument,
} from './index.js';
import type { DocumentAdapter, DocumentEnvelope } from 'doc-envelope';

export interface DeterministicLabelInventoryOptions extends SemanticCoordinateCandidateInventoryOptions {
  readonly rootDir: string;
  readonly documents?: readonly DocumentEnvelope[] | null;
  readonly adapters?: readonly DocumentAdapter[] | null;
  /**
   * Caller가 사전에 구성한 pack/artifact label record들을 document-projected
   * records와 병합한다. Label registry 자체는 pack validation 로직을 갖지 않는다
   * (purpose unit isolation). cli/ontology-pack-validate 쪽에서 원하는 형태로
   * 조립해 넘긴다.
   */
  readonly extraRecords?: readonly DeterministicLabelRecord[] | null;
  readonly completedRecords?: readonly CompletedRecordState[] | null;
  readonly detectCompletedRecords?: boolean;
}

export interface DeterministicLabelInventorySummary {
  readonly documents: number;
  readonly records: number;
  readonly candidates: number;
  readonly diagnostics: number;
  readonly skippedDocuments: number;
  readonly completedRecords: number;
  readonly byKind: Readonly<Record<SemanticCoordinateLabelKind, number>>;
  readonly byDiagnosticSeverity: Readonly<Record<'error' | 'warning', number>>;
  readonly byDiagnosticCode: Readonly<Partial<Record<SemanticCoordinateDiagnosticCode, number>>>;
}

export interface DeterministicLabelInventory {
  readonly documents: readonly DocumentEnvelope[];
  readonly records: readonly DeterministicLabelRecord[];
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly summary: DeterministicLabelInventorySummary;
}

export async function buildDeterministicLabelInventory(
  options: DeterministicLabelInventoryOptions,
): Promise<DeterministicLabelInventory> {
  const documents = await resolveInventoryDocuments(options);
  const completedRecords = await resolveCompletedRecords(options, documents);
  const documentProjection = projectDeterministicLabelRecordsFromDocuments(
    documents,
    projectionOptions(options, completedRecords),
  );
  const extraRecords = options.extraRecords ?? [];
  const mergedRecords = [...documentProjection.records, ...extraRecords];
  const mergedCandidates = [
    ...documentProjection.candidates,
    ...extraRecords.map((record) => record.candidate),
  ];
  const diagnostics = [
    ...documentProjection.diagnostics,
    ...extraRecords.flatMap((record) => record.diagnostics),
  ].toSorted(compareDiagnostics);
  const records = mergedRecords.toSorted(compareRecords);

  return {
    documents,
    records,
    candidates: mergedCandidates,
    diagnostics,
    skippedDocuments: documentProjection.skippedDocuments,
    completedRecords,
    summary: summarizeDeterministicLabelInventory({
      documents,
      records,
      candidates: mergedCandidates,
      diagnostics,
      skippedDocuments: documentProjection.skippedDocuments,
      completedRecords,
    }),
  };
}

async function resolveInventoryDocuments(
  options: DeterministicLabelInventoryOptions,
): Promise<readonly DocumentEnvelope[]> {
  if (options.documents) {
    return options.documents.toSorted(compareDocuments);
  }

  if (!options.adapters || options.adapters.length === 0) {
    return [];
  }

  const groups = await Promise.all(options.adapters.map((adapter) => adapter.listDocuments()));
  return groups.flat().toSorted(compareDocuments);
}

async function resolveCompletedRecords(
  options: DeterministicLabelInventoryOptions,
  documents: readonly DocumentEnvelope[],
): Promise<readonly CompletedRecordState[]> {
  if (options.completedRecords) {
    return options.completedRecords.toSorted(compareCompletedRecords);
  }
  if (options.detectCompletedRecords === false) {
    return [];
  }
  return detectCompletedRecords({
    rootDir: options.rootDir,
    documents,
  });
}

function projectionOptions(
  options: DeterministicLabelInventoryOptions,
  completedRecords: readonly CompletedRecordState[],
): {
  readonly includeArchive?: boolean;
  readonly includeTransient?: boolean;
  readonly exactTarget?: string | readonly string[] | null;
  readonly completedRecords: readonly CompletedRecordState[];
} {
  return {
    includeArchive: options.includeArchive,
    includeTransient: options.includeTransient,
    exactTarget: options.exactTarget,
    completedRecords,
  };
}

function summarizeDeterministicLabelInventory(input: {
  readonly documents: readonly DocumentEnvelope[];
  readonly records: readonly DeterministicLabelRecord[];
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
  readonly completedRecords: readonly CompletedRecordState[];
}): DeterministicLabelInventorySummary {
  return {
    documents: input.documents.length,
    records: input.records.length,
    candidates: input.candidates.length,
    diagnostics: input.diagnostics.length,
    skippedDocuments: input.skippedDocuments.length,
    completedRecords: input.completedRecords.length,
    byKind: countRecordsByKind(input.records),
    byDiagnosticSeverity: countDiagnosticsBySeverity(input.diagnostics),
    byDiagnosticCode: countDiagnosticsByCode(input.diagnostics),
  };
}

function countRecordsByKind(
  records: readonly DeterministicLabelRecord[],
): Readonly<Record<SemanticCoordinateLabelKind, number>> {
  const counts = Object.fromEntries(
    SEMANTIC_COORDINATE_LABEL_KINDS.map((kind) => [kind, 0]),
  ) as Record<SemanticCoordinateLabelKind, number>;
  for (const record of records) {
    counts[record.kind] += 1;
  }
  return counts;
}

function countDiagnosticsBySeverity(
  diagnostics: readonly SemanticCoordinateDiagnostic[],
): Readonly<Record<'error' | 'warning', number>> {
  const counts = { error: 0, warning: 0 };
  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity] += 1;
  }
  return counts;
}

function countDiagnosticsByCode(
  diagnostics: readonly SemanticCoordinateDiagnostic[],
): Readonly<Partial<Record<SemanticCoordinateDiagnosticCode, number>>> {
  const counts: Partial<Record<SemanticCoordinateDiagnosticCode, number>> = {};
  for (const diagnostic of diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).toSorted(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<SemanticCoordinateDiagnosticCode, number>>;
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return (
    left.path.localeCompare(right.path) ||
    left.kind.localeCompare(right.kind) ||
    left.stableId.localeCompare(right.stableId) ||
    left.adapterId.localeCompare(right.adapterId)
  );
}

function compareRecords(left: DeterministicLabelRecord, right: DeterministicLabelRecord): number {
  return (
    left.label.localeCompare(right.label) ||
    left.kind.localeCompare(right.kind) ||
    firstPhysicalRef(left).localeCompare(firstPhysicalRef(right))
  );
}

function firstPhysicalRef(record: DeterministicLabelRecord): string {
  return record.physicalRefs[0]?.ref ?? '';
}

function compareDiagnostics(
  left: SemanticCoordinateDiagnostic,
  right: SemanticCoordinateDiagnostic,
): number {
  return (
    (left.label ?? '').localeCompare(right.label ?? '') ||
    left.code.localeCompare(right.code) ||
    left.severity.localeCompare(right.severity) ||
    left.message.localeCompare(right.message) ||
    (left.id ?? '').localeCompare(right.id ?? '')
  );
}

function compareCompletedRecords(left: CompletedRecordState, right: CompletedRecordState): number {
  return (
    left.path.localeCompare(right.path) ||
    left.kind.localeCompare(right.kind) ||
    left.documentId.localeCompare(right.documentId)
  );
}
