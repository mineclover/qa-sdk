import type {
  OperationalOntologyPack,
  OperationalOntologyPackValidationResult,
} from "./pack-core.js";
import { validateOperationalOntologyPack } from "./pack-core.js";
import {
  extractPromptArtifactSourcesFromDefinitionContext,
  type PromptArtifactContextProvider,
  type PromptArtifactContextRequest,
  type PromptArtifactDefinitionContextExtraction,
  type PromptArtifactDefinitionDoc,
  type PromptArtifactDefinitionLink,
} from "./prompt-artifact-core.js";

export const PROGRAMMING_ARTIFACT_KINDS = [
  "build",
  "generated-source",
  "quality-status",
  "deployment-output",
  "prompt-artifact",
  "activation-evidence",
] as const;

export type ProgrammingArtifactKind =
  (typeof PROGRAMMING_ARTIFACT_KINDS)[number];

export const PROGRAMMING_ARTIFACT_RELATION_KINDS = [
  "produced_by",
  "derived_from",
  "verifies",
  "owned_by_definition",
  "materializes_output",
] as const;

export type ProgrammingArtifactRelationKind =
  (typeof PROGRAMMING_ARTIFACT_RELATION_KINDS)[number];

export interface ProgrammingArtifactRelation {
  kind: ProgrammingArtifactRelationKind | string;
  fromRef: string;
  toRef: string;
  evidenceRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ProgrammingArtifactRegistryRecord {
  artifactId: string;
  artifactRef: string;
  kind: ProgrammingArtifactKind | string;
  producedByRef?: string;
  derivedFromRefs?: readonly string[];
  verifiesRefs?: readonly string[];
  ownerDefinitionId?: string;
  materializesOutputRefs?: readonly string[];
  sourceRefs?: readonly string[];
  outputPath?: string;
  contextDocs?: readonly PromptArtifactDefinitionDoc[];
  relations?: readonly ProgrammingArtifactRelation[];
  verificationRefs?: readonly string[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProgrammingArtifactRegistryRecordInput {
  artifactId?: string;
  artifactRef?: string;
  kind: ProgrammingArtifactKind | string;
  producedByRef?: string;
  derivedFromRefs?: readonly (string | undefined)[];
  verifiesRefs?: readonly (string | undefined)[];
  ownerDefinitionId?: string;
  materializesOutputRefs?: readonly (string | undefined)[];
  sourceRefs?: readonly (string | undefined)[];
  outputPath?: string;
  contextDocs?: readonly PromptArtifactDefinitionDoc[];
  relations?: readonly ProgrammingArtifactRelation[];
  verificationRefs?: readonly (string | undefined)[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProgrammingArtifactRegistryStore {
  getArtifactByRef(artifactRef: string): ProgrammingArtifactRegistryRecord | undefined;
  listArtifacts?(): readonly ProgrammingArtifactRegistryRecord[];
}

export interface ArtifactRegistryPromptArtifactContextProviderOptions {
  providerId?: string;
}

export type RelatedQualityStatusRegistryMatchField =
  | "outputPath"
  | "verifiesRefs"
  | "materializesOutputRefs"
  | "sourceRefs"
  | "relations";

export interface RelatedQualityStatusRegistryMatchReason {
  field: RelatedQualityStatusRegistryMatchField;
  ref: string;
  relationKind?: string;
}

export interface RelatedQualityStatusRegistryRecordSummary {
  artifactId: string;
  artifactRef: string;
  outputPath?: string;
  verifiesRefs: readonly string[];
  materializesOutputRefs: readonly string[];
  sourceRefs: readonly string[];
  relations: readonly Pick<ProgrammingArtifactRelation, "kind" | "fromRef" | "toRef" | "evidenceRef">[];
  matchRefs: readonly string[];
  matchReasons: readonly RelatedQualityStatusRegistryMatchReason[];
}

export interface RelatedQualityStatusRegistryRecordMatch {
  record: ProgrammingArtifactRegistryRecord;
  summary: RelatedQualityStatusRegistryRecordSummary;
}

const ARTIFACT_AXIS_ID = "programming_artifact_kind";
const ARTIFACT_RELATION_AXIS_ID = "programming_artifact_relation_kind";
const ARTIFACT_RELATION_CATEGORY = "programming_artifact_relation";

export const programmingArtifactOntologyPack = {
  packId: "programming-artifact-ontology",
  schema: {
    axes: [
      {
        id: ARTIFACT_AXIS_ID,
        values: [...PROGRAMMING_ARTIFACT_KINDS],
        stable: true,
        capacity: 16,
      },
      {
        id: ARTIFACT_RELATION_AXIS_ID,
        values: [...PROGRAMMING_ARTIFACT_RELATION_KINDS],
        stable: true,
        capacity: 16,
      },
    ],
    taxonomies: [
      {
        id: "programming-artifact",
        appliesTo: ["node"],
        axisIds: [ARTIFACT_AXIS_ID],
        identityAxisIds: [ARTIFACT_AXIS_ID],
        space: "programming-artifact",
      },
      {
        id: "programming-artifact-relation",
        appliesTo: ["edge"],
        axisIds: [ARTIFACT_RELATION_AXIS_ID],
        identityAxisIds: [ARTIFACT_RELATION_AXIS_ID],
        space: "programming-artifact",
      },
    ],
    relationCategories: [
      {
        category: ARTIFACT_RELATION_CATEGORY,
        requiredAxes: [ARTIFACT_RELATION_AXIS_ID],
        allowedStartKinds: ["artifact"],
        allowedEndKinds: [
          "artifact",
          "command",
          "definition",
          "governance-run",
          "quality-gate",
          "deployment",
        ],
      },
    ],
    traversals: [
      {
        purpose: "artifact_prompt_context",
        allowedRelationCategories: [ARTIFACT_RELATION_CATEGORY],
        canonicalizable: true,
      },
    ],
  },
  blueprints: [
    {
      blueprintId: "programming-artifact-registry-provider",
      coordinateRef: "corridor:programming-artifact-registry-provider",
      unitKind: "corridor_bundle",
      requiredSchemas: [
        "programming-artifact",
        "programming-artifact-relation",
        ARTIFACT_RELATION_CATEGORY,
        "artifact_prompt_context",
      ],
      implementationBinding: {
        coordinateRef: "corridor:programming-artifact-registry-provider",
        implementationRefs: [
          {
            kind: "code",
            ref: "packages/operational-ontology/src/internal/programming-artifact-core.ts",
          },
        ],
        relationCategories: [ARTIFACT_RELATION_CATEGORY],
      },
      verificationBinding: {
        coordinateRef: "corridor:programming-artifact-registry-provider",
        verificationRefs: [
          {
            kind: "test",
            ref: "packages/operational-ontology/src/programming-artifacts.test.ts",
          },
        ],
      },
      constraints: [
        { kind: "unit_boundary", severity: "core" },
        { kind: "allowed_relations", allowedRefs: [ARTIFACT_RELATION_CATEGORY] },
        { kind: "validation_surface", requiredRefs: ["test"] },
      ],
      evolutionPolicy: { kind: "append_only" },
    },
  ],
  metadata: {
    vocabulary: {
      artifactKinds: [...PROGRAMMING_ARTIFACT_KINDS],
      relationKinds: [...PROGRAMMING_ARTIFACT_RELATION_KINDS],
    },
  },
} satisfies OperationalOntologyPack;

export function validateProgrammingArtifactOntologyPack(): OperationalOntologyPackValidationResult {
  return validateOperationalOntologyPack(programmingArtifactOntologyPack);
}

export function createProgrammingArtifactRegistryRecord(
  input: CreateProgrammingArtifactRegistryRecordInput,
): ProgrammingArtifactRegistryRecord {
  const artifactRef = input.artifactRef ?? input.outputPath ?? input.artifactId;
  if (!artifactRef) {
    throw new Error("Programming artifact registry record requires artifactRef, outputPath, or artifactId");
  }

  const record: ProgrammingArtifactRegistryRecord = {
    artifactId: input.artifactId ?? `${input.kind}-${slugRef(artifactRef)}`,
    artifactRef,
    kind: input.kind,
    ...(input.producedByRef ? { producedByRef: input.producedByRef } : {}),
    ...optionalStringArray("derivedFromRefs", input.derivedFromRefs),
    ...optionalStringArray("verifiesRefs", input.verifiesRefs),
    ...(input.ownerDefinitionId ? { ownerDefinitionId: input.ownerDefinitionId } : {}),
    ...optionalStringArray("materializesOutputRefs", input.materializesOutputRefs),
    ...optionalStringArray("sourceRefs", input.sourceRefs),
    ...(input.outputPath ? { outputPath: input.outputPath } : {}),
    ...(input.contextDocs ? { contextDocs: input.contextDocs } : {}),
    ...optionalStringArray("verificationRefs", input.verificationRefs),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const relations = buildProgrammingArtifactRelations({
    ...record,
    relations: input.relations,
  });
  return relations.length > 0 ? { ...record, relations } : record;
}

export function buildProgrammingArtifactRelations(
  record: Pick<
    ProgrammingArtifactRegistryRecord,
    | "artifactRef"
    | "producedByRef"
    | "derivedFromRefs"
    | "verifiesRefs"
    | "ownerDefinitionId"
    | "materializesOutputRefs"
    | "relations"
  >,
): ProgrammingArtifactRelation[] {
  const fromRef = record.artifactRef;
  return uniqueRelations([
    ...asRelations("produced_by", fromRef, record.producedByRef ? [record.producedByRef] : []),
    ...asRelations("derived_from", fromRef, record.derivedFromRefs ?? []),
    ...asRelations("verifies", fromRef, record.verifiesRefs ?? []),
    ...asRelations(
      "owned_by_definition",
      fromRef,
      record.ownerDefinitionId ? [record.ownerDefinitionId] : [],
    ),
    ...asRelations("materializes_output", fromRef, record.materializesOutputRefs ?? []),
    ...(record.relations ?? []),
  ]);
}

export class InMemoryProgrammingArtifactRegistryStore
  implements ProgrammingArtifactRegistryStore
{
  private readonly recordsByRef = new Map<string, ProgrammingArtifactRegistryRecord>();

  constructor(records: readonly ProgrammingArtifactRegistryRecord[] = []) {
    for (const record of records) {
      const cloned = structuredClone(record);
      this.recordsByRef.set(cloned.artifactRef, cloned);
      this.recordsByRef.set(cloned.artifactId, cloned);
      if (cloned.outputPath) {
        this.recordsByRef.set(cloned.outputPath, cloned);
      }
    }
  }

  getArtifactByRef(artifactRef: string): ProgrammingArtifactRegistryRecord | undefined {
    const record = this.recordsByRef.get(artifactRef);
    return record ? structuredClone(record) : undefined;
  }

  listArtifacts(): readonly ProgrammingArtifactRegistryRecord[] {
    const uniqueRecords = new Map<string, ProgrammingArtifactRegistryRecord>();
    for (const record of this.recordsByRef.values()) {
      uniqueRecords.set(record.artifactId, record);
    }
    return [...uniqueRecords.values()].map((record) => structuredClone(record));
  }
}

export class ArtifactRegistryPromptArtifactContextProvider
  implements PromptArtifactContextProvider
{
  readonly providerId: string;
  readonly targetKinds = ["artifact"] as const;

  constructor(
    private readonly store: ProgrammingArtifactRegistryStore,
    options: ArtifactRegistryPromptArtifactContextProviderOptions = {},
  ) {
    this.providerId = options.providerId ?? "programming-artifact-registry";
  }

  canResolve(request: PromptArtifactContextRequest): boolean {
    return (
      request.targetKind === "artifact" &&
      Boolean(this.store.getArtifactByRef(request.targetRef))
    );
  }

  resolve(
    request: PromptArtifactContextRequest,
  ): PromptArtifactDefinitionContextExtraction | null {
    if (request.targetKind !== "artifact") return null;
    const record = this.store.getArtifactByRef(request.targetRef);
    if (!record) return null;
    return extractPromptArtifactSourcesFromProgrammingArtifactRecord(record, request);
  }

  findRelatedQualityStatusRecords(
    targetRefs: readonly string[],
  ): readonly RelatedQualityStatusRegistryRecordMatch[] {
    return findRelatedQualityStatusRegistryRecords({
      records: this.store.listArtifacts?.() ?? [],
      targetRefs,
    });
  }
}

export function extractPromptArtifactSourcesFromProgrammingArtifactRecord(
  record: ProgrammingArtifactRegistryRecord,
  request: Pick<PromptArtifactContextRequest, "useCase" | "now"> = {},
): PromptArtifactDefinitionContextExtraction {
  const relationDocs = relationTargetDocs(record);
  const children = [...relationDocs, ...(record.contextDocs ?? [])];
  const outgoingLinks = relationLinks(record);
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: artifactRootDoc(record),
    children,
    outgoingLinks,
    useCase: request.useCase,
    verificationRefs: unique([
      ...(record.verificationRefs ?? []),
      ...(record.verifiesRefs ?? []),
    ]),
    now: request.now ?? record.createdAt,
  });

  return {
    workArea: {
      ...extraction.workArea,
      workAreaId: `artifact:${record.artifactId}`,
      displayName: `Artifact context: ${record.artifactRef}`,
      rootRef: record.artifactRef,
      paths: unique([
        ...pathLikeRefs([record.artifactRef, record.outputPath]),
        ...pathLikeRefs(record.sourceRefs),
        ...(extraction.workArea.paths ?? []),
      ]),
      stack: unique([
        "Programming Artifact Ontology",
        ...(extraction.workArea.stack ?? []),
      ]),
      constraints: unique([
        `artifact-kind:${record.kind}`,
        ...relationConstraintLines(record),
        ...(extraction.workArea.constraints ?? []),
      ]),
      localInstructions: [
        "Treat artifact registry records as deliverable evidence before falling back to definition search.",
        "Resolve edits through owned_by_definition, derived_from, produced_by, verifies, and materializes_output relations.",
      ],
    },
    sources: extraction.sources,
  };
}

export function findRelatedQualityStatusRegistryRecords(input: {
  records: readonly ProgrammingArtifactRegistryRecord[];
  targetRefs: readonly (string | undefined)[];
}): RelatedQualityStatusRegistryRecordMatch[] {
  const targetRefs = unique(input.targetRefs.filter((ref): ref is string => Boolean(ref)));
  if (targetRefs.length === 0) return [];

  const targetSet = new Set(targetRefs);
  const matches: RelatedQualityStatusRegistryRecordMatch[] = [];
  for (const record of input.records) {
    if (record.kind !== "quality-status") continue;
    const matchReasons = qualityStatusMatchReasons(record, targetSet);
    if (matchReasons.length === 0) continue;
    matches.push({
      record: structuredClone(record),
      summary: summarizeRelatedQualityStatusRecord(record, matchReasons),
    });
  }
  return matches;
}

export function appendQualityStatusEvidenceToPromptArtifactExtraction(
  extraction: PromptArtifactDefinitionContextExtraction,
  qualityStatusRecords: readonly ProgrammingArtifactRegistryRecord[],
  request: Pick<PromptArtifactContextRequest, "useCase" | "now"> = {},
): PromptArtifactDefinitionContextExtraction {
  const records = qualityStatusRecords.filter(
    (record) => `artifact:${record.artifactId}` !== extraction.workArea.workAreaId,
  );
  if (records.length === 0) return extraction;

  const qualityExtractions = records.map((record) =>
    extractPromptArtifactSourcesFromProgrammingArtifactRecord(record, request),
  );
  return {
    workArea: {
      ...extraction.workArea,
      paths: unique([
        ...(extraction.workArea.paths ?? []),
        ...records.flatMap((record) => pathLikeRefs([record.outputPath, ...(record.sourceRefs ?? [])])),
        ...qualityExtractions.flatMap((item) => item.workArea.paths ?? []),
      ]),
      constraints: unique([
        ...(extraction.workArea.constraints ?? []),
        ...records.flatMap(qualityStatusConstraintLines),
        ...qualityExtractions.flatMap((item) => item.workArea.constraints ?? []),
      ]),
      localInstructions: unique([
        ...(extraction.workArea.localInstructions ?? []),
        "Treat related quality-status registry records as governance evidence for this artifact extraction.",
        ...qualityExtractions.flatMap((item) => item.workArea.localInstructions ?? []),
      ]),
    },
    sources: mergePromptArtifactSourceSets([
      extraction.sources,
      ...qualityExtractions.map((item) => item.sources),
    ]),
  };
}

function artifactRootDoc(record: ProgrammingArtifactRegistryRecord): PromptArtifactDefinitionDoc {
  return {
    docId: `artifact:${record.artifactId}`,
    title: `Programming artifact: ${record.artifactRef}`,
    purpose: [
      `Manage ${record.kind} artifact ${record.artifactRef}.`,
      record.ownerDefinitionId
        ? `Owner definition: ${record.ownerDefinitionId}.`
        : undefined,
      record.producedByRef ? `Produced by: ${record.producedByRef}.` : undefined,
    ].filter(Boolean).join(" "),
    tags: [
      "programming-artifact",
      "artifact",
      `artifact-kind:${record.kind}`,
    ],
    sourcePath: record.outputPath ?? pathLikeRefs([record.artifactRef])[0],
    lifecycle: "draft",
    body: artifactBody(record),
  };
}

function artifactBody(record: ProgrammingArtifactRegistryRecord): string {
  const lines = [
    `artifactRef: \`${record.artifactRef}\``,
    `kind: \`${record.kind}\``,
    ...maybeLine("produced_by", record.producedByRef),
    ...maybeLines("derived_from", record.derivedFromRefs),
    ...maybeLines("verifies", record.verifiesRefs),
    ...maybeLine("owned_by_definition", record.ownerDefinitionId),
    ...maybeLines("materializes_output", record.materializesOutputRefs),
    ...maybeLines("sourceRefs", record.sourceRefs),
    ...maybeLine("outputPath", record.outputPath),
  ];
  return lines.join("\n");
}

function maybeLine(label: string, value: string | undefined): string[] {
  return value ? [`${label}: \`${value}\``] : [];
}

function maybeLines(label: string, values: readonly string[] | undefined): string[] {
  return (values ?? []).map((value) => `${label}: \`${value}\``);
}

function relationLinks(record: ProgrammingArtifactRegistryRecord): PromptArtifactDefinitionLink[] {
  const source = `artifact:${record.artifactId}`;
  return relationPairs(record).map((pair) => ({
    source,
    target: relationDocId(pair.kind, pair.toRef),
    type: pair.kind,
  }));
}

function relationTargetDocs(
  record: ProgrammingArtifactRegistryRecord,
): PromptArtifactDefinitionDoc[] {
  return relationPairs(record).map((pair) => ({
    docId: relationDocId(pair.kind, pair.toRef),
    title: `${pair.kind}: ${pair.toRef}`,
    purpose: `Artifact relation ${pair.kind} connects ${record.artifactRef} to ${pair.toRef}.`,
    tags: [
      "programming-artifact-relation",
      `artifact-relation:${pair.kind}`,
    ],
    sourcePath: pathLikeRefs([pair.toRef])[0],
    lifecycle: "draft",
    body: pair.evidenceRef
      ? `relation: \`${pair.kind}\`\ntarget: \`${pair.toRef}\`\nevidence: \`${pair.evidenceRef}\``
      : `relation: \`${pair.kind}\`\ntarget: \`${pair.toRef}\``,
  }));
}

function relationPairs(record: ProgrammingArtifactRegistryRecord): ProgrammingArtifactRelation[] {
  return buildProgrammingArtifactRelations(record);
}

function asRelations(
  kind: ProgrammingArtifactRelationKind,
  fromRef: string,
  targets: readonly string[],
): ProgrammingArtifactRelation[] {
  return targets.map((toRef) => ({ kind, fromRef, toRef }));
}

function relationConstraintLines(record: ProgrammingArtifactRegistryRecord): string[] {
  return relationPairs(record).map((pair) => `${pair.kind}:${pair.toRef}`);
}

function qualityStatusConstraintLines(record: ProgrammingArtifactRegistryRecord): string[] {
  return unique([
    `quality-status:${record.artifactRef}`,
    ...(record.verifiesRefs ?? []).map((ref) => `quality-status-verifies:${ref}`),
    ...(record.materializesOutputRefs ?? []).map((ref) => `quality-status-materializes:${ref}`),
    ...qualityStatusRelationPairs(record).map((pair) => `quality-status-${pair.kind}:${pair.toRef}`),
  ]);
}

function qualityStatusMatchReasons(
  record: ProgrammingArtifactRegistryRecord,
  targetRefs: ReadonlySet<string>,
): RelatedQualityStatusRegistryMatchReason[] {
  return uniqueMatchReasons([
    ...matchSingleRef("outputPath", record.outputPath, targetRefs),
    ...matchArrayRefs("verifiesRefs", record.verifiesRefs, targetRefs),
    ...matchArrayRefs("materializesOutputRefs", record.materializesOutputRefs, targetRefs),
    ...matchArrayRefs("sourceRefs", record.sourceRefs, targetRefs),
    ...matchRelationRefs(record.relations, targetRefs),
  ]);
}

function summarizeRelatedQualityStatusRecord(
  record: ProgrammingArtifactRegistryRecord,
  matchReasons: readonly RelatedQualityStatusRegistryMatchReason[],
): RelatedQualityStatusRegistryRecordSummary {
  return {
    artifactId: record.artifactId,
    artifactRef: record.artifactRef,
    ...(record.outputPath ? { outputPath: record.outputPath } : {}),
    verifiesRefs: [...(record.verifiesRefs ?? [])],
    materializesOutputRefs: [...(record.materializesOutputRefs ?? [])],
    sourceRefs: [...(record.sourceRefs ?? [])],
    relations: qualityStatusRelationPairs(record).map((relation) => (Object.assign({kind:relation.kind,fromRef:relation.fromRef,toRef:relation.toRef}, relation.evidenceRef?{evidenceRef:relation.evidenceRef}:{}))),
    matchRefs: unique(matchReasons.map((reason) => reason.ref)),
    matchReasons: [...matchReasons],
  };
}

function qualityStatusRelationPairs(
  record: ProgrammingArtifactRegistryRecord,
): ProgrammingArtifactRelation[] {
  return relationPairs(record).filter(
    (relation) =>
      relation.kind === "verifies" || relation.kind === "materializes_output",
  );
}

function matchSingleRef(
  field: RelatedQualityStatusRegistryMatchField,
  ref: string | undefined,
  targetRefs: ReadonlySet<string>,
): RelatedQualityStatusRegistryMatchReason[] {
  return ref && targetRefs.has(ref) ? [{ field, ref }] : [];
}

function matchArrayRefs(
  field: RelatedQualityStatusRegistryMatchField,
  refs: readonly string[] | undefined,
  targetRefs: ReadonlySet<string>,
): RelatedQualityStatusRegistryMatchReason[] {
  return (refs ?? [])
    .filter((ref) => targetRefs.has(ref))
    .map((ref) => ({ field, ref }));
}

function matchRelationRefs(
  relations: readonly ProgrammingArtifactRelation[] | undefined,
  targetRefs: ReadonlySet<string>,
): RelatedQualityStatusRegistryMatchReason[] {
  return (relations ?? []).flatMap((relation) => {
    if (relation.kind !== "verifies" && relation.kind !== "materializes_output") {
      return [];
    }
    return [
      ...matchSingleRef("relations", relation.toRef, targetRefs),
      ...matchSingleRef("relations", relation.fromRef, targetRefs),
    ].map((reason) => ({ ...reason, relationKind: relation.kind }));
  });
}

function relationDocId(kind: string, ref: string): string {
  if (kind === "owned_by_definition" && /^[a-z0-9][a-z0-9-]*$/.test(ref)) {
    return ref;
  }
  return `artifact-relation:${kind}:${slugRef(ref)}`;
}

function slugRef(ref: string): string {
  const slug = ref
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function pathLikeRefs(values: readonly (string | undefined)[] | undefined): string[] {
  return (values ?? []).filter(
    (value): value is string =>
      Boolean(value) &&
      (value!.startsWith("packages/") ||
        value!.startsWith("docs/") ||
        value!.startsWith("artifacts/") ||
        value!.startsWith("dist/") ||
        value!.includes("/")),
  );
}

function optionalStringArray<Key extends string>(
  key: Key,
  values: readonly (string | undefined)[] | undefined,
): Partial<Record<Key, string[]>> {
  const filtered = unique(values?.filter((value): value is string => Boolean(value)) ?? []);
  return filtered.length > 0 ? { [key]: filtered } as Partial<Record<Key, string[]>> : {};
}

function uniqueRelations(
  relations: readonly ProgrammingArtifactRelation[],
): ProgrammingArtifactRelation[] {
  const byKey = new Map<string, ProgrammingArtifactRelation>();
  for (const relation of relations) {
    if (!relation.fromRef.trim() || !relation.toRef.trim()) continue;
    byKey.set(
      [
        relation.kind,
        relation.fromRef,
        relation.toRef,
        relation.evidenceRef ?? "",
      ].join("\0"),
      relation,
    );
  }
  return [...byKey.values()];
}

function uniqueMatchReasons(
  reasons: readonly RelatedQualityStatusRegistryMatchReason[],
): RelatedQualityStatusRegistryMatchReason[] {
  const byKey = new Map<string, RelatedQualityStatusRegistryMatchReason>();
  for (const reason of reasons) {
    byKey.set(
      [
        reason.field,
        reason.ref,
        reason.relationKind ?? "",
      ].join("\0"),
      reason,
    );
  }
  return [...byKey.values()];
}

function uniqueBy<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    byKey.set(keyOf(value), value);
  }
  return [...byKey.values()];
}

function mergePromptArtifactSourceSets(
  sourceSets: readonly PromptArtifactDefinitionContextExtraction["sources"][],
): PromptArtifactDefinitionContextExtraction["sources"] {
  return {
    corridors: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.corridors ?? []),
      (corridor) => corridor.flowId,
    ),
    checkpointLattices: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.checkpointLattices ?? []),
      (lattice) => lattice.corridorId,
    ),
    checkpoints: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.checkpoints ?? []),
      (checkpoint) => checkpoint.checkpointId,
    ),
    traversals: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.traversals ?? []),
      (observation) =>
        observation.traversal.canonicalKey ??
        `${observation.traversal.purpose}:${observation.traversal.start}->${observation.traversal.end}`,
    ),
    blueprints: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.blueprints ?? []),
      (blueprint) => blueprint.blueprintId,
    ),
    governanceRuns: uniqueBy(
      sourceSets.flatMap((sourceSet) => sourceSet.governanceRuns ?? []),
      (run) => run.runId,
    ),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
