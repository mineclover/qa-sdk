import {
  createArtifactEvidenceAdapter,
  type ArtifactEvidenceAdapterOptions,
} from "./adapters/artifact-evidence.js";
import {
  createDefinitionMarkdownAdapter,
  type DefinitionMarkdownAdapterOptions,
} from "./adapters/definition-markdown.js";
import {
  createPrdMarkdownAdapter,
  type PrdMarkdownAdapterOptions,
} from "./adapters/prd-markdown.js";
import {
  createRalphPrdJsonAdapter,
  type RalphPrdJsonAdapterOptions,
} from "./adapters/ralph-prd-json.js";
import {
  createRalphSessionAdapter,
  type RalphSessionAdapterOptions,
} from "./adapters/ralph-session.js";
import {
  detectCompletedRecords,
  type CompletedRecordState,
} from "./completed-records.js";
import {
  computeDeterministicLabelReadiness,
} from "./deterministic-label-fsm.js";
import {
  DETERMINISTIC_LABEL_RECORD_STATES,
  projectDeterministicLabelRecordsFromDocuments,
  projectOntologyPackAndArtifactLabelRecords,
  SEMANTIC_COORDINATE_LABEL_KINDS,
  type DeterministicLabelRecord,
  type DeterministicLabelRecordState,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInventoryOptions,
  type SemanticCoordinateDiagnostic,
  type SemanticCoordinateDiagnosticCode,
  type SemanticCoordinateLabelKind,
  type SemanticCoordinateSkippedDocument,
} from "./deterministic-labels.js";
import type {
  OntologyPackValidateResult,
} from "../ontology-pack-validate.js";
import type {
  DocumentAdapter,
  DocumentEnvelope,
} from "./types.js";

export interface DeterministicLabelInventoryOptions
  extends SemanticCoordinateCandidateInventoryOptions {
  readonly rootDir: string;
  readonly documents?: readonly DocumentEnvelope[] | null;
  readonly adapters?: readonly DocumentAdapter[] | null;
  readonly docsDirs?: readonly string[] | null;
  readonly prdDirs?: readonly string[] | null;
  readonly artifactRegistryPaths?: readonly string[] | null;
  readonly sessionPath?: string | null;
  readonly prdJsonPath?: string | null;
  readonly prdPath?: string | null;
  readonly completedRecords?: readonly CompletedRecordState[] | null;
  readonly detectCompletedRecords?: boolean;
  readonly includeOntologyPacks?: boolean;
  readonly packRefs?: readonly string[] | null;
  readonly packValidateResults?: readonly OntologyPackValidateResult[] | null;
  readonly computeReadiness?: boolean;
}

export interface DeterministicLabelInventorySummary {
  readonly documents: number;
  readonly records: number;
  readonly candidates: number;
  readonly diagnostics: number;
  readonly skippedDocuments: number;
  readonly completedRecords: number;
  readonly packValidations: number;
  readonly readinessComputed: boolean;
  readonly byKind: Readonly<Record<SemanticCoordinateLabelKind, number>>;
  readonly byState: Readonly<Record<DeterministicLabelRecordState, number>>;
  readonly byDiagnosticSeverity: Readonly<Record<"error" | "warning", number>>;
  readonly byDiagnosticCode: Readonly<Partial<Record<SemanticCoordinateDiagnosticCode, number>>>;
}

export interface DeterministicLabelInventory {
  readonly documents: readonly DocumentEnvelope[];
  readonly records: readonly DeterministicLabelRecord[];
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly packValidations: readonly OntologyPackValidateResult[];
  readonly summary: DeterministicLabelInventorySummary;
}

export async function buildDeterministicLabelInventory(
  options: DeterministicLabelInventoryOptions,
): Promise<DeterministicLabelInventory> {
  const documents = await resolveInventoryDocuments(options);
  const completedRecords = await resolveCompletedRecords(options, documents);
  const includeOntologyPacks = options.includeOntologyPacks !== false;
  const projection = includeOntologyPacks
    ? await projectOntologyPackAndArtifactLabelRecords({
        ...projectionOptions(options, completedRecords),
        rootDir: options.rootDir,
        documents,
        packRefs: options.packRefs,
        packValidateResults: options.packValidateResults,
      })
    : {
        ...projectDeterministicLabelRecordsFromDocuments(
          documents,
          projectionOptions(options, completedRecords),
        ),
        packValidations: [],
      };
  const readinessComputed = options.computeReadiness !== false;
  const readiness = readinessComputed
    ? computeDeterministicLabelReadiness(projection.records)
    : {
        records: projection.records,
        diagnostics: [],
      };
  const diagnostics = [
    ...projection.diagnostics,
    ...readiness.diagnostics,
  ].toSorted(compareDiagnostics);
  const records = readiness.records.toSorted(compareRecords);

  return {
    documents,
    records,
    candidates: projection.candidates,
    diagnostics,
    skippedDocuments: projection.skippedDocuments,
    completedRecords,
    packValidations: projection.packValidations,
    summary: summarizeDeterministicLabelInventory({
      documents,
      records,
      candidates: projection.candidates,
      diagnostics,
      skippedDocuments: projection.skippedDocuments,
      completedRecords,
      packValidations: projection.packValidations,
      readinessComputed,
    }),
  };
}

async function resolveInventoryDocuments(
  options: DeterministicLabelInventoryOptions,
): Promise<readonly DocumentEnvelope[]> {
  if (options.documents) {
    return options.documents.toSorted(compareDocuments);
  }

  const adapters = options.adapters ?? createDeterministicLabelInventoryAdapters(options);
  const groups = await Promise.all(adapters.map((adapter) => adapter.listDocuments()));
  return groups.flat().toSorted(compareDocuments);
}

function createDeterministicLabelInventoryAdapters(
  options: DeterministicLabelInventoryOptions,
): readonly DocumentAdapter[] {
  const definitionOptions: DefinitionMarkdownAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.docsDirs ? { docsDirs: options.docsDirs } : {}),
  };
  const prdMarkdownOptions: PrdMarkdownAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.prdDirs ? { dirs: options.prdDirs } : {}),
  };
  const ralphPrdOptions: RalphPrdJsonAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.prdDirs ? { dirs: options.prdDirs } : {}),
  };
  const sessionOptions: RalphSessionAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.sessionPath ? { path: options.sessionPath } : {}),
    ...(inventoryPrdJsonPath(options) ? { prdJsonPath: inventoryPrdJsonPath(options) } : {}),
  };
  const artifactOptions: ArtifactEvidenceAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.artifactRegistryPaths
      ? { registryPaths: options.artifactRegistryPaths }
      : {}),
  };

  return [
    createDefinitionMarkdownAdapter(definitionOptions),
    createPrdMarkdownAdapter(prdMarkdownOptions),
    createRalphPrdJsonAdapter(ralphPrdOptions),
    createRalphSessionAdapter(sessionOptions),
    createArtifactEvidenceAdapter(artifactOptions),
  ];
}

function inventoryPrdJsonPath(
  options: DeterministicLabelInventoryOptions,
): string | undefined {
  return options.prdJsonPath
    ?? (options.prdPath?.endsWith(".json") ? options.prdPath : undefined)
    ?? undefined;
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
  readonly includeSession?: boolean;
  readonly exactTarget?: string | readonly string[] | null;
  readonly completedRecords: readonly CompletedRecordState[];
} {
  return {
    includeArchive: options.includeArchive,
    includeSession: options.includeSession,
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
  readonly packValidations: readonly OntologyPackValidateResult[];
  readonly readinessComputed: boolean;
}): DeterministicLabelInventorySummary {
  return {
    documents: input.documents.length,
    records: input.records.length,
    candidates: input.candidates.length,
    diagnostics: input.diagnostics.length,
    skippedDocuments: input.skippedDocuments.length,
    completedRecords: input.completedRecords.length,
    packValidations: input.packValidations.length,
    readinessComputed: input.readinessComputed,
    byKind: countRecordsByKind(input.records),
    byState: countRecordsByState(input.records),
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

function countRecordsByState(
  records: readonly DeterministicLabelRecord[],
): Readonly<Record<DeterministicLabelRecordState, number>> {
  const counts = Object.fromEntries(
    DETERMINISTIC_LABEL_RECORD_STATES.map((state) => [state, 0]),
  ) as Record<DeterministicLabelRecordState, number>;
  for (const record of records) {
    counts[record.currentState] += 1;
  }
  return counts;
}

function countDiagnosticsBySeverity(
  diagnostics: readonly SemanticCoordinateDiagnostic[],
): Readonly<Record<"error" | "warning", number>> {
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
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId)
    || left.adapterId.localeCompare(right.adapterId);
}

function compareRecords(
  left: DeterministicLabelRecord,
  right: DeterministicLabelRecord,
): number {
  return left.label.localeCompare(right.label)
    || left.kind.localeCompare(right.kind)
    || firstPhysicalRef(left).localeCompare(firstPhysicalRef(right));
}

function firstPhysicalRef(record: DeterministicLabelRecord): string {
  return record.physicalRefs[0]?.ref ?? "";
}

function compareDiagnostics(
  left: SemanticCoordinateDiagnostic,
  right: SemanticCoordinateDiagnostic,
): number {
  return (left.label ?? "").localeCompare(right.label ?? "")
    || left.code.localeCompare(right.code)
    || left.severity.localeCompare(right.severity)
    || left.message.localeCompare(right.message)
    || (left.id ?? "").localeCompare(right.id ?? "");
}

function compareCompletedRecords(
  left: CompletedRecordState,
  right: CompletedRecordState,
): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.documentId.localeCompare(right.documentId);
}
