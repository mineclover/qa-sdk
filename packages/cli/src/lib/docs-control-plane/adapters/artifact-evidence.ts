// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type {
  ProgrammingArtifactRegistryRecord,
  ProgrammingArtifactRelation,
} from 'operational-ontology/programming-artifacts';

import { defineDocumentAdapter, normalizeDocumentEnvelope } from 'doc-envelope';
import { matchesDocumentQuery } from 'doc-envelope';
import type {
  DocumentAdapter,
  DocumentCollectionQuery,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentEvidenceInput,
  DocumentLinkInput,
  DocumentMetadata,
  DocumentSourceInput,
} from 'doc-envelope';

export const ARTIFACT_EVIDENCE_ADAPTER_ID = 'artifact-evidence';

export interface ArtifactEvidenceAdapterOptions {
  readonly rootDir: string;
  readonly registryPaths?: readonly string[];
  /**
   * Normal docs status flows may include this adapter before a local registry is
   * created. Missing files stay silent unless the caller explicitly asks for
   * evidence-source diagnostics.
   */
  readonly warnOnMissing?: boolean;
}

export interface ArtifactEvidenceCollectionQuery extends DocumentCollectionQuery {
  readonly documentId?: string;
  readonly artifactRef?: string;
  readonly outputPath?: string;
  readonly packId?: string;
  readonly artifactKind?: string;
}

interface LoadedRegistryRecord {
  readonly registryPath: string;
  readonly sourcePath: string;
  readonly pointer: string;
  readonly record: ProgrammingArtifactRegistryRecord;
}

const DEFAULT_REGISTRY_PATHS = ['artifacts/programming-artifacts.json'];
const REGISTRY_SOURCE_SCHEMA = 'programming-artifact-registry';

export function createArtifactEvidenceAdapter(
  options: ArtifactEvidenceAdapterOptions,
): DocumentAdapter {
  const rootDir = options.rootDir;
  const registryPaths = options.registryPaths ?? DEFAULT_REGISTRY_PATHS;
  const warnOnMissing = options.warnOnMissing === true;

  return defineDocumentAdapter({
    id: ARTIFACT_EVIDENCE_ADAPTER_ID,
    async listDocuments(query?: DocumentCollectionQuery) {
      const envelopes = await collectArtifactEvidenceEnvelopes({
        rootDir,
        registryPaths,
        warnOnMissing,
      });
      return envelopes.filter((envelope) => matchesArtifactEvidenceQuery(envelope, query));
    },
    async getDocument(stableId: string) {
      const envelopes = await collectArtifactEvidenceEnvelopes({
        rootDir,
        registryPaths,
        warnOnMissing,
      });
      return (
        envelopes.find((envelope) => envelope.stableId === stableId) ??
        envelopes.find((envelope) => envelope.metadata.artifactRef === stableId) ??
        envelopes.find((envelope) => envelope.metadata.outputPath === stableId) ??
        null
      );
    },
  });
}

async function collectArtifactEvidenceEnvelopes(input: {
  readonly rootDir: string;
  readonly registryPaths: readonly string[];
  readonly warnOnMissing: boolean;
}): Promise<readonly DocumentEnvelope[]> {
  const envelopes: DocumentEnvelope[] = [];

  for (const registryPathInput of input.registryPaths) {
    const registryPath = resolvePath(input.rootDir, registryPathInput);
    const sourcePath = toRepoPath(input.rootDir, registryPath);
    const records = await readRegistryRecords(registryPath, sourcePath);

    if (records.status === 'missing') {
      if (input.warnOnMissing) {
        envelopes.push(missingRegistryEnvelope(sourcePath));
      }
      continue;
    }

    if (records.status === 'invalid') {
      envelopes.push(invalidRegistryEnvelope(sourcePath, records.message));
      continue;
    }

    for (const record of records.records) {
      const pointer =
        records.pointerPrefix === 'array' ? `/${record.index}` : `/artifacts/${record.index}`;
      if (!isProgrammingArtifactRegistryRecord(record.value)) {
        envelopes.push(
          invalidRegistryEnvelope(
            sourcePath,
            `Artifact evidence record at ${pointer} requires artifactId, artifactRef, and kind.`,
          ),
        );
        continue;
      }

      envelopes.push(
        artifactRecordEnvelope(input.rootDir, {
          registryPath,
          sourcePath,
          pointer,
          record: record.value,
        }),
      );
    }
  }

  return envelopes;
}

async function readRegistryRecords(
  registryPath: string,
  sourcePath: string,
): Promise<
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string }
  | {
      readonly status: 'ok';
      readonly pointerPrefix: 'array' | 'artifacts';
      readonly records: readonly {
        readonly index: number;
        readonly value: unknown;
      }[];
    }
> {
  try {
    const registryStat = await stat(registryPath);
    if (!registryStat.isFile()) {
      return {
        status: 'invalid',
        message: `Artifact evidence source is not a file: ${sourcePath}`,
      };
    }
  } catch {
    return { status: 'missing' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readFile(registryPath, 'utf8')) as unknown;
  } catch (error) {
    return {
      status: 'invalid',
      message: `Artifact evidence source is not valid JSON: ${errorMessage(error)}`,
    };
  }

  if (Array.isArray(payload)) {
    return {
      status: 'ok',
      pointerPrefix: 'array',
      records: payload.map((value, index) => ({ index, value })),
    };
  }

  if (isRecord(payload) && Array.isArray(payload.artifacts)) {
    return {
      status: 'ok',
      pointerPrefix: 'artifacts',
      records: payload.artifacts.map((value, index) => ({ index, value })),
    };
  }

  return {
    status: 'invalid',
    message: 'Artifact evidence source must be an array or object with artifacts[].',
  };
}

function artifactRecordEnvelope(rootDir: string, loaded: LoadedRegistryRecord): DocumentEnvelope {
  const { record } = loaded;
  const artifactPath = toRepoPath(
    rootDir,
    record.outputPath ?? record.artifactRef ?? record.artifactId,
  );
  const metadata = artifactRecordMetadata(loaded);

  return normalizeDocumentEnvelope({
    adapterId: ARTIFACT_EVIDENCE_ADAPTER_ID,
    kind: record.kind,
    stableId: record.artifactId,
    ...(record.ownerDefinitionId ? { familyId: record.ownerDefinitionId } : {}),
    path: artifactPath,
    metadata,
    links: artifactRelationLinks(record),
    sources: artifactSources(rootDir, loaded),
    evidence: [artifactEvidence(loaded, metadata)],
    rawSource: {
      path: loaded.sourcePath,
      pointer: loaded.pointer,
      sourceSchema: REGISTRY_SOURCE_SCHEMA,
      metadata: {
        artifactId: record.artifactId,
      },
    },
  });
}

function artifactRecordMetadata(loaded: LoadedRegistryRecord): DocumentMetadata {
  const { record } = loaded;
  const metadata = record.metadata ?? {};

  return {
    artifactId: record.artifactId,
    artifactKind: record.kind,
    artifactRef: record.artifactRef,
    ...(record.outputPath ? { outputPath: normalizePath(record.outputPath) } : {}),
    ...(record.producedByRef ? { producedByRef: record.producedByRef } : {}),
    derivedFromRefs: [...(record.derivedFromRefs ?? [])],
    verifiesRefs: [...(record.verifiesRefs ?? [])],
    ...(record.ownerDefinitionId ? { ownerDefinitionId: record.ownerDefinitionId } : {}),
    materializesOutputRefs: [...(record.materializesOutputRefs ?? [])],
    sourceRefs: [...(record.sourceRefs ?? [])],
    verificationRefs: [...(record.verificationRefs ?? [])],
    relations: artifactRelationMetadata(record.relations ?? []),
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    registryPath: loaded.sourcePath,
    artifactMetadata: { ...metadata },
    ...(typeof metadata.packId === 'string' ? { packId: metadata.packId } : {}),
    ...(typeof metadata.ontologyId === 'string' ? { ontologyId: metadata.ontologyId } : {}),
  };
}

function artifactEvidence(
  loaded: LoadedRegistryRecord,
  metadata: DocumentMetadata,
): DocumentEvidenceInput {
  const { record } = loaded;
  return {
    id: record.artifactId,
    kind: record.kind,
    summary: artifactEvidenceSummary(record),
    rawSource: {
      path: loaded.sourcePath,
      pointer: loaded.pointer,
      sourceSchema: REGISTRY_SOURCE_SCHEMA,
      metadata: {
        artifactId: record.artifactId,
      },
    },
    metadata,
  };
}

function artifactEvidenceSummary(record: ProgrammingArtifactRegistryRecord): string {
  const pieces = [
    record.kind,
    record.artifactRef,
    record.outputPath && record.outputPath !== record.artifactRef
      ? `output ${record.outputPath}`
      : undefined,
    record.ownerDefinitionId ? `owner ${record.ownerDefinitionId}` : undefined,
  ].filter((piece): piece is string => Boolean(piece));
  return pieces.join(' | ');
}

function artifactRelationLinks(
  record: ProgrammingArtifactRegistryRecord,
): readonly DocumentLinkInput[] {
  return (record.relations ?? []).map((relation, index) => ({
    type: relation.kind,
    sourceId: record.artifactId,
    targetId: relation.toRef,
    metadata: {
      index,
      fromRef: relation.fromRef,
      ...(relation.evidenceRef ? { evidenceRef: relation.evidenceRef } : {}),
      ...(relation.metadata ? { relationMetadata: { ...relation.metadata } } : {}),
    },
  }));
}

function artifactSources(
  rootDir: string,
  loaded: LoadedRegistryRecord,
): readonly DocumentSourceInput[] {
  const { record } = loaded;
  const refs: Array<{
    readonly id: string;
    readonly value: string | undefined;
    readonly sourceKind: string;
  }> = [
    { id: 'artifact-ref', value: record.artifactRef, sourceKind: 'artifact_ref' },
    { id: 'output-path', value: record.outputPath, sourceKind: 'output_path' },
    ...(record.sourceRefs ?? []).map((value, index) => ({
      id: `source-ref:${index + 1}`,
      value,
      sourceKind: 'source_ref',
    })),
    ...(record.verificationRefs ?? []).map((value, index) => ({
      id: `verification-ref:${index + 1}`,
      value,
      sourceKind: 'verification_ref',
    })),
  ];

  return refs
    .filter((ref) => ref.value && ref.value.trim().length > 0)
    .map((ref) =>
      Object.assign(
        { id: ref.id },
        pathLikeRef(ref.value!) ? { path: toRepoPath(rootDir, ref.value!) } : {},
        {
          label: ref.value,
          rawSource: {
            path: loaded.sourcePath,
            pointer: loaded.pointer,
            sourceSchema: REGISTRY_SOURCE_SCHEMA,
          },
          metadata: { value: ref.value, sourceKind: ref.sourceKind },
        },
      ),
    );
}

function artifactRelationMetadata(
  relations: readonly ProgrammingArtifactRelation[],
): readonly Record<string, unknown>[] {
  return relations.map((relation) => ({
    kind: relation.kind,
    fromRef: relation.fromRef,
    toRef: relation.toRef,
    ...(relation.evidenceRef ? { evidenceRef: relation.evidenceRef } : {}),
    ...(relation.metadata ? { metadata: { ...relation.metadata } } : {}),
  }));
}

function missingRegistryEnvelope(sourcePath: string): DocumentEnvelope {
  return registryDiagnosticEnvelope(sourcePath, {
    code: 'artifact-evidence-source-missing',
    severity: 'warning',
    message: `Artifact evidence source does not exist: ${sourcePath}`,
  });
}

function invalidRegistryEnvelope(sourcePath: string, message: string): DocumentEnvelope {
  return registryDiagnosticEnvelope(sourcePath, {
    code: 'artifact-evidence-source-invalid',
    severity: 'error',
    message,
  });
}

function registryDiagnosticEnvelope(
  sourcePath: string,
  diagnostic: DocumentDiagnosticInput,
): DocumentEnvelope {
  const stableId = `${ARTIFACT_EVIDENCE_ADAPTER_ID}:${diagnostic.code}:${sourcePath}`;
  return normalizeDocumentEnvelope({
    adapterId: ARTIFACT_EVIDENCE_ADAPTER_ID,
    kind: 'artifact-evidence-source',
    stableId,
    path: sourcePath,
    metadata: {
      sourcePath,
    },
    diagnostics: [
      {
        ...diagnostic,
        rawSource: {
          path: sourcePath,
          sourceSchema: REGISTRY_SOURCE_SCHEMA,
        },
      },
    ],
    rawSource: {
      path: sourcePath,
      sourceSchema: REGISTRY_SOURCE_SCHEMA,
    },
  });
}

function matchesArtifactEvidenceQuery(
  envelope: DocumentEnvelope,
  query: DocumentCollectionQuery | undefined,
): boolean {
  if (!matchesDocumentQuery(envelope, query)) return false;
  if (!query) return true;

  const artifactQuery = query as ArtifactEvidenceCollectionQuery;
  if (artifactQuery.artifactKind && envelope.kind !== artifactQuery.artifactKind) {
    return false;
  }
  if (
    artifactQuery.artifactRef &&
    normalizeOptionalPath(envelope.metadata.artifactRef) !==
      normalizePath(artifactQuery.artifactRef)
  ) {
    return false;
  }
  if (
    artifactQuery.outputPath &&
    normalizeOptionalPath(envelope.metadata.outputPath) !== normalizePath(artifactQuery.outputPath)
  ) {
    return false;
  }
  if (artifactQuery.packId && !artifactRecordRefs(envelope).includes(artifactQuery.packId)) {
    return false;
  }
  if (
    artifactQuery.documentId &&
    !artifactRecordRefs(envelope).includes(artifactQuery.documentId)
  ) {
    return false;
  }

  return true;
}

function artifactRecordRefs(envelope: DocumentEnvelope): readonly string[] {
  return unique([
    envelope.stableId,
    envelope.familyId,
    asString(envelope.metadata.artifactId),
    asString(envelope.metadata.artifactRef),
    asString(envelope.metadata.outputPath),
    asString(envelope.metadata.ownerDefinitionId),
    asString(envelope.metadata.packId),
    asString(envelope.metadata.ontologyId),
    ...asStringArray(envelope.metadata.derivedFromRefs),
    ...asStringArray(envelope.metadata.verifiesRefs),
    ...asStringArray(envelope.metadata.materializesOutputRefs),
    ...asStringArray(envelope.metadata.sourceRefs),
    ...asStringArray(envelope.metadata.verificationRefs),
    ...relationRefs(envelope.metadata.relations),
  ]);
}

function relationRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [asString(item.fromRef), asString(item.toRef), asString(item.evidenceRef)].filter(
      (ref): ref is string => Boolean(ref),
    );
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

function toRepoPath(rootDir: string, path: string): string {
  if (!pathLikeRef(path)) return path;
  const resolved = resolvePath(rootDir, path);
  const relativePath = relative(rootDir, resolved);
  return relativePath && !relativePath.startsWith('..')
    ? normalizePath(relativePath)
    : normalizePath(path);
}

function pathLikeRef(value: string): boolean {
  return (
    value.includes('/') ||
    value.includes('\\') ||
    value.endsWith('.json') ||
    value.endsWith('.js') ||
    value.endsWith('.ts') ||
    value.endsWith('.md')
  );
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/');
}

function normalizeOptionalPath(value: unknown): string | undefined {
  return typeof value === 'string' ? normalizePath(value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProgrammingArtifactRegistryRecord(
  value: unknown,
): value is ProgrammingArtifactRegistryRecord {
  return (
    isRecord(value) &&
    typeof value.artifactId === 'string' &&
    typeof value.artifactRef === 'string' &&
    typeof value.kind === 'string'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
