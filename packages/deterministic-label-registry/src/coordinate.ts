// @def.doc deterministic-label-coordinate-stability
import type { DocumentMetadata } from "doc-envelope";
import { normalizeCoordinatePart, normalizeMetadata } from "./shared.js";

/**
 * 좌표 system — URN 생성, kind/domain 분류, diagnostic 코드.
 * 문서(DocumentEnvelope) 지식 없음 — 순수 좌표 모델.
 */

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
  "document-validation-signal",
  "deterministic-label-readiness-blocked",
  "deterministic-label-transition-blocked",
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

export function semanticCoordinateDiagnostic(
  input: Omit<SemanticCoordinateDiagnostic, "metadata"> & {
    readonly metadata?: DocumentMetadata;
  },
): SemanticCoordinateDiagnostic {
  return {
    ...input,
    metadata: normalizeMetadata(input.metadata),
  };
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
      return Object.assign({kind:ref.kind,ref:normalizedRef}, role?{role}:{}, {metadata:normalizeMetadata(ref.metadata)}) satisfies SemanticPhysicalRef;
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

function compactParts(parts: readonly (string | undefined)[]): readonly string[] {
  return parts.filter((part): part is string => part !== undefined && part.length > 0);
}
