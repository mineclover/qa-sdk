import {
  isArchivedPrdDocument,
  isTransientSessionDocument,
} from "./family-scope.js";
import {
  KNOWN_ONTOLOGY_PACK_IDS,
} from "../known-ontology-packs.js";
import {
  validateOntologyPackFromRef,
  type OntologyPackValidateFileReadiness,
  type OntologyPackValidateIssue,
  type OntologyPackValidateResult,
} from "../ontology-pack-validate.js";
import type {
  CompletedRecordState,
} from "./completed-records.js";
import type {
  DocumentEnvelope,
  DocumentLink,
  DocumentMetadata,
  DocumentSource,
  DocumentTask,
} from "./types.js";

export const SEMANTIC_COORDINATE_LABEL_KINDS = [
  "definition-doc",
  "source-file",
  "ontology-pack",
  "artifact",
  "prd-markdown",
  "ralph-prd-json",
  "prd-story",
  "evidence",
] as const;

export type SemanticCoordinateLabelKind =
  (typeof SEMANTIC_COORDINATE_LABEL_KINDS)[number];

export const SEMANTIC_COORDINATE_DOMAINS = [
  "def",
  "source",
  "pack",
  "artifact",
  "prd",
] as const;

export type SemanticCoordinateDomain =
  (typeof SEMANTIC_COORDINATE_DOMAINS)[number];

export const SEMANTIC_COORDINATE_DIAGNOSTIC_CODES = [
  "semantic-coordinate-missing-kind",
  "semantic-coordinate-invalid-kind",
  "semantic-coordinate-invalid-version",
  "semantic-coordinate-ambiguous-physical-ref",
  "semantic-coordinate-collision-candidate",
  "ontology-pack-validate-issue",
  "ontology-pack-readiness-warning",
] as const;

export type SemanticCoordinateDiagnosticCode =
  (typeof SEMANTIC_COORDINATE_DIAGNOSTIC_CODES)[number];

export interface SemanticCoordinateDiagnostic {
  readonly code: SemanticCoordinateDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly label?: string;
  readonly id?: string;
  readonly metadata: DocumentMetadata;
}

export const SEMANTIC_PHYSICAL_REF_KINDS = [
  "definition-path",
  "source-path",
  "pack-id",
  "artifact-ref",
  "artifact-output-path",
  "prd-path",
  "ralph-prd-json-path",
  "evidence-ref",
] as const;

export type SemanticPhysicalRefKind =
  (typeof SEMANTIC_PHYSICAL_REF_KINDS)[number];

export interface SemanticPhysicalRef {
  readonly kind: SemanticPhysicalRefKind;
  readonly ref: string;
  readonly role?: "primary" | "source" | "evidence" | "related";
  readonly metadata: DocumentMetadata;
}

export interface SemanticPhysicalRefInput {
  readonly kind: SemanticPhysicalRefKind;
  readonly ref: string;
  readonly role?: "primary" | "source" | "evidence" | "related" | null;
  readonly metadata?: DocumentMetadata | null;
}

export interface SemanticCoordinate {
  readonly scheme: "urn";
  readonly domain: SemanticCoordinateDomain;
  readonly parts: readonly string[];
  readonly value: string;
}

export interface SemanticCoordinateCandidate {
  readonly label: string;
  readonly kind: SemanticCoordinateLabelKind;
  readonly domain: SemanticCoordinateDomain;
  readonly id: string;
  readonly parentId?: string;
  readonly subtype: string;
  readonly version?: string;
  readonly coordinate: SemanticCoordinate;
  readonly physicalRefs: readonly SemanticPhysicalRef[];
  /**
   * Existing repository ids stay here. The candidate label is a projection and
   * never replaces source-owned def ids, source paths, pack ids, or story ids.
   */
  readonly originalId: string;
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly metadata: DocumentMetadata;
}

export interface SemanticCoordinateCandidateInput {
  readonly kind?: string | null;
  readonly id: string;
  readonly parentId?: string | null;
  readonly subtype?: string | null;
  readonly version?: string | null;
  readonly physicalRefs?: readonly SemanticPhysicalRefInput[] | null;
  readonly metadata?: DocumentMetadata | null;
}

export interface SemanticCoordinateCandidateResult {
  readonly candidate?: SemanticCoordinateCandidate;
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
}

export const SEMANTIC_EXISTING_ID_SOURCES = [
  "def.id",
  "stableId",
  "familyId",
  "sourcePath",
  "packId",
  "artifactId",
  "prd.storyId",
  "document.source.path",
  "document.evidence.id",
] as const;

export type SemanticExistingIdSource =
  (typeof SEMANTIC_EXISTING_ID_SOURCES)[number];

export interface SemanticCoordinateCandidateInventoryOptions {
  readonly includeArchive?: boolean;
  readonly includeSession?: boolean;
  readonly exactTarget?: string | readonly string[] | null;
}

export interface SemanticCoordinateSkippedDocument {
  readonly stableId: string;
  readonly path: string;
  readonly reason: "archive" | "session";
  readonly metadata: DocumentMetadata;
}

export interface SemanticCoordinateCandidateInventory {
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
}

export const DETERMINISTIC_LABEL_RECORD_STATES = [
  "DRAFT",
  "LINTED",
  "RESOLVED",
  "ACTIVE",
  "DEPRECATED",
  "ARCHIVED",
  "BLOCKED",
] as const;

export type DeterministicLabelRecordState =
  (typeof DETERMINISTIC_LABEL_RECORD_STATES)[number];

export interface DeterministicLabelRecord {
  readonly label: string;
  readonly kind: SemanticCoordinateLabelKind;
  readonly currentState: DeterministicLabelRecordState;
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
  readonly currentState?: DeterministicLabelRecordState | null;
  readonly dependencyLabels?: readonly string[] | null;
  readonly sourceRefs?: readonly string[] | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly diagnostics?: readonly SemanticCoordinateDiagnostic[] | null;
  readonly metadata?: DocumentMetadata | null;
}

export interface DeterministicLabelRecordProjectionOptions
  extends SemanticCoordinateCandidateInventoryOptions {
  readonly completedRecords?: readonly CompletedRecordState[] | null;
}

export interface DeterministicLabelRecordProjection {
  readonly records: readonly DeterministicLabelRecord[];
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
}

export interface OntologyPackAndArtifactLabelRecordProjectionOptions
  extends DeterministicLabelRecordProjectionOptions {
  readonly rootDir?: string;
  readonly packRefs?: readonly string[] | null;
  readonly packValidateResults?: readonly OntologyPackValidateResult[] | null;
  readonly documents?: readonly DocumentEnvelope[] | null;
}

export interface OntologyPackAndArtifactLabelRecordProjection
  extends DeterministicLabelRecordProjection {
  readonly packValidations: readonly OntologyPackValidateResult[];
}

export interface OntologyPackLabelRecordOptions {
  readonly sourceRefs?: readonly string[] | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly diagnostics?: readonly SemanticCoordinateDiagnostic[] | null;
}

export const SEMANTIC_COORDINATE_CANONICAL_EXAMPLES = {
  definitionDoc: "urn:def:spec:docs-control-plane:v1",
  sourceFile: "urn:source:typescript:packages/cli/src/commands/docs.ts",
  ontologyPack: "urn:pack:ontology:programming-artifact-ontology:v1",
  artifact: "urn:artifact:activation-evidence:programming-artifact-ontology:v1",
  prdMarkdown: "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
  ralphPrdJson: "urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
  prdStory: "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-001",
  evidence: "urn:artifact:evidence:checkout-proof:v1",
} as const;

const labelKindSet = new Set<string>(SEMANTIC_COORDINATE_LABEL_KINDS);
const versionPattern = /^v[1-9][0-9]*$/;

const DEFAULT_SUBTYPE_BY_KIND = {
  "definition-doc": "spec",
  "source-file": "file",
  "ontology-pack": "ontology",
  artifact: "artifact",
  "prd-markdown": "markdown",
  "ralph-prd-json": "ralph-json",
  "prd-story": "story",
  evidence: "evidence",
} as const satisfies Readonly<Record<SemanticCoordinateLabelKind, string>>;

const DOMAIN_BY_KIND = {
  "definition-doc": "def",
  "source-file": "source",
  "ontology-pack": "pack",
  artifact: "artifact",
  "prd-markdown": "prd",
  "ralph-prd-json": "prd",
  "prd-story": "prd",
  evidence: "artifact",
} as const satisfies Readonly<Record<SemanticCoordinateLabelKind, SemanticCoordinateDomain>>;

export function isSemanticCoordinateLabelKind(
  value: string,
): value is SemanticCoordinateLabelKind {
  return labelKindSet.has(value);
}

export function buildSemanticCoordinateCandidate(
  input: SemanticCoordinateCandidateInput,
): SemanticCoordinateCandidateResult {
  const metadata = normalizeMetadata(input.metadata);
  const diagnostics: SemanticCoordinateDiagnostic[] = [];
  const originalId = input.id.trim();
  const id = normalizeCoordinatePart(input.id) ?? "";
  const kind = normalizeKind(input.kind, id, diagnostics);
  const physicalRefs = normalizePhysicalRefs(input.physicalRefs);

  diagnostics.push(...diagnoseAmbiguousPhysicalRefs(physicalRefs, id));

  if (!kind) {
    return { diagnostics };
  }

  const subtype = normalizeCoordinatePart(input.subtype)
    ?? DEFAULT_SUBTYPE_BY_KIND[kind];
  const parentId = normalizeCoordinatePart(input.parentId);
  const version = normalizeVersion(input.version, id, diagnostics);
  const coordinate = buildSemanticCoordinate({
    kind,
    id,
    parentId,
    subtype,
    version,
  });

  return {
    candidate: {
      label: coordinate.value,
      kind,
      domain: coordinate.domain,
      id,
      ...(parentId ? { parentId } : {}),
      subtype,
      ...(version ? { version } : {}),
      coordinate,
      physicalRefs,
      originalId,
      diagnostics,
      metadata,
    },
    diagnostics,
  };
}

export function collectSemanticCoordinateCandidatesFromDocuments(
  documents: readonly DocumentEnvelope[],
  options: SemanticCoordinateCandidateInventoryOptions = {},
): SemanticCoordinateCandidateInventory {
  const exactTargets = normalizeExactTargets(options.exactTarget);
  const candidates: SemanticCoordinateCandidate[] = [];
  const diagnostics: SemanticCoordinateDiagnostic[] = [];
  const skippedDocuments: SemanticCoordinateSkippedDocument[] = [];

  for (const document of documents) {
    const inactiveReason = inactiveDocumentReason(document, options, exactTargets);
    if (inactiveReason) {
      skippedDocuments.push({
        stableId: document.stableId,
        path: document.path,
        reason: inactiveReason,
        metadata: {
          adapterId: document.adapterId,
          kind: document.kind,
        },
      });
      continue;
    }

    const results = buildSemanticCoordinateCandidatesFromDocument(document);
    candidates.push(...results.candidates);
    diagnostics.push(...results.diagnostics);
  }

  diagnostics.push(...detectSemanticCoordinateCandidateCollisions(candidates));

  return {
    candidates,
    diagnostics,
    skippedDocuments,
  };
}

export function buildDeterministicLabelRecord(
  input: DeterministicLabelRecordInput,
): DeterministicLabelRecord {
  const candidate = input.candidate;

  return {
    label: candidate.label,
    kind: candidate.kind,
    currentState: input.currentState ?? "DRAFT",
    physicalRefs: candidate.physicalRefs.map((ref) => ({
      ...ref,
      metadata: normalizeMetadata(ref.metadata),
    })),
    dependencyLabels: normalizeRecordRefs(input.dependencyLabels),
    sourceRefs: normalizeRecordRefs(input.sourceRefs),
    evidenceRefs: normalizeRecordRefs(input.evidenceRefs),
    diagnostics: [
      ...candidate.diagnostics,
      ...(input.diagnostics ?? []),
    ],
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
  const records = candidateInventory.candidates.map((candidate) => {
    const document = index.documentByCandidate.get(candidate);
    const task = document ? taskForCandidate(document, candidate) : undefined;

    return buildDeterministicLabelRecord({
      candidate,
      dependencyLabels: document
        ? dependencyLabelsForCandidate(index, document, candidate, task)
        : [],
      sourceRefs: document ? sourceRefsForCandidate(index, document, candidate) : [],
      evidenceRefs: document
        ? evidenceRefsForCandidate(index, document, candidate, task)
        : [],
      metadata: document
        ? projectionRecordMetadata(
          document,
          completedRecords.get(documentKey(document)),
        )
        : {
          projection: "document-envelope",
          documentScope: "unknown",
        },
    });
  }).toSorted(compareDeterministicLabelRecords);

  return {
    records,
    candidates: candidateInventory.candidates,
    diagnostics: candidateInventory.diagnostics,
    skippedDocuments: candidateInventory.skippedDocuments,
  };
}

export async function projectOntologyPackAndArtifactLabelRecords(
  options: OntologyPackAndArtifactLabelRecordProjectionOptions = {},
): Promise<OntologyPackAndArtifactLabelRecordProjection> {
  const packValidations = options.packValidateResults
    ? [...options.packValidateResults]
    : await Promise.all(
        (options.packRefs ?? KNOWN_ONTOLOGY_PACK_IDS).map((packRef) =>
          validateOntologyPackFromRef({
            packRef,
            ...(options.rootDir ? { rootDir: options.rootDir } : {}),
          }),
        ),
      );
  const documents = options.documents ?? [];
  const documentProjection = projectDeterministicLabelRecordsFromDocuments(
    documents,
    options,
  );
  const packRecords = packValidations.map((result) => {
    const packId = result.packId ?? result.resolution.knownPackId ?? result.packRef;
    const documentPackRefs = documentLabelRefsForPack(
      packId,
      documents,
      documentProjection.records,
    );
    return buildOntologyPackLabelRecordFromValidateResult(result, {
      sourceRefs: documentPackRefs.sourceRefs,
      evidenceRefs: documentPackRefs.evidenceRefs,
    });
  });
  const packRecordLabels = new Set(packRecords.map((record) => record.label));
  const documentRecords = documentProjection.records.filter((record) =>
    !packRecordLabels.has(record.label)
  );
  const records = [...packRecords, ...documentRecords]
    .toSorted(compareDeterministicLabelRecords);

  return {
    records,
    candidates: records.map((record) => record.candidate),
    diagnostics: [
      ...documentProjection.diagnostics,
      ...packRecords.flatMap((record) => record.diagnostics),
    ],
    skippedDocuments: documentProjection.skippedDocuments,
    packValidations,
  };
}

export function buildOntologyPackLabelRecordFromValidateResult(
  result: OntologyPackValidateResult,
  options: OntologyPackLabelRecordOptions = {},
): DeterministicLabelRecord {
  const packId = result.packId ?? result.resolution.knownPackId ?? result.packRef;
  const candidateResult = buildSemanticCoordinateCandidate({
    kind: "ontology-pack",
    id: packId,
    version: "v1",
    physicalRefs: ontologyPackValidationPhysicalRefs(result),
    metadata: {
      idSource: result.resolution.kind === "known-pack" ? "knownPackId" : "packRef",
      projection: "ontology-pack-validate",
      packRef: result.packRef,
      packId,
      resolutionKind: result.resolution.kind,
      ...(result.resolution.knownPackId
        ? { knownPackId: result.resolution.knownPackId }
        : {}),
      ...(result.resolution.filePath ? { filePath: result.resolution.filePath } : {}),
    },
  });

  const candidate = candidateResult.candidate;
  if (!candidate) {
    throw new Error(`Unable to build ontology pack label record for ${packId}`);
  }

  return buildDeterministicLabelRecord({
    candidate,
    sourceRefs: [
      ...sourceRefsForOntologyPackValidation(result),
      ...(options.sourceRefs ?? []),
    ],
    evidenceRefs: options.evidenceRefs,
    diagnostics: [
      ...ontologyPackValidationDiagnostics(result, candidate.label),
      ...(options.diagnostics ?? []),
    ],
    metadata: ontologyPackValidationMetadata(result),
  });
}

function ontologyPackValidationPhysicalRefs(
  result: OntologyPackValidateResult,
): readonly SemanticPhysicalRefInput[] {
  const packId = result.packId ?? result.resolution.knownPackId ?? result.packRef;
  const refs: SemanticPhysicalRefInput[] = [];

  if (result.resolution.filePath) {
    refs.push({
      kind: "source-path",
      ref: result.resolution.filePath,
      role: "primary",
      metadata: {
        resolutionKind: result.resolution.kind,
      },
    });
  }

  refs.push({
    kind: "pack-id",
    ref: packId,
    role: result.resolution.filePath ? "related" : "primary",
    metadata: {
      resolutionKind: result.resolution.kind,
      ...(result.resolution.knownPackId
        ? { knownPackId: result.resolution.knownPackId }
        : {}),
    },
  });

  return refs;
}

function ontologyPackValidationMetadata(
  result: OntologyPackValidateResult,
): DocumentMetadata {
  return {
    projection: "ontology-pack-validate",
    packRef: result.packRef,
    packId: result.packId,
    valid: result.valid,
    resolution: {
      kind: result.resolution.kind,
      packRef: result.resolution.packRef,
      ...(result.resolution.knownPackId
        ? { knownPackId: result.resolution.knownPackId }
        : {}),
      ...(result.resolution.filePath ? { filePath: result.resolution.filePath } : {}),
      ...(result.resolution.supportedFilePath
        ? { supportedFilePath: result.resolution.supportedFilePath }
        : {}),
    },
    ontologyPackValidate: {
      valid: result.valid,
      identity: result.identity,
      componentSchema: result.componentSchema,
      systemBindings: result.systemBindings,
      runtime: result.runtime,
      readiness: {
        implementationFiles: packFileReadinessMetadata(
          result.readiness.implementationFiles,
        ),
        testFiles: packFileReadinessMetadata(result.readiness.testFiles),
        docs: result.readiness.docs,
        sourceMap: result.readiness.sourceMap,
      },
      readinessStatus: {
        implementationFiles: result.readiness.implementationFiles.status,
        testFiles: result.readiness.testFiles.status,
        docs: result.readiness.docs.status,
        sourceMap: result.readiness.sourceMap.status,
      },
    },
  };
}

function packFileReadinessMetadata(
  readiness: OntologyPackValidateFileReadiness,
): DocumentMetadata {
  return {
    status: readiness.status,
    checked: readiness.checked.map(packFileRefMetadata),
    missing: readiness.missing.map(packFileRefMetadata),
    counts: {
      checked: readiness.checked.length,
      missing: readiness.missing.length,
    },
  };
}

function packFileRefMetadata(
  ref: OntologyPackValidateFileReadiness["checked"][number],
): DocumentMetadata {
  const { absolutePath: _absolutePath, ...metadata } = ref;
  return metadata;
}

function sourceRefsForOntologyPackValidation(
  result: OntologyPackValidateResult,
): readonly string[] {
  return normalizeRecordRefs([
    ...result.readiness.implementationFiles.checked.map((ref) =>
      sourceLabelForPath(ref.path)
    ),
    ...result.readiness.testFiles.checked.map((ref) =>
      sourceLabelForPath(ref.path)
    ),
  ]);
}

function sourceLabelForPath(path: string): string | undefined {
  return buildSemanticCoordinateCandidate({
    kind: "source-file",
    id: path,
    subtype: sourceSubtype(path),
  }).candidate?.label;
}

function documentLabelRefsForPack(
  packId: string,
  documents: readonly DocumentEnvelope[],
  records: readonly DeterministicLabelRecord[],
): {
  readonly sourceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
} {
  const documentKeys = new Set(
    documents
      .filter((document) => documentPackId(document) === packId)
      .map(documentKey),
  );
  if (documentKeys.size === 0) {
    return {
      sourceRefs: [],
      evidenceRefs: [],
    };
  }

  const relatedRecords = records.filter((record) => {
    const key = candidateDocumentKey(record.candidate);
    return key ? documentKeys.has(key) : false;
  });

  return {
    sourceRefs: normalizeRecordRefs(
      relatedRecords
        .filter((record) => record.kind === "source-file")
        .map((record) => record.label),
    ),
    evidenceRefs: normalizeRecordRefs(
      relatedRecords
        .filter((record) => record.kind === "artifact" || record.kind === "evidence")
        .map((record) => record.label),
    ),
  };
}

function ontologyPackValidationDiagnostics(
  result: OntologyPackValidateResult,
  label: string,
): readonly SemanticCoordinateDiagnostic[] {
  return result.issues.map((issue) =>
    semanticCoordinateDiagnostic({
      code: ontologyPackValidationDiagnosticCode(issue),
      severity: issue.level,
      label,
      id: result.packId ?? result.packRef,
      message: issue.message,
      metadata: {
        projection: "ontology-pack-validate",
        packRef: result.packRef,
        packId: result.packId,
        issueCode: issue.code,
        issueSource: issue.source,
        issuePath: issue.path,
        ...(issue.blueprintId ? { blueprintId: issue.blueprintId } : {}),
        ...(issue.details ? { details: issue.details } : {}),
      },
    }),
  );
}

function ontologyPackValidationDiagnosticCode(
  issue: OntologyPackValidateIssue,
): SemanticCoordinateDiagnosticCode {
  if (
    issue.level === "warning"
    && (issue.path.startsWith("readiness.")
      || issue.source === "docs"
      || issue.source === "source-map")
  ) {
    return "ontology-pack-readiness-warning";
  }
  return "ontology-pack-validate-issue";
}

export function buildSemanticCoordinateCandidatesFromDocument(
  document: DocumentEnvelope,
): SemanticCoordinateCandidateInventory {
  const candidates: SemanticCoordinateCandidate[] = [];
  const diagnostics: SemanticCoordinateDiagnostic[] = [];

  const add = (input: SemanticCoordinateCandidateInput): void => {
    const result = buildSemanticCoordinateCandidate(input);
    if (result.candidate) {
      candidates.push(result.candidate);
    } else {
      // candidate 생성 실패(kind 누락/무효 등) 시에만 inventory 레벨로 surfacing
      diagnostics.push(...result.diagnostics);
    }
  };

  const documentRefs = documentPhysicalRefs(document);
  const sourcePath = asString(document.metadata.sourcePath) ?? document.rawSource.path;
  const defaultVersion = documentVersion(document);

  if (isDefinitionDocument(document)) {
    const subtype = definitionSubtype(document);
    const defId = asString(document.metadata.defId);
    if (defId) {
      add({
        kind: "definition-doc",
        id: defId,
        subtype,
        version: defaultVersion,
        physicalRefs: documentRefs,
        metadata: candidateMetadata(document, "def.id"),
      });
    }
    add({
      kind: "definition-doc",
      id: document.stableId,
      subtype,
      version: defaultVersion,
      physicalRefs: documentRefs,
      metadata: candidateMetadata(document, "stableId"),
    });
    if (document.familyId) {
      add({
        kind: "definition-doc",
        id: document.familyId,
        subtype: "family",
        version: defaultVersion,
        physicalRefs: documentRefs,
        metadata: candidateMetadata(document, "familyId"),
      });
    }
  }

  if (document.kind === "prd" || document.kind === "ralph-prd-json") {
    const kind = document.kind === "prd" ? "prd-markdown" : "ralph-prd-json";
    const pathId = prdDocumentIdFromPath(sourcePath);
    add({
      kind,
      id: document.stableId,
      version: defaultVersion,
      physicalRefs: documentRefs,
      metadata: candidateMetadata(document, "stableId"),
    });
    if (document.familyId && document.familyId !== document.stableId) {
      add({
        kind,
        id: document.familyId,
        version: defaultVersion,
        physicalRefs: documentRefs,
        metadata: candidateMetadata(document, "familyId"),
      });
    }
    if (pathId && pathId !== document.stableId && pathId !== document.familyId) {
      add({
        kind,
        id: pathId,
        version: defaultVersion,
        physicalRefs: documentRefs,
        metadata: candidateMetadata(document, "sourcePath"),
      });
    }
    for (const task of document.tasks) {
      addPrdStoryCandidate(add, document, task);
    }
  }

  const artifactId = asString(document.metadata.artifactId);
  if (artifactId) {
    add({
      kind: "artifact",
      id: artifactId,
      subtype: artifactSubtype(document),
      version: defaultVersion,
      physicalRefs: artifactPhysicalRefs(document),
      metadata: candidateMetadata(document, "artifactId"),
    });
  } else if (isArtifactLikeDocument(document)) {
    add({
      kind: "artifact",
      id: document.stableId,
      subtype: artifactSubtype(document),
      version: defaultVersion,
      physicalRefs: artifactPhysicalRefs(document),
      metadata: candidateMetadata(document, "stableId"),
    });
  }

  const packId = documentPackId(document);
  if (packId) {
    add({
      kind: "ontology-pack",
      id: packId,
      version: defaultVersion,
      physicalRefs: [
        {
          kind: "pack-id",
          ref: packId,
          role: "primary",
        },
        ...documentRefs.map((ref) => ({ ...ref, role: "related" as const })),
      ],
      metadata: candidateMetadata(document, "packId"),
    });
  }

  if (sourcePath) {
    addSourcePathCandidate(add, document, sourcePath, "sourcePath");
  }
  for (const source of document.sources) {
    addDocumentSourceCandidate(add, document, source);
  }
  for (const source of metadataStringArray(document.metadata.contextSources)) {
    addSourcePathCandidate(add, document, source, "document.source.path", {
      sourceKind: "context_source",
    });
  }
  for (const evidence of document.evidence) {
    add({
      kind: "evidence",
      id: evidence.id,
      subtype: asString(evidence.kind) ?? artifactSubtype(document) ?? "evidence",
      version: defaultVersion,
      physicalRefs: evidencePhysicalRefs(document, evidence.rawSource?.path, evidence.rawSource?.pointer),
      metadata: candidateMetadata(document, "document.evidence.id", {
        evidenceKind: evidence.kind,
      }),
    });
  }

  return {
    candidates,
    diagnostics,
    skippedDocuments: [],
  };
}

export function detectSemanticCoordinateCandidateCollisions(
  candidates: readonly SemanticCoordinateCandidate[],
): readonly SemanticCoordinateDiagnostic[] {
  const byLabel = new Map<string, SemanticCoordinateCandidate[]>();

  for (const candidate of candidates) {
    const existing = byLabel.get(candidate.label) ?? [];
    existing.push(candidate);
    byLabel.set(candidate.label, existing);
  }

  return [...byLabel.entries()]
    .filter(([, matches]) => matches.length > 1)
    .flatMap(([label, matches]) => {
      const signatures = new Set(matches.map(candidateCollisionSignature));
      if (signatures.size <= 1) return [];
      return [
        semanticCoordinateDiagnostic({
          code: "semantic-coordinate-collision-candidate",
          severity: "error",
          label,
          message: `Semantic coordinate candidate ${label} is produced by ${matches.length} distinct physical records.`,
          metadata: {
            candidates: matches.map((candidate) => ({
              id: candidate.id,
              kind: candidate.kind,
              physicalRefs: candidate.physicalRefs.map((ref) => ref.ref),
            })),
          },
        }),
      ];
    });
}

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
      addCandidateReference(candidatesByReference, ref.ref.split("#")[0], candidate);
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
  if (candidate.kind === "source-file" || candidate.kind === "evidence") {
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
  if (candidate.kind === "source-file" || candidate.kind === "evidence") {
    return [];
  }

  return normalizeRecordRefs(
    candidatesForDocument(document, index)
      .filter((item) =>
        item.kind === "source-file"
        && item.metadata.idSource === "document.source.path"
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
  if (candidate.kind === "source-file" || candidate.kind === "evidence") {
    return [];
  }

  return normalizeRecordRefs([
    ...candidatesForDocument(document, index)
      .filter((item) =>
        item.kind === "evidence"
        && item.metadata.idSource === "document.evidence.id"
      )
      .map((item) => item.label),
    ...(task ? task.evidenceIds.flatMap((id) => evidenceLabelsForId(index, id)) : []),
  ]);
}

function dependencyLabelsForLink(
  index: ProjectionIndex,
  link: DocumentLink,
): readonly string[] {
  return labelsForReference(index, link.targetId, {
    fallbackKind: "definition-doc",
    fallbackSubtype: "spec",
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
        kind: "prd-story",
        parentId: prdDocumentIdFromPath(task.rawSource?.path ?? document.path)
          ?? document.familyId
          ?? document.stableId,
        id: dependencyId,
      }).candidate?.label;
      return label ? [label] : [];
    }
    return labelsForReference(index, dependencyId, {
      fallbackKind: "definition-doc",
      fallbackSubtype: "spec",
    });
  });
}

function evidenceLabelsForId(
  index: ProjectionIndex,
  evidenceId: string,
): readonly string[] {
  return labelsForReference(index, evidenceId, {
    fallbackKind: "evidence",
    fallbackSubtype: "evidence",
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
  if (normalized.startsWith("urn:")) return [normalized];

  const existing = index.candidatesByReference.get(normalized)
    ?? index.candidatesByReference.get(normalized.replace(/\.(?:md|json)$/i, ""));
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
  const id = reference.replace(/\.(?:md|json)$/i, "");
  if (reference.endsWith(".json") && reference.startsWith("tasks/")) {
    return {
      kind: "ralph-prd-json",
      id,
      version: "v1",
    };
  }
  if (reference.endsWith(".md") && reference.startsWith("tasks/")) {
    return {
      kind: "prd-markdown",
      id,
      version: "v1",
    };
  }
  const sourcePath = pathLikeReference(reference);
  if (sourcePath) {
    return {
      kind: "source-file",
      id: sourcePath,
      subtype: sourceSubtype(sourcePath),
    };
  }
  return {
    kind: fallback.fallbackKind,
    id: reference,
    subtype: fallback.fallbackSubtype,
    version: "v1",
  };
}

function projectionRecordMetadata(
  document: DocumentEnvelope,
  completedRecord: CompletedRecordState | undefined,
): DocumentMetadata {
  const scope = documentInventoryScope(document);
  return {
    projection: "document-envelope",
    documentScope: scope,
    activeScope: scope === "active",
    archiveScope: scope === "archive",
    sessionScope: scope === "session",
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

function documentInventoryScope(document: DocumentEnvelope): "active" | "archive" | "session" {
  if (isTransientSessionDocument(document)) return "session";
  if (isCandidateArchiveDocument(document)) return "archive";
  return "active";
}

function buildCompletedRecordIndex(
  records: readonly CompletedRecordState[] | null | undefined,
): ReadonlyMap<string, CompletedRecordState> {
  const index = new Map<string, CompletedRecordState>();
  for (const record of records ?? []) {
    index.set(
      [
        record.source,
        record.documentId,
        normalizeCoordinatePart(record.path) ?? record.path,
      ].join("\u001f"),
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
  if (candidate.kind !== "prd-story") return undefined;
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
  const documentLike = candidates.filter((candidate) =>
    candidate.kind !== "source-file" && candidate.kind !== "evidence"
  );
  const pool = documentLike.length > 0 ? documentLike : candidates;
  const preferred = pool.find((candidate) => candidate.metadata.idSource === "def.id")
    ?? pool.find((candidate) => candidate.metadata.idSource === "artifactId")
    ?? pool.find((candidate) => candidate.metadata.idSource === "packId")
    ?? pool.find((candidate) => candidate.metadata.idSource === "sourcePath")
    ?? pool.find((candidate) => candidate.metadata.idSource === "stableId")
    ?? pool[0];
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

function candidateDocumentKey(candidate: SemanticCoordinateCandidate): string | undefined {
  const adapterId = asString(candidate.metadata.documentAdapterId);
  const stableId = asString(candidate.metadata.documentStableId);
  const path = asString(candidate.metadata.documentPath);
  if (!adapterId || !stableId || !path) return undefined;
  return [adapterId, stableId, normalizeCoordinatePart(path) ?? path].join("\u001f");
}

function documentKey(document: DocumentEnvelope): string {
  return [
    document.adapterId,
    document.stableId,
    normalizeCoordinatePart(document.path) ?? document.path,
  ].join("\u001f");
}

function compareDeterministicLabelRecords(
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

function addPrdStoryCandidate(
  add: (input: SemanticCoordinateCandidateInput) => void,
  document: DocumentEnvelope,
  task: DocumentTask,
): void {
  const sourcePath = task.rawSource?.path ?? document.rawSource.path ?? document.path;
  const parentId = prdDocumentIdFromPath(sourcePath)
    ?? document.familyId
    ?? document.stableId;
  add({
    kind: "prd-story",
    parentId,
    id: task.id,
    physicalRefs: [
      {
        kind: document.kind === "ralph-prd-json" ? "ralph-prd-json-path" : "prd-path",
        ref: withPointer(sourcePath, task.rawSource?.pointer),
        role: "primary",
      },
    ],
    metadata: candidateMetadata(document, "prd.storyId", {
      storyId: task.id,
      storyTitle: task.title,
    }),
  });
}

function addSourcePathCandidate(
  add: (input: SemanticCoordinateCandidateInput) => void,
  document: DocumentEnvelope,
  path: string,
  idSource: SemanticExistingIdSource,
  extra: DocumentMetadata = {},
): void {
  add({
    kind: "source-file",
    id: path,
    subtype: sourceSubtype(path),
    physicalRefs: [
      {
        kind: "source-path",
        ref: path,
        role: "primary",
      },
    ],
    metadata: candidateMetadata(document, idSource, extra),
  });
}

function addDocumentSourceCandidate(
  add: (input: SemanticCoordinateCandidateInput) => void,
  document: DocumentEnvelope,
  source: DocumentSource,
): void {
  const sourceLabelPath = source.label ? pathLikeReference(source.label) : undefined;
  const metadataValue = asString(source.metadata.value);
  const path = source.path
    ?? sourceLabelPath
    ?? (metadataValue ? pathLikeReference(metadataValue) : undefined);
  if (!path) return;
  add({
    kind: "source-file",
    id: path,
    subtype: sourceSubtype(path),
    physicalRefs: [
      {
        kind: "source-path",
        ref: path,
        role: "primary",
        metadata: {
          sourceId: source.id,
          ...(source.label ? { label: source.label } : {}),
        },
      },
    ],
    metadata: candidateMetadata(document, "document.source.path", {
      sourceId: source.id,
      sourceKind: source.metadata.sourceKind,
    }),
  });
}

function documentPhysicalRefs(
  document: DocumentEnvelope,
): readonly SemanticPhysicalRefInput[] {
  if (document.kind === "prd") {
    return [
      {
        kind: "prd-path",
        ref: document.path,
        role: "primary",
      },
    ];
  }
  if (document.kind === "ralph-prd-json") {
    return [
      {
        kind: "ralph-prd-json-path",
        ref: document.path,
        role: "primary",
      },
    ];
  }
  if (isDefinitionDocument(document)) {
    return [
      {
        kind: "definition-path",
        ref: document.path,
        role: "primary",
      },
    ];
  }

  return [
    {
      kind: "source-path",
      ref: document.path,
      role: "primary",
    },
  ];
}

function artifactPhysicalRefs(
  document: DocumentEnvelope,
): readonly SemanticPhysicalRefInput[] {
  const refs: SemanticPhysicalRefInput[] = [];
  const artifactRef = asString(document.metadata.artifactRef);
  const outputPath = asString(document.metadata.outputPath);
  const registryPath = asString(document.metadata.registryPath) ?? document.rawSource.path;

  if (artifactRef) {
    refs.push({
      kind: "artifact-ref",
      ref: artifactRef,
      role: outputPath ? "related" : "primary",
    });
  }
  if (outputPath) {
    refs.push({
      kind: "artifact-output-path",
      ref: outputPath,
      role: "primary",
    });
  }
  if (registryPath) {
    refs.push({
      kind: "source-path",
      ref: registryPath,
      role: "source",
    });
  }
  if (refs.length === 0) {
    refs.push({
      kind: "artifact-ref",
      ref: document.path,
      role: "primary",
    });
  }

  return refs;
}

function evidencePhysicalRefs(
  document: DocumentEnvelope,
  rawPath: string | undefined,
  pointer: string | undefined,
): readonly SemanticPhysicalRefInput[] {
  const refs: SemanticPhysicalRefInput[] = [
    {
      kind: "evidence-ref",
      ref: withPointer(rawPath ?? document.rawSource.path ?? document.path, pointer),
      role: "primary",
    },
  ];
  const outputPath = asString(document.metadata.outputPath);
  if (outputPath) {
    refs.push({
      kind: "artifact-output-path",
      ref: outputPath,
      role: "related",
    });
  }
  return refs;
}

function inactiveDocumentReason(
  document: DocumentEnvelope,
  options: SemanticCoordinateCandidateInventoryOptions,
  exactTargets: ReadonlySet<string>,
): "archive" | "session" | undefined {
  if (isExactTargetDocument(document, exactTargets)) return undefined;
  if (isCandidateArchiveDocument(document) && options.includeArchive !== true) {
    return "archive";
  }
  if (isTransientSessionDocument(document) && options.includeSession !== true) {
    return "session";
  }
  return undefined;
}

function isCandidateArchiveDocument(document: DocumentEnvelope): boolean {
  if (isArchivedPrdDocument(document)) return true;
  if (document.metadata.lifecycle === "archived") return true;
  // 경로 기반 휴리스틱은 PRD kind에만 적용 — 비-PRD 문서는 lifecycle 메타데이터로 명시
  if (document.kind === "prd" || document.kind === "ralph-prd-json") {
    return normalizeCoordinatePart(document.path)?.split("/").includes("archive") === true;
  }
  return false;
}

function isExactTargetDocument(
  document: DocumentEnvelope,
  exactTargets: ReadonlySet<string>,
): boolean {
  if (exactTargets.size === 0) return false;
  return documentIdentityValues(document).some((value) =>
    exactTargets.has(value) || exactTargets.has(normalizeCoordinatePart(value) ?? value)
  );
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return uniqueStrings([
    document.stableId,
    document.familyId,
    document.path,
    document.rawSource.path,
    asString(document.metadata.defId),
    asString(document.metadata.title),
    asString(document.metadata.name),
    asString(document.metadata.sourcePath),
    asString(document.metadata.packId),
    nestedMetadataString(document.metadata.artifactMetadata, "packId"),
    asString(document.metadata.artifactId),
    asString(document.metadata.artifactRef),
    asString(document.metadata.outputPath),
    asString(document.metadata.ownerDefinitionId),
    ...document.tasks.map((task) => task.id),
  ]);
}

function normalizeExactTargets(
  target: string | readonly string[] | null | undefined,
): ReadonlySet<string> {
  const values = Array.isArray(target) ? target : target ? [target] : [];
  return new Set(values.flatMap((value) => {
    const normalized = normalizeCoordinatePart(value);
    return normalized && normalized !== value ? [value, normalized] : [value];
  }));
}

function isDefinitionDocument(document: DocumentEnvelope): boolean {
  return document.adapterId === "definition-markdown"
    || document.rawSource.sourceSchema === "definition-frontmatter"
    || asString(document.metadata.defId) !== undefined;
}

function isArtifactLikeDocument(document: DocumentEnvelope): boolean {
  return document.adapterId === "artifact-evidence"
    || asString(document.metadata.artifactKind) !== undefined
    || document.evidence.length > 0;
}

function definitionSubtype(document: DocumentEnvelope): string {
  return asString(document.metadata.documentKind)
    ?? (isDefinitionRoleKind(document.kind) ? document.kind : "definition");
}

function artifactSubtype(document: DocumentEnvelope): string {
  return asString(document.metadata.artifactKind)
    ?? (document.kind && document.kind !== "artifact-evidence-source" ? document.kind : "artifact");
}

function documentVersion(document: DocumentEnvelope): string {
  return asString(document.metadata.version) ?? "v1";
}

function documentPackId(document: DocumentEnvelope): string | undefined {
  return asString(document.metadata.packId)
    ?? asString(document.metadata.ontologyId)
    ?? nestedMetadataString(document.metadata.artifactMetadata, "packId")
    ?? nestedMetadataString(document.metadata.artifactMetadata, "ontologyId");
}

function candidateMetadata(
  document: DocumentEnvelope,
  idSource: SemanticExistingIdSource,
  extra: DocumentMetadata = {},
): DocumentMetadata {
  return {
    idSource,
    documentAdapterId: document.adapterId,
    documentKind: document.kind,
    documentStableId: document.stableId,
    ...(document.familyId ? { documentFamilyId: document.familyId } : {}),
    documentPath: document.path,
    ...extra,
  };
}

function prdDocumentIdFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = normalizeCoordinatePart(path);
  if (!normalized) return undefined;
  // PRD 문서 확장자(.md/.json)만 허용 — 미인식 확장자는 undefined로 처리
  if (!/\.(?:md|json)$/i.test(normalized)) return undefined;
  return normalized.replace(/\.(?:md|json)$/i, "");
}

function sourceSubtype(path: string): string {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".tsx")) return "typescript-react";
  if (normalized.endsWith(".ts")) return "typescript";
  if (normalized.endsWith(".jsx")) return "javascript-react";
  if (normalized.endsWith(".js") || normalized.endsWith(".mjs") || normalized.endsWith(".cjs")) return "javascript";
  if (normalized.endsWith(".md") || normalized.endsWith(".mdx")) return "markdown";
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) return "yaml";
  if (normalized.endsWith(".css")) return "css";
  if (normalized.endsWith(".html")) return "html";
  return "file";
}

function pathLikeReference(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const direct = normalized.match(/^(.+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|mdx|mjs|cjs|py|rb|rs|ts|tsx|txt|yaml|yml))(?:[:#].*)?$/);
  if (direct?.[1]) return direct[1];
  if (normalized.includes("/") || normalized.includes("\\")) return normalized;
  return undefined;
}

function withPointer(path: string, pointer: string | undefined): string {
  if (!pointer) return path;
  return `${path}#${pointer}`;
}

function isDefinitionRoleKind(kind: string): boolean {
  return [
    "spec",
    "todo",
    "plan",
    "test",
    "cases",
    "memo",
    "rule",
    "definition",
    "knowledge",
  ].includes(kind);
}

function nestedMetadataString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return asString(value[key]);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function metadataStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.map((item) => asString(item)))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeRecordRefs(
  refs: readonly (string | undefined)[] | null | undefined,
): readonly string[] {
  return uniqueStrings((refs ?? []).map(normalizeCoordinatePart))
    .toSorted((left, right) => left.localeCompare(right));
}

function buildSemanticCoordinate(input: {
  readonly kind: SemanticCoordinateLabelKind;
  readonly id: string;
  readonly parentId?: string;
  readonly subtype: string;
  readonly version?: string;
}): SemanticCoordinate {
  const domain = DOMAIN_BY_KIND[input.kind];
  const parts = input.kind === "prd-story"
    ? compactParts([domain, input.subtype, input.parentId, input.id, input.version])
    : compactParts([domain, input.subtype, input.id, input.version]);

  return {
    scheme: "urn",
    domain,
    parts,
    value: `urn:${parts.join(":")}`,
  };
}

function normalizeKind(
  value: string | null | undefined,
  id: string,
  diagnostics: SemanticCoordinateDiagnostic[],
): SemanticCoordinateLabelKind | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    diagnostics.push(semanticCoordinateDiagnostic({
      code: "semantic-coordinate-missing-kind",
      severity: "error",
      id,
      message: `Semantic coordinate candidate ${id} is missing a label kind.`,
    }));
    return undefined;
  }

  if (!isSemanticCoordinateLabelKind(normalized)) {
    diagnostics.push(semanticCoordinateDiagnostic({
      code: "semantic-coordinate-invalid-kind",
      severity: "error",
      id,
      message: `Semantic coordinate candidate ${id} has unsupported label kind ${normalized}.`,
      metadata: {
        kind: normalized,
        supportedKinds: [...SEMANTIC_COORDINATE_LABEL_KINDS],
      },
    }));
    return undefined;
  }

  return normalized;
}

function normalizeVersion(
  value: string | null | undefined,
  id: string,
  diagnostics: SemanticCoordinateDiagnostic[],
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (versionPattern.test(normalized)) return normalized;

  diagnostics.push(semanticCoordinateDiagnostic({
    code: "semantic-coordinate-invalid-version",
    severity: "error",
    id,
    message: `Semantic coordinate candidate ${id} has invalid version ${normalized}; expected v1, v2, ...`,
    metadata: {
      version: normalized,
    },
  }));
  return undefined;
}

function normalizePhysicalRefs(
  refs: readonly SemanticPhysicalRefInput[] | null | undefined,
): readonly SemanticPhysicalRef[] {
  return (refs ?? [])
    .map((ref) => {
      const normalizedRef = normalizeCoordinatePart(ref.ref);
      if (!normalizedRef) return undefined;
      const role = ref.role ?? undefined;
      return {
        kind: ref.kind,
        ref: normalizedRef,
        ...(role ? { role } : {}),
        metadata: normalizeMetadata(ref.metadata),
      } satisfies SemanticPhysicalRef;
    })
    .filter((ref): ref is SemanticPhysicalRef => ref !== undefined);
}

function diagnoseAmbiguousPhysicalRefs(
  refs: readonly SemanticPhysicalRef[],
  id: string,
): readonly SemanticCoordinateDiagnostic[] {
  const primaryRefs = refs.filter((ref) => ref.role === "primary");
  const uniquePrimaryRefs = new Set(primaryRefs.map((ref) => `${ref.kind}:${ref.ref}`));
  if (uniquePrimaryRefs.size <= 1) return [];

  return [
    semanticCoordinateDiagnostic({
      code: "semantic-coordinate-ambiguous-physical-ref",
      severity: "warning",
      id,
      message: `Semantic coordinate candidate ${id} has multiple primary physical refs.`,
      metadata: {
        physicalRefs: primaryRefs.map((ref) => ({
          kind: ref.kind,
          ref: ref.ref,
        })),
      },
    }),
  ];
}

function candidateCollisionSignature(
  candidate: SemanticCoordinateCandidate,
): string {
  const physicalRefs = candidate.physicalRefs
    .map((ref) => `${ref.kind}:${ref.ref}`)
    .sort()
    .join("|");
  return [
    candidate.kind,
    candidate.id,
    candidate.parentId ?? "",
    physicalRefs,
  ].join("\u001f");
}

function semanticCoordinateDiagnostic(
  input: Omit<SemanticCoordinateDiagnostic, "metadata"> & {
    readonly metadata?: DocumentMetadata;
  },
): SemanticCoordinateDiagnostic {
  return {
    ...input,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeMetadata(
  metadata: DocumentMetadata | null | undefined,
): DocumentMetadata {
  return { ...(metadata ?? {}) };
}

function normalizeCoordinatePart(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim().replaceAll("\\", "/").replace(/\/+/g, "/");
  return normalized ? normalized : undefined;
}

function compactParts(parts: readonly (string | undefined)[]): readonly string[] {
  return parts.filter((part): part is string => part !== undefined && part.length > 0);
}
