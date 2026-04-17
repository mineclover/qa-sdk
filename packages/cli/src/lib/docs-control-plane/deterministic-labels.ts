import {
  isArchivedPrdDocument,
  isTransientSessionDocument,
} from "./family-scope.js";
import type {
  DocumentEnvelope,
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

export function buildSemanticCoordinateCandidatesFromDocument(
  document: DocumentEnvelope,
): SemanticCoordinateCandidateInventory {
  const candidates: SemanticCoordinateCandidate[] = [];
  const diagnostics: SemanticCoordinateDiagnostic[] = [];

  const add = (input: SemanticCoordinateCandidateInput): void => {
    const result = buildSemanticCoordinateCandidate(input);
    diagnostics.push(...result.diagnostics);
    if (result.candidate) candidates.push(result.candidate);
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
    metadata: candidateMetadata(document, idSource),
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
  return normalizeCoordinatePart(document.path)?.split("/").includes("archive") === true;
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
    ?? nestedMetadataString(document.metadata.artifactMetadata, "packId");
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
  return normalizeCoordinatePart(path)?.replace(/\.(?:md|json)$/i, "");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
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
