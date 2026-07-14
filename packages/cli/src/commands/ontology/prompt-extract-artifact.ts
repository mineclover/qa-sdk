// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { resolve } from 'node:path';

import type { DefDataSource, DefDoc } from 'definition-catalog';
import { createDataSource, type DataSourceOptions } from 'definition-data-source';
import {
  extractPromptArtifactSourcesFromDefinitionContext,
  generatePromptArtifact,
  generatePromptArtifacts,
  evaluatePromptArtifactQuality,
  type PromptArtifact,
  type PromptArtifactDefinitionDoc,
  type PromptArtifactKind,
  type PromptArtifactManagementAction,
  type PromptArtifactQualityStatusEvidence,
  type PromptArtifactUseCase,
} from 'operational-ontology/prompt-artifacts';
import {
  ArtifactRegistryPromptArtifactContextProvider,
  InMemoryProgrammingArtifactRegistryStore,
  appendQualityStatusEvidenceToPromptArtifactExtraction,
  type ProgrammingArtifactRegistryRecord,
  type RelatedQualityStatusRegistryRecordMatch,
} from 'operational-ontology/programming-artifacts';

import {
  collectContainedQualityDocsFromDataSource,
  toGateDescriptors,
} from '../../lib/quality-gate-topology.js';
import { loadProgrammingArtifactRegistryRecords } from './artifact-registry.js';
import {
  emptyQualityStatusSnapshotEvidence,
  findRelatedQualityStatusMatches,
  qualityStatusRecordKey,
  qualityStatusRecords,
  qualityStatusSnapshotWarningCodes,
  type LoadedQualityStatusRegistryProvider,
  type QualityStatusRecordSourceSummary,
  type QualityStatusSnapshotEvidence,
  type QualityStatusSnapshotWarning,
  type RelatedQualityStatusEvidence,
} from './quality-status-evidence.js';
import {
  appendQualityStatusSnapshotGovernanceEvidence,
  loadQualityStatusSnapshotEvidence,
  parseQualityStatusFreshnessPolicy,
  promptQualityStatusEvidenceFromArtifactExtraction,
  type QualityStatusFreshnessPolicy,
} from './quality-ledger-evidence.js';

export interface LoadedArtifactRegistryProvider extends LoadedQualityStatusRegistryProvider {
  provider: ArtifactRegistryPromptArtifactContextProvider;
  store: InMemoryProgrammingArtifactRegistryStore;
}

export type ArtifactExtractionSourceKind =
  | 'artifact-registry-hit'
  | 'artifact-registry-miss'
  | 'artifact-file-fallback'
  | 'artifact-definition-fallback'
  | 'artifact-search-fallback';

type GovernanceClosureQualityStatusStatus =
  | 'quality-status-found'
  | 'quality-status-missing'
  | 'quality-status-invalid'
  | 'quality-status-incomplete';

interface GovernanceClosureWarning {
  code:
    | 'prompt-quality-status-evidence-missing'
    | 'prompt-quality-status-evidence-target-missing'
    | 'prompt-quality-status-evidence-failed'
    | 'prompt-quality-status-evidence-stale'
    | 'prompt-quality-status-evidence-invalid'
    | 'prompt-quality-status-evidence-incomplete';
  message: string;
  sourceRefs: readonly string[];
}

interface GovernanceClosureSummary {
  status: GovernanceClosureQualityStatusStatus;
  source: 'quality-status';
  matchedQualityStatusArtifactRefs: readonly string[];
  matchedQualityStatusArtifactIds: readonly string[];
  warning?: GovernanceClosureWarning;
  recommendedManagementActions: readonly PromptArtifactManagementAction[];
}

export interface ArtifactExtractionSource {
  kind: ArtifactExtractionSourceKind;
  registry: {
    status: 'hit' | 'miss' | 'not-provided';
    path?: string;
    providerId?: string;
    recordCount?: number;
  };
  fallback?: {
    kind: 'file' | 'definition' | 'search';
    target: string;
    matchedDocs?: readonly string[];
  };
  warnings: readonly string[];
  recommendedManagementActions: readonly string[];
  qualityStatusRecords: {
    total: number;
    records: readonly QualityStatusRecordSourceSummary[];
    warnings: readonly QualityStatusSnapshotWarning[];
  };
  governanceClosure: GovernanceClosureSummary;
  qualitySignal: {
    code: ArtifactExtractionSourceKind;
    grade: 'ready' | 'usable' | 'degraded';
    warning?: string;
    recommendedManagementActions: readonly string[];
  };
}

type PromptArtifactExtraction = ReturnType<
  typeof extractPromptArtifactSourcesFromDefinitionContext
>;

export interface PromptArtifactMaterialization {
  artifactId: string;
  kind: PromptArtifactKind;
  outputPath: string;
}

export interface PromptExtractArtifactDependencies {
  parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> };
  parsePromptArtifactKind(value: string | undefined): PromptArtifactKind | 'all';
  parsePromptArtifactUseCase(value: string | undefined): PromptArtifactUseCase;
  toDefinitionDataSourceOptions(flags: Record<string, string>): DataSourceOptions;
  loadQualityStatusDescriptorSource(
    flags: Record<string, string>,
  ): Promise<Pick<DefDataSource, 'get' | 'getChildren'> | undefined>;
  defDocWithBody(source: DefDataSource, doc: DefDoc): Promise<PromptArtifactDefinitionDoc>;
  maybePersistGovernanceEvidence(
    flags: Record<string, string>,
    extraction: PromptArtifactExtraction,
  ): Promise<void>;
  materializePromptArtifacts(input: {
    flags: Record<string, string>;
    artifacts: readonly PromptArtifact[];
    producedByRef: string;
    ownerDefinitionId?: string;
    materializesOutputRefs?: readonly string[];
  }): Promise<PromptArtifactMaterialization[]>;
  cmdPromptExtract(rest: string[]): Promise<void>;
  cmdPromptExtractFile(rest: string[]): Promise<void>;
  printJson(data: unknown): void;
}

export async function loadArtifactRegistryProvider(
  flags: Record<string, string>,
): Promise<LoadedArtifactRegistryProvider | undefined> {
  const registryPath = flags['artifact-registry'] ?? flags['artifact-registry-file'];
  if (!registryPath) return undefined;

  const records = await loadProgrammingArtifactRegistryRecords(registryPath);
  const store = new InMemoryProgrammingArtifactRegistryStore(records);
  return {
    provider: new ArtifactRegistryPromptArtifactContextProvider(store),
    store,
    records,
    registryPath: resolve(registryPath),
    recordCount: records.length,
  };
}

export function inferArtifactType(artifactRef: string): string | undefined {
  if (artifactRef.endsWith('.json')) return 'json';
  if (artifactRef.endsWith('.ts')) return 'typescript';
  if (artifactRef.includes('quality')) return 'quality-status';
  if (artifactRef.includes('build')) return 'build';
  if (artifactRef.includes('schema')) return 'schema';
  return undefined;
}

export function parseArtifactExtractionSource(
  flags: Record<string, string>,
): ArtifactExtractionSource | undefined {
  const value = flags['artifact-source'];
  if (!value) return undefined;
  return JSON.parse(value) as ArtifactExtractionSource;
}

export function withArtifactSourceFlag(
  args: readonly string[],
  source: ArtifactExtractionSource,
): string[] {
  return [...args, '--artifact-source', JSON.stringify(source)];
}

export function withArtifactFallbackFlags(
  args: readonly string[],
  source: ArtifactExtractionSource,
  useCase: PromptArtifactUseCase,
  flags: Record<string, string>,
): string[] {
  const useCaseArgs = flags['use-case'] ? [...args] : [...args, '--use-case', useCase];
  return withArtifactSourceFlag(useCaseArgs, source);
}

export async function loadRelatedQualityStatusEvidenceFromFlags(
  flags: Record<string, string>,
  targetRefs: readonly (string | undefined)[],
  source?: Pick<DefDataSource, 'get' | 'getChildren'>,
): Promise<RelatedQualityStatusEvidence> {
  const loadedRegistry = await loadArtifactRegistryProvider(flags);
  if (!loadedRegistry) {
    return {
      matches: [],
      snapshotEvidence: emptyQualityStatusSnapshotEvidence(),
    };
  }
  const artifactSource = parseArtifactExtractionSource(flags);
  return loadRelatedQualityStatusEvidence(
    loadedRegistry,
    targetRefs,
    source,
    artifactSource ? flags['quality-ledger'] : undefined,
    artifactSource ? parseQualityStatusFreshnessPolicy(flags).policy : undefined,
  );
}

export async function loadRelatedQualityStatusEvidence(
  loadedRegistry: LoadedArtifactRegistryProvider | undefined,
  targetRefs: readonly (string | undefined)[],
  source?: Pick<DefDataSource, 'get' | 'getChildren'>,
  qualityLedgerPath?: string,
  freshnessPolicy?: QualityStatusFreshnessPolicy,
): Promise<RelatedQualityStatusEvidence> {
  const matches = findRelatedQualityStatusMatches(loadedRegistry, targetRefs);
  return {
    matches,
    snapshotEvidence: await loadQualityStatusSnapshotEvidence(
      loadedRegistry,
      matches,
      source,
      qualityLedgerPath,
      freshnessPolicy,
    ),
  };
}

export function workAreaQualityTargetRefs(
  workArea: PromptArtifactExtraction['workArea'],
): string[] {
  return uniqueArtifactValues(
    [workArea.workAreaId, workArea.rootRef, ...(workArea.paths ?? [])].filter(
      (value): value is string => Boolean(value),
    ),
  );
}

export function registryRecordQualityTargetRefs(
  record: ProgrammingArtifactRegistryRecord | undefined,
): string[] {
  if (!record) return [];
  return uniqueArtifactValues(
    [
      record.outputPath,
      ...(record.verifiesRefs ?? []),
      ...(record.materializesOutputRefs ?? []),
      ...(record.sourceRefs ?? []),
      ...(record.relations ?? []).flatMap((relation) => [relation.fromRef, relation.toRef]),
    ].filter((value): value is string => Boolean(value)),
  );
}

export async function expandQualityTopologyTargetRefs(
  source: DefDataSource,
  refs: readonly (string | undefined)[],
): Promise<string[]> {
  const initialRefs = uniqueArtifactValues(refs.filter((ref): ref is string => Boolean(ref)));
  const expanded = initialRefs.slice();
  const visited = new Set<string>();

  for (const ref of initialRefs) {
    const docId = definitionDocRefCandidate(ref);
    if (!docId || visited.has(docId)) continue;
    visited.add(docId);

    try {
      const root = await source.get(docId);
      if (!root) continue;
      const containedDocs = await collectContainedQualityDocsFromDataSource(source, root.docId);
      if (containedDocs.length === 0) continue;
      expanded.push(
        root.docId,
        ...containedDocs.map((doc) => doc.id),
        ...toGateDescriptors(root.docId, containedDocs).map((descriptor) => descriptor.gateDocId),
      );
    } catch {
      // Quality topology expansion is sidecar evidence discovery; extraction can continue without it.
    }
  }

  return uniqueArtifactValues(expanded);
}

export function withQualityStatusRecordsSummary(
  source: ArtifactExtractionSource | undefined,
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[] = [],
): ArtifactExtractionSource | undefined {
  if (!source) return undefined;
  const warningCodes = qualityStatusSnapshotWarningCodes(snapshotEvidence);
  return {
    ...source,
    warnings: uniqueArtifactValues([...source.warnings, ...warningCodes]),
    qualityStatusRecords: qualityStatusRecordsSummary(matches, snapshotEvidence),
    governanceClosure: governanceClosureSummary(
      matches,
      promptEvidence,
      artifactExtractionSourceTargetRefs(source),
    ),
  };
}

export function artifactRegistryHitSource(
  loadedRegistry: LoadedArtifactRegistryProvider,
  qualityStatusMatches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
  targetRefs: readonly string[] = [],
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[] = [],
): ArtifactExtractionSource {
  return {
    kind: 'artifact-registry-hit',
    registry: {
      status: 'hit',
      path: loadedRegistry.registryPath,
      providerId: loadedRegistry.provider.providerId,
      recordCount: loadedRegistry.recordCount,
    },
    warnings: qualityStatusSnapshotWarningCodes(snapshotEvidence),
    recommendedManagementActions: [],
    qualityStatusRecords: qualityStatusRecordsSummary(qualityStatusMatches, snapshotEvidence),
    governanceClosure: governanceClosureSummary(qualityStatusMatches, promptEvidence, targetRefs),
    qualitySignal: {
      code: 'artifact-registry-hit',
      grade: 'ready',
      recommendedManagementActions: [],
    },
  };
}

export function artifactFallbackSource(input: {
  kind: Exclude<ArtifactExtractionSourceKind, 'artifact-registry-hit' | 'artifact-registry-miss'>;
  fallbackKind: 'file' | 'definition' | 'search';
  target: string;
  loadedRegistry?: LoadedArtifactRegistryProvider;
  matchedDocs?: readonly string[];
  qualityStatusMatches?: readonly RelatedQualityStatusRegistryRecordMatch[];
  qualityStatusSnapshotEvidence?: QualityStatusSnapshotEvidence;
  qualityStatusPromptEvidence?: readonly PromptArtifactQualityStatusEvidence[];
}): ArtifactExtractionSource {
  const snapshotEvidence =
    input.qualityStatusSnapshotEvidence ?? emptyQualityStatusSnapshotEvidence();
  const registryStatus = input.loadedRegistry
    ? {
        status: 'miss' as const,
        path: input.loadedRegistry.registryPath,
        providerId: input.loadedRegistry.provider.providerId,
        recordCount: input.loadedRegistry.recordCount,
      }
    : { status: 'not-provided' as const };
  const warnings = [
    ...(input.loadedRegistry ? ['artifact-registry-miss'] : []),
    ...(input.kind === 'artifact-search-fallback' ? ['artifact-search-fallback'] : []),
    ...qualityStatusSnapshotWarningCodes(snapshotEvidence),
  ];
  const recommendedManagementActions =
    input.kind === 'artifact-search-fallback'
      ? ['create_programming_artifact_registry_record']
      : [];
  return {
    kind: input.kind,
    registry: registryStatus,
    fallback: {
      kind: input.fallbackKind,
      target: input.target,
      ...(input.matchedDocs ? { matchedDocs: input.matchedDocs } : {}),
    },
    warnings,
    recommendedManagementActions,
    qualityStatusRecords: qualityStatusRecordsSummary(
      input.qualityStatusMatches ?? [],
      snapshotEvidence,
    ),
    governanceClosure: governanceClosureSummary(
      input.qualityStatusMatches ?? [],
      input.qualityStatusPromptEvidence ?? [],
      [input.target],
    ),
    qualitySignal: {
      code: input.kind,
      grade: input.kind === 'artifact-search-fallback' ? 'degraded' : 'usable',
      warning:
        input.kind === 'artifact-search-fallback'
          ? 'Artifact context was synthesized from free-string search instead of a managed registry record.'
          : undefined,
      recommendedManagementActions,
    },
  };
}

export async function cmdPromptExtractArtifact(
  rest: string[],
  deps: PromptExtractArtifactDependencies,
): Promise<void> {
  const { positional, flags } = deps.parseFlags(rest);
  const artifactRef = positional[0];
  if (!artifactRef) {
    console.error(
      'Usage: qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--artifact-registry <file>] [--quality-ledger <path>] [--quality-status-max-age-days <n>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--output <file|dir>] [--json] [--local|--server|--scan] [--db <path>]',
    );
    return;
  }

  const freshnessPolicy = parseQualityStatusFreshnessPolicy(flags);
  if (freshnessPolicy.error) {
    console.error(freshnessPolicy.error);
    process.exitCode = 1;
    return;
  }

  const kind = deps.parsePromptArtifactKind(flags['kind']);
  const useCase = deps.parsePromptArtifactUseCase(flags['use-case'] ?? 'release_verification');
  const artifactType = flags['artifact-type'] ?? inferArtifactType(artifactRef);
  const loadedRegistry = await loadArtifactRegistryProvider(flags);
  const registryExtraction = loadedRegistry?.provider.resolve({
    targetKind: 'artifact',
    targetRef: artifactRef,
    useCase,
    now: new Date().toISOString(),
    metadata: artifactType ? { artifactType } : undefined,
  });
  if (loadedRegistry && registryExtraction) {
    const directRegistryRecord = loadedRegistry.store.getArtifactByRef(artifactRef);
    const qualityDescriptorSource = await deps.loadQualityStatusDescriptorSource(flags);
    const qualityStatusEvidence = await loadRelatedQualityStatusEvidence(
      loadedRegistry,
      [
        artifactRef,
        ...registryRecordQualityTargetRefs(directRegistryRecord),
        ...workAreaQualityTargetRefs(registryExtraction.workArea),
      ],
      qualityDescriptorSource,
      flags['quality-ledger'],
      freshnessPolicy.policy,
    );
    const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
      appendQualityStatusEvidenceToPromptArtifactExtraction(
        registryExtraction,
        qualityStatusRecords(qualityStatusEvidence.matches),
        {
          useCase,
          now: new Date().toISOString(),
        },
      ),
      qualityStatusEvidence.snapshotEvidence,
    );
    const promptQualityStatusEvidence =
      promptQualityStatusEvidenceFromArtifactExtraction(qualityStatusEvidence);
    await deps.maybePersistGovernanceEvidence(flags, extractionWithQuality);
    const artifacts =
      kind === 'all'
        ? generatePromptArtifacts({ ...extractionWithQuality, useCase })
        : [generatePromptArtifact({ ...extractionWithQuality, kind, useCase })];
    const evaluations = artifacts.map((artifact) => ({
      artifact,
      quality: evaluatePromptArtifactQuality({
        artifact,
        workArea: extractionWithQuality.workArea,
        sources: extractionWithQuality.sources,
        qualityStatusEvidence: promptQualityStatusEvidence,
      }),
    }));
    const outputs = await deps.materializePromptArtifacts({
      flags,
      artifacts,
      producedByRef: `qa-sdk ontology prompt extract-artifact ${artifactRef}`,
      materializesOutputRefs: [artifactRef],
    });

    if (flags['json'] === 'true') {
      deps.printJson({
        artifactRef,
        artifactType,
        providerId: loadedRegistry.provider.providerId,
        source: artifactRegistryHitSource(
          loadedRegistry,
          qualityStatusEvidence.matches,
          qualityStatusEvidence.snapshotEvidence,
          [artifactRef],
          promptQualityStatusEvidence,
        ),
        useCase,
        outputs,
        workArea: extractionWithQuality.workArea,
        artifacts: evaluations,
      });
      return;
    }

    console.log(`artifact: ${artifactRef}`);
    if (artifactType) console.log(`artifactType: ${artifactType}`);
    console.log(`provider: ${loadedRegistry.provider.providerId}`);
    printPromptArtifactOutputs(outputs, evaluations, flags);
    return;
  }

  if (artifactRef.startsWith('packages/') || artifactRef.startsWith('docs/')) {
    await deps.cmdPromptExtractFile(
      withArtifactFallbackFlags(
        rest,
        artifactFallbackSource({
          kind: 'artifact-file-fallback',
          fallbackKind: 'file',
          target: artifactRef,
          loadedRegistry,
        }),
        useCase,
        flags,
      ),
    );
    return;
  }

  const source = await createDataSource(deps.toDefinitionDataSourceOptions(flags));
  const directDoc = await source.get(artifactRef);
  if (directDoc) {
    await deps.cmdPromptExtract(
      withArtifactFallbackFlags(
        [artifactRef, ...rest.slice(1)],
        artifactFallbackSource({
          kind: 'artifact-definition-fallback',
          fallbackKind: 'definition',
          target: artifactRef,
          loadedRegistry,
        }),
        useCase,
        flags,
      ),
    );
    return;
  }

  const query = flags['q'] ?? artifactRef.split(/[/:#]/).filter(Boolean).at(-1) ?? artifactRef;
  const candidates = await source.list({ q: query, limit: 8 });
  const rootDoc = {
    docId: `artifact:${artifactRef}`,
    title: `Artifact context: ${artifactRef}`,
    purpose: `Manage context for artifact ${artifactRef}${artifactType ? ` (${artifactType})` : ''}.`,
    tags: ['artifact', ...(artifactType ? [`artifact-type:${artifactType}`] : [])],
    sourcePath: artifactRef.startsWith('artifacts/') ? artifactRef : undefined,
    lifecycle: 'draft',
  };
  const childDocs = await Promise.all(candidates.map((doc) => deps.defDocWithBody(source, doc)));
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: rootDoc,
    children: childDocs,
    useCase,
    verificationRefs: candidates
      .filter((doc) => doc.tags.some((tag) => tag.startsWith('quality-gate') || tag === 'testing'))
      .map((doc) => doc.docId),
    now: new Date().toISOString(),
  });
  const qualityStatusTargetRefs = await expandQualityTopologyTargetRefs(source, [
    artifactRef,
    query,
    ...candidates.map((doc) => doc.docId),
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidence(
    loadedRegistry,
    qualityStatusTargetRefs,
    source,
    flags['quality-ledger'],
    freshnessPolicy.policy,
  );
  const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
    appendQualityStatusEvidenceToPromptArtifactExtraction(
      extraction,
      qualityStatusRecords(qualityStatusEvidence.matches),
      {
        useCase,
        now: new Date().toISOString(),
      },
    ),
    qualityStatusEvidence.snapshotEvidence,
  );
  const promptQualityStatusEvidence =
    promptQualityStatusEvidenceFromArtifactExtraction(qualityStatusEvidence);
  const workArea = {
    ...extractionWithQuality.workArea,
    workAreaId: `artifact:${artifactRef}`,
    displayName: `Artifact context: ${artifactRef}`,
    constraints: uniqueArtifactValues([
      `artifact:${artifactRef}`,
      ...(artifactType ? [`artifact-type:${artifactType}`] : []),
      ...(extractionWithQuality.workArea.constraints ?? []),
    ]),
    localInstructions: [
      'Treat artifact refs as deliverable evidence, not as source code ownership by themselves.',
      'Resolve artifact context through matching definition docs, quality gates, and source maps before editing.',
      ...(extractionWithQuality.workArea.localInstructions ?? []),
    ],
  };
  await deps.maybePersistGovernanceEvidence(flags, extractionWithQuality);
  const artifacts =
    kind === 'all'
      ? generatePromptArtifacts({ workArea, sources: extractionWithQuality.sources, useCase })
      : [
          generatePromptArtifact({
            workArea,
            sources: extractionWithQuality.sources,
            kind,
            useCase,
          }),
        ];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: extractionWithQuality.sources,
      qualityStatusEvidence: promptQualityStatusEvidence,
    }),
  }));
  const fallbackSource = artifactFallbackSource({
    kind: 'artifact-search-fallback',
    fallbackKind: 'search',
    target: query,
    loadedRegistry,
    matchedDocs: candidates.map((doc) => doc.docId),
    qualityStatusMatches: qualityStatusEvidence.matches,
    qualityStatusSnapshotEvidence: qualityStatusEvidence.snapshotEvidence,
    qualityStatusPromptEvidence: promptQualityStatusEvidence,
  });
  const outputs = await deps.materializePromptArtifacts({
    flags,
    artifacts,
    producedByRef: `qa-sdk ontology prompt extract-artifact ${artifactRef}`,
    materializesOutputRefs: [artifactRef],
  });

  if (flags['json'] === 'true') {
    deps.printJson({
      artifactRef,
      artifactType,
      source: fallbackSource,
      matchedDocs: candidates.map((doc) => doc.docId),
      useCase,
      outputs,
      workArea,
      artifacts: evaluations,
    });
    return;
  }

  console.log(`artifact: ${artifactRef}`);
  if (artifactType) console.log(`artifactType: ${artifactType}`);
  if (candidates.length > 0) {
    console.log(`matchedDocs: ${candidates.map((doc) => doc.docId).join(', ')}`);
  }
  if (fallbackSource.qualitySignal.warning) {
    console.log(
      `warning: ${fallbackSource.qualitySignal.code} (${fallbackSource.qualitySignal.grade})`,
    );
    console.log(`action: ${fallbackSource.qualitySignal.recommendedManagementActions.join(', ')}`);
  }
  printPromptArtifactOutputs(outputs, evaluations, flags);
}

function qualityStatusRecordsSummary(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
): ArtifactExtractionSource['qualityStatusRecords'] {
  return {
    total: matches.length,
    records: matches.map(
      (match) =>
        snapshotEvidence.recordSummaries.get(qualityStatusRecordKey(match.record)) ?? match.summary,
    ),
    warnings: snapshotEvidence.warnings,
  };
}

function governanceClosureSummary(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[],
  targetRefs: readonly string[] = [],
): GovernanceClosureSummary {
  const matchedQualityStatusArtifactRefs = uniqueArtifactValues(
    matches.map((match) => match.record.artifactRef),
  );
  const matchedQualityStatusArtifactIds = uniqueArtifactValues(
    matches.map((match) => match.record.artifactId),
  );

  if (matches.length === 0) {
    return incompleteGovernanceClosure({
      status: 'quality-status-missing',
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: {
        code: 'prompt-quality-status-evidence-missing',
        message:
          'Artifact extraction did not include quality-status evidence, so governance closure confidence is capped.',
        sourceRefs: uniqueArtifactValues(targetRefs),
      },
    });
  }

  const targetEvidence = promptEvidence.filter((item) => item.verifiesTarget);
  if (targetEvidence.length === 0) {
    return incompleteGovernanceClosure({
      status: 'quality-status-incomplete',
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: {
        code: 'prompt-quality-status-evidence-target-missing',
        message:
          'Quality-status evidence did not verify the prompt target, so it cannot close governance.',
        sourceRefs: uniqueArtifactValues([
          ...targetRefs,
          ...promptEvidence.flatMap(qualityStatusPromptEvidenceSourceRefs),
        ]),
      },
    });
  }

  const invalidEvidence = targetEvidence.find(
    (item) => item.outcome === 'failed' || item.outcome === 'stale' || item.outcome === 'invalid',
  );
  if (invalidEvidence) {
    return incompleteGovernanceClosure({
      status: 'quality-status-invalid',
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: qualityStatusGovernanceWarning(invalidEvidence),
    });
  }

  const incompleteEvidence = targetEvidence.find(
    (item) => !hasVerifiedQualityStatusClosureEvidence(item),
  );
  if (incompleteEvidence) {
    return incompleteGovernanceClosure({
      status: 'quality-status-incomplete',
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: qualityStatusGovernanceWarning(incompleteEvidence),
    });
  }

  return {
    status: 'quality-status-found',
    source: 'quality-status',
    matchedQualityStatusArtifactRefs,
    matchedQualityStatusArtifactIds,
    recommendedManagementActions: [],
  };
}

function incompleteGovernanceClosure(input: {
  status: Exclude<GovernanceClosureQualityStatusStatus, 'quality-status-found'>;
  matchedQualityStatusArtifactRefs: readonly string[];
  matchedQualityStatusArtifactIds: readonly string[];
  warning: GovernanceClosureWarning;
}): GovernanceClosureSummary {
  return {
    status: input.status,
    source: 'quality-status',
    matchedQualityStatusArtifactRefs: input.matchedQualityStatusArtifactRefs,
    matchedQualityStatusArtifactIds: input.matchedQualityStatusArtifactIds,
    warning: input.warning,
    recommendedManagementActions: [
      {
        kind: 'close_governance_evidence',
        plane: 'governance',
        priority: 'required',
        reason: input.warning.message,
        targetRefs: input.warning.sourceRefs,
      },
    ],
  };
}

function hasVerifiedQualityStatusClosureEvidence(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  return (
    evidence.outcome === 'verified' && hasCompleteVerifiedQualityStatusSurfaceEvidence(evidence)
  );
}

function hasCompleteVerifiedQualityStatusSurfaceEvidence(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  const bundleRefs = evidence.bundleRefs ?? [];
  const verifiedBundleRefs = evidence.verifiedBundleRefs ?? [];
  const hasCompleteBundleSurface =
    verifiedBundleRefs.length > 0 && bundleRefs.every((ref) => verifiedBundleRefs.includes(ref));
  const gateRefs = evidence.gateRefs ?? [];
  const verifiedGateRefs = evidence.verifiedGateRefs ?? [];
  const hasCompleteGateRefSurface =
    verifiedGateRefs.length > 0 && gateRefs.every((ref) => verifiedGateRefs.includes(ref));
  const verifiedGateCount = evidence.verifiedGateCount ?? 0;
  const hasCompleteGateCountSurface =
    evidence.totalGateCount === undefined
      ? verifiedGateCount > 0
      : evidence.totalGateCount > 0 && verifiedGateCount >= evidence.totalGateCount;

  return hasCompleteBundleSurface || hasCompleteGateRefSurface || hasCompleteGateCountSurface;
}

function qualityStatusGovernanceWarning(
  evidence: PromptArtifactQualityStatusEvidence,
): GovernanceClosureWarning {
  const code: GovernanceClosureWarning['code'] =
    evidence.outcome === 'verified'
      ? 'prompt-quality-status-evidence-incomplete'
      : `prompt-quality-status-evidence-${evidence.outcome}`;
  return {
    code,
    message:
      evidence.message ??
      (evidence.outcome === 'verified'
        ? 'Quality-status evidence verified the target but did not report a complete verified bundle or gate surface.'
        : `Quality-status evidence reported ${evidence.outcome} verification for the target.`),
    sourceRefs: qualityStatusPromptEvidenceSourceRefs(evidence),
  };
}

function qualityStatusPromptEvidenceSourceRefs(
  evidence: PromptArtifactQualityStatusEvidence,
): string[] {
  return uniqueArtifactValues([
    evidence.evidenceId,
    ...evidence.targetRefs,
    ...(evidence.sourceRefs ?? []),
    ...(evidence.bundleRefs ?? []),
    ...(evidence.verifiedBundleRefs ?? []),
    ...(evidence.gateRefs ?? []),
    ...(evidence.verifiedGateRefs ?? []),
  ]);
}

function artifactExtractionSourceTargetRefs(source: ArtifactExtractionSource): string[] {
  return uniqueArtifactValues(
    [source.fallback?.target].filter((value): value is string => Boolean(value)),
  );
}

function definitionDocRefCandidate(ref: string): string | undefined {
  const strippedArtifact = ref.startsWith('artifact:') ? ref.slice('artifact:'.length) : ref;
  const strippedWorkArea = strippedArtifact.startsWith('work-area:')
    ? strippedArtifact.slice('work-area:'.length)
    : strippedArtifact;
  if (!strippedWorkArea || strippedWorkArea.includes('/') || strippedWorkArea.includes(':')) {
    return undefined;
  }
  return strippedWorkArea;
}

function printPromptArtifactOutputs(
  outputs: readonly PromptArtifactMaterialization[],
  evaluations: ReadonlyArray<{
    artifact: PromptArtifact;
    quality: ReturnType<typeof evaluatePromptArtifactQuality>;
  }>,
  flags: Record<string, string>,
): void {
  for (const output of outputs) {
    console.log(`output: ${output.outputPath}`);
  }
  for (const { artifact, quality } of evaluations) {
    console.log(`--- ${artifact.kind} ---`);
    console.log(`artifactId: ${artifact.artifactId}`);
    console.log(`useCase: ${artifact.useCase ?? '(none)'}`);
    console.log(`quality: ${quality.grade} (${quality.score})`);
    console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
    if (quality.recommendedManagementActions.length > 0) {
      console.log(
        `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(', ')}`,
      );
    }
    if (flags['quality-only'] !== 'true') {
      console.log(artifact.content);
    }
  }
}

function uniqueArtifactValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
