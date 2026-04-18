import type {
  DocumentAdapter,
  DocumentAdapterCapabilities,
  DocumentAdapterCapabilityDeclaration,
  DocumentDiagnostic,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentEnvelopeInput,
  DocumentEvidence,
  DocumentEvidenceInput,
  DocumentLink,
  DocumentLinkInput,
  DocumentMetadata,
  DocumentRawSourcePointer,
  DocumentSection,
  DocumentSectionInput,
  DocumentSource,
  DocumentSourceInput,
  DocumentTask,
  DocumentTaskInput,
  RawSourcePointerInput,
} from "./types.js";

/**
 * Repository 파일이 SSOT다. Normalization은 indexing/coordination을 위해 envelope를
 * 안정화할 뿐이며, source document schema를 rewrite/migrate/reinterpret하지 않는다.
 */
export function normalizeDocumentEnvelope(
  input: DocumentEnvelopeInput,
): DocumentEnvelope {
  const familyId = optionalNonEmptyString(input.familyId);

  return {
    adapterId: requiredNonEmptyString(input.adapterId, "adapterId"),
    kind: requiredNonEmptyString(input.kind, "kind"),
    stableId: requiredNonEmptyString(input.stableId, "stableId"),
    ...(familyId ? { familyId } : {}),
    path: normalizePath(input.path, "path"),
    metadata: normalizeMetadata(input.metadata),
    links: (input.links ?? []).map(normalizeLink),
    sources: (input.sources ?? []).map(normalizeSource),
    sections: (input.sections ?? []).map(normalizeSection),
    tasks: (input.tasks ?? []).map(normalizeTask),
    evidence: (input.evidence ?? []).map(normalizeEvidence),
    diagnostics: (input.diagnostics ?? []).map(normalizeDiagnostic),
    rawSource: normalizeRawSourcePointer(input.rawSource, "rawSource"),
  };
}

export function declareDocumentAdapterCapabilities(
  declaration: DocumentAdapterCapabilityDeclaration = {},
): DocumentAdapterCapabilities {
  return {
    write: declaration.write === true,
    transform: declaration.transform === true,
  };
}

export function defineDocumentAdapter(
  adapter: Omit<DocumentAdapter, "capabilities" | "id"> & {
    readonly id: string;
    readonly capabilities?: DocumentAdapterCapabilityDeclaration;
  },
): DocumentAdapter {
  return {
    ...adapter,
    id: requiredNonEmptyString(adapter.id, "adapter.id"),
    capabilities: declareDocumentAdapterCapabilities(adapter.capabilities),
  };
}

function normalizeLink(input: DocumentLinkInput): DocumentLink {
  const sourceId = optionalNonEmptyString(input.sourceId);
  const targetAdapterId = optionalNonEmptyString(input.targetAdapterId);

  return {
    type: requiredNonEmptyString(input.type, "links[].type"),
    targetId: requiredNonEmptyString(input.targetId, "links[].targetId"),
    ...(sourceId ? { sourceId } : {}),
    ...(targetAdapterId ? { targetAdapterId } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeSource(input: DocumentSourceInput): DocumentSource {
  const path = input.path ? normalizePath(input.path, "sources[].path") : undefined;
  const label = optionalNonEmptyString(input.label);
  const rawSource = normalizeOptionalRawSourcePointer(
    input.rawSource,
    "sources[].rawSource",
  );

  return {
    id: requiredNonEmptyString(input.id, "sources[].id"),
    ...(path ? { path } : {}),
    ...(label ? { label } : {}),
    ...(rawSource ? { rawSource } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeSection(input: DocumentSectionInput): DocumentSection {
  const title = optionalNonEmptyString(input.title);
  const anchor = optionalNonEmptyString(input.anchor);
  const rawSource = normalizeOptionalRawSourcePointer(
    input.rawSource,
    "sections[].rawSource",
  );

  return {
    id: requiredNonEmptyString(input.id, "sections[].id"),
    ...(title ? { title } : {}),
    ...(anchor ? { anchor } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
    ...(rawSource ? { rawSource } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeTask(input: DocumentTaskInput): DocumentTask {
  const status = optionalNonEmptyString(input.status);
  const rawSource = normalizeOptionalRawSourcePointer(
    input.rawSource,
    "tasks[].rawSource",
  );

  return {
    id: requiredNonEmptyString(input.id, "tasks[].id"),
    title: requiredNonEmptyString(input.title, "tasks[].title"),
    ...(status ? { status } : {}),
    evidenceIds: normalizeStringList(input.evidenceIds),
    ...(rawSource ? { rawSource } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeEvidence(input: DocumentEvidenceInput): DocumentEvidence {
  const kind = optionalNonEmptyString(input.kind);
  const summary = optionalNonEmptyString(input.summary);
  const rawSource = normalizeOptionalRawSourcePointer(
    input.rawSource,
    "evidence[].rawSource",
  );

  return {
    id: requiredNonEmptyString(input.id, "evidence[].id"),
    ...(kind ? { kind } : {}),
    ...(summary ? { summary } : {}),
    ...(rawSource ? { rawSource } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeDiagnostic(
  input: DocumentDiagnosticInput,
): DocumentDiagnostic {
  const rawSource = normalizeOptionalRawSourcePointer(
    input.rawSource,
    "diagnostics[].rawSource",
  );

  return {
    code: requiredNonEmptyString(input.code, "diagnostics[].code"),
    severity: requiredNonEmptyString(input.severity, "diagnostics[].severity"),
    message: requiredNonEmptyString(input.message, "diagnostics[].message"),
    ...(rawSource ? { rawSource } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeOptionalRawSourcePointer(
  input: RawSourcePointerInput | null | undefined,
  fieldName: string,
): DocumentRawSourcePointer | undefined {
  if (!input) return undefined;
  return normalizeRawSourcePointer(input, fieldName);
}

function normalizeRawSourcePointer(
  input: RawSourcePointerInput,
  fieldName: string,
): DocumentRawSourcePointer {
  const pointer = optionalNonEmptyString(input.pointer);
  const sourceSchema = optionalNonEmptyString(input.sourceSchema);

  return {
    path: normalizePath(input.path, `${fieldName}.path`),
    ...(pointer ? { pointer } : {}),
    ...(sourceSchema ? { sourceSchema } : {}),
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeMetadata(
  metadata: DocumentMetadata | null | undefined,
): DocumentMetadata {
  return { ...(metadata ?? {}) };
}

function normalizeStringList(values: readonly string[] | null | undefined): readonly string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizePath(value: string, fieldName: string): string {
  return requiredNonEmptyString(value, fieldName).replaceAll("\\", "/").replace(/\/+/g, "/");
}

function requiredNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Document control-plane ${fieldName} is required`);
  }
  return normalized;
}

function optionalNonEmptyString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export {
  normalizeRawSourcePointer,
};
