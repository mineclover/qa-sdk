// @def.doc deterministic-label-projection-determinism
import {
  isArchivedPrdDocument,
  isTransientDocument,
} from "doc-envelope";
import type {
  DocumentEnvelope,
  DocumentMetadata,
  DocumentSource,
  DocumentTask,
} from "doc-envelope";
import {
  buildSemanticCoordinateCandidate,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInput,
  type SemanticCoordinateDiagnostic,
  type SemanticPhysicalRefInput,
  type SemanticExistingIdSource,
} from "./coordinate.js";
import { detectSemanticCoordinateCandidateCollisions } from "./collision.js";
import {
  asString,
  metadataStringArray,
  normalizeCoordinatePart,
  uniqueStrings,
  nestedMetadataString,
} from "./shared.js";

/**
 * 문서 투영 system — DocumentEnvelope을 좌표 candidate로 번역.
 * DocumentEnvelope 지식(kind/adapterId/metadata 구조)을 여기서 소비한다.
 */

export interface SemanticCoordinateCandidateInventoryOptions {
  readonly includeArchive?: boolean;
  readonly includeTransient?: boolean;
  readonly exactTarget?: string | readonly string[] | null;
}

export interface SemanticCoordinateSkippedDocument {
  readonly stableId: string;
  readonly path: string;
  readonly reason: "archive" | "transient";
  readonly metadata: DocumentMetadata;
}

export interface SemanticCoordinateCandidateInventory {
  readonly candidates: readonly SemanticCoordinateCandidate[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly skippedDocuments: readonly SemanticCoordinateSkippedDocument[];
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

export function addPrdStoryCandidate(
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

export function addSourcePathCandidate(
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

export function addDocumentSourceCandidate(
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

export function documentPhysicalRefs(
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

export function artifactPhysicalRefs(
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

export function evidencePhysicalRefs(
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

export function inactiveDocumentReason(
  document: DocumentEnvelope,
  options: SemanticCoordinateCandidateInventoryOptions,
  exactTargets: ReadonlySet<string>,
): "archive" | "transient" | undefined {
  if (isExactTargetDocument(document, exactTargets)) return undefined;
  if (isCandidateArchiveDocument(document) && options.includeArchive !== true) {
    return "archive";
  }
  if (isTransientDocument(document) && options.includeTransient !== true) {
    return "transient";
  }
  return undefined;
}

export function isCandidateArchiveDocument(document: DocumentEnvelope): boolean {
  if (isArchivedPrdDocument(document)) return true;
  if (document.metadata.lifecycle === "archived") return true;
  // 경로 기반 휴리스틱은 PRD kind에만 적용 — 비-PRD 문서는 lifecycle 메타데이터로 명시
  if (document.kind === "prd" || document.kind === "ralph-prd-json") {
    return normalizeCoordinatePart(document.path)?.split("/").includes("archive") === true;
  }
  return false;
}

export function isExactTargetDocument(
  document: DocumentEnvelope,
  exactTargets: ReadonlySet<string>,
): boolean {
  if (exactTargets.size === 0) return false;
  return documentIdentityValues(document).some((value) =>
    exactTargets.has(value) || exactTargets.has(normalizeCoordinatePart(value) ?? value)
  );
}

export function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
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

export function normalizeExactTargets(
  target: string | readonly string[] | null | undefined,
): ReadonlySet<string> {
  const values = Array.isArray(target) ? target : target ? [target] : [];
  return new Set(values.flatMap((value) => {
    const normalized = normalizeCoordinatePart(value);
    return normalized && normalized !== value ? [value, normalized] : [value];
  }));
}

export function isDefinitionDocument(document: DocumentEnvelope): boolean {
  return document.adapterId === "definition-markdown"
    || document.rawSource.sourceSchema === "definition-frontmatter"
    || asString(document.metadata.defId) !== undefined;
}

export function isArtifactLikeDocument(document: DocumentEnvelope): boolean {
  return document.adapterId === "artifact-evidence"
    || asString(document.metadata.artifactKind) !== undefined
    || document.evidence.length > 0;
}

export function definitionSubtype(document: DocumentEnvelope): string {
  return asString(document.metadata.documentKind)
    ?? (isDefinitionRoleKind(document.kind) ? document.kind : "definition");
}

export function artifactSubtype(document: DocumentEnvelope): string {
  return asString(document.metadata.artifactKind)
    ?? (document.kind && document.kind !== "artifact-evidence-source" ? document.kind : "artifact");
}

export function documentVersion(document: DocumentEnvelope): string {
  return asString(document.metadata.version) ?? "v1";
}

export function documentPackId(document: DocumentEnvelope): string | undefined {
  return asString(document.metadata.packId)
    ?? asString(document.metadata.ontologyId)
    ?? nestedMetadataString(document.metadata.artifactMetadata, "packId")
    ?? nestedMetadataString(document.metadata.artifactMetadata, "ontologyId");
}

export function candidateMetadata(
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

export function prdDocumentIdFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = normalizeCoordinatePart(path);
  if (!normalized) return undefined;
  // PRD 문서 확장자(.md/.json)만 허용 — 미인식 확장자는 undefined로 처리
  if (!/\.(?:md|json)$/i.test(normalized)) return undefined;
  return normalized.replace(/\.(?:md|json)$/i, "");
}

export function sourceSubtype(path: string): string {
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

export function pathLikeReference(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const direct = normalized.match(/^(.+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|mdx|mjs|cjs|py|rb|rs|ts|tsx|txt|yaml|yml))(?:[:#].*)?$/);
  if (direct?.[1]) return direct[1];
  if (normalized.includes("/") || normalized.includes("\\")) return normalized;
  return undefined;
}

export function withPointer(path: string, pointer: string | undefined): string {
  if (!pointer) return path;
  return `${path}#${pointer}`;
}

export function isDefinitionRoleKind(kind: string): boolean {
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
