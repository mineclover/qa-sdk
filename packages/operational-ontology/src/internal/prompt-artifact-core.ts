import type {
  CheckpointLattice,
  CheckpointObservation,
} from "./checkpoint-core.js";
import type { FlowCorridor } from "./corridor-core.js";
import type {
  GovernanceRun,
  ImplementationBlueprint,
} from "./implementation-governance-types.js";
import { evaluateImplementationGovernance } from "./implementation-governance-evaluator.js";
import type { TraversalObservation } from "./runtime-core.js";

export const GPT5_PROMPT_GUIDE_SOURCE = {
  label: "OpenAI GPT-5 prompting guide",
  url: "https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide",
  publishedAt: "2025-08-07",
} as const;

export const PROMPT_ARTIFACT_KINDS = [
  "self_reflection",
  "code_editing_rules",
] as const;

export type PromptArtifactKind = (typeof PROMPT_ARTIFACT_KINDS)[number];

export const PROMPT_ARTIFACT_USE_CASES = [
  "test_exploration_and_edit",
  "feature_modification",
  "event_inventory",
  "incident_investigation",
  "schema_governance_review",
  "release_verification",
] as const;

export type PromptArtifactUseCase = (typeof PROMPT_ARTIFACT_USE_CASES)[number];

export interface PromptArtifactWorkArea {
  workAreaId: string;
  displayName?: string;
  rootRef?: string;
  purpose?: string;
  paths?: readonly string[];
  stack?: readonly string[];
  constraints?: readonly string[];
  localInstructions?: readonly string[];
}

export interface PromptArtifactSourceSet {
  corridors?: readonly FlowCorridor[];
  checkpointLattices?: readonly CheckpointLattice[];
  checkpoints?: readonly CheckpointObservation[];
  traversals?: readonly TraversalObservation[];
  blueprints?: readonly ImplementationBlueprint[];
  governanceRuns?: readonly GovernanceRun[];
}

export type PromptArtifactQualityStatusOutcome =
  | "verified"
  | "failed"
  | "stale"
  | "invalid"
  | "incomplete";

export interface PromptArtifactQualityStatusEvidence {
  evidenceId: string;
  outcome: PromptArtifactQualityStatusOutcome;
  verifiesTarget: boolean;
  targetRefs: readonly string[];
  sourceRefs?: readonly string[];
  bundleRefs?: readonly string[];
  verifiedBundleRefs?: readonly string[];
  gateRefs?: readonly string[];
  verifiedGateRefs?: readonly string[];
  verifiedGateCount?: number;
  totalGateCount?: number;
  generatedAt?: string;
  message?: string;
}

export interface PromptArtifactGenerationInput {
  artifactId?: string;
  kind: PromptArtifactKind;
  useCase?: PromptArtifactUseCase;
  workArea: PromptArtifactWorkArea;
  sources?: PromptArtifactSourceSet;
  extraInstructions?: readonly string[];
}

export interface PromptArtifactDefinitionDoc {
  docId: string;
  title?: string;
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle?: string;
  layer?: string;
  tags?: readonly string[];
  purpose?: string;
  sourcePath?: string;
  body?: string;
}

export interface PromptArtifactDefinitionLink {
  source: string;
  target: string;
  type: string;
}

export interface PromptArtifactDefinitionContextInput {
  root: PromptArtifactDefinitionDoc;
  children?: readonly PromptArtifactDefinitionDoc[];
  outgoingLinks?: readonly PromptArtifactDefinitionLink[];
  incomingLinks?: readonly PromptArtifactDefinitionLink[];
  useCase?: PromptArtifactUseCase;
  verificationRefs?: readonly string[];
  now?: string;
}

export interface PromptArtifactDefinitionContextExtraction {
  workArea: PromptArtifactWorkArea;
  sources: PromptArtifactSourceSet;
}

export type PromptArtifactContextTargetKind =
  | "definition"
  | "code"
  | "permission"
  | "artifact";

export interface PromptArtifactContextRequest {
  targetKind: PromptArtifactContextTargetKind;
  targetRef: string;
  useCase?: PromptArtifactUseCase;
  now?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptArtifactContextProvider {
  providerId: string;
  targetKinds: readonly PromptArtifactContextTargetKind[];
  canResolve(request: PromptArtifactContextRequest): boolean;
  resolve(
    request: PromptArtifactContextRequest,
  ): PromptArtifactDefinitionContextExtraction | null;
}

export interface PromptArtifactContextProviderRegistry {
  list(): readonly PromptArtifactContextProvider[];
  resolve(request: PromptArtifactContextRequest): PromptArtifactDefinitionContextExtraction | null;
}

export interface PromptArtifactSection {
  tag: string;
  lines: readonly string[];
}

export interface PromptArtifactValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path: string;
}

export interface PromptArtifactValidationResult {
  valid: boolean;
  issues: readonly PromptArtifactValidationIssue[];
}

export interface PromptArtifact {
  artifactId: string;
  kind: PromptArtifactKind;
  useCase?: PromptArtifactUseCase;
  workAreaId: string;
  sourceRefs: readonly string[];
  sections: readonly PromptArtifactSection[];
  content: string;
  guidanceSource: typeof GPT5_PROMPT_GUIDE_SOURCE;
  validation: PromptArtifactValidationResult;
}

export const PROMPT_ARTIFACT_QUALITY_DIMENSIONS = [
  "source_coverage",
  "boundary_clarity",
  "corridor_contract_coverage",
  "checkpoint_observability",
  "traversal_grounding",
  "governance_closure",
  "verification_surface",
  "content_consistency",
] as const;

export type PromptArtifactQualityDimension =
  (typeof PROMPT_ARTIFACT_QUALITY_DIMENSIONS)[number];

export type PromptArtifactQualityGrade =
  | "ready"
  | "usable"
  | "degraded"
  | "blocked";

export type PromptArtifactManagementPlane =
  | "generator"
  | "work_area"
  | "corridor"
  | "checkpoint"
  | "traversal"
  | "governance"
  | "verification";

export interface PromptArtifactQualityIssue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  dimension: PromptArtifactQualityDimension;
  managementPlane: PromptArtifactManagementPlane;
  sourceRefs: readonly string[];
}

export interface PromptArtifactQualityMetric {
  dimension: PromptArtifactQualityDimension;
  score: number;
  weight: number;
  applicable: boolean;
  issues: readonly PromptArtifactQualityIssue[];
}

export type PromptArtifactManagementActionKind =
  | "add_ontology_source_refs"
  | "define_work_area_boundary"
  | "enrich_corridor_contracts"
  | "add_checkpoint_observability"
  | "record_traversal_grounding"
  | "close_governance_evidence"
  | "bind_verification_surface"
  | "repair_prompt_artifact_content";

export interface PromptArtifactManagementAction {
  kind: PromptArtifactManagementActionKind;
  plane: PromptArtifactManagementPlane;
  priority: "required" | "recommended";
  reason: string;
  targetRefs: readonly string[];
}

export interface PromptArtifactQualityEvaluationInput {
  artifact: PromptArtifact;
  workArea?: PromptArtifactWorkArea;
  sources?: PromptArtifactSourceSet;
  qualityStatusEvidence?: readonly PromptArtifactQualityStatusEvidence[];
}

export interface PromptArtifactQualityEvaluation {
  score: number;
  grade: PromptArtifactQualityGrade;
  ontologyManagementRequired: boolean;
  validation: PromptArtifactValidationResult;
  metrics: readonly PromptArtifactQualityMetric[];
  issues: readonly PromptArtifactQualityIssue[];
  recommendedManagementActions: readonly PromptArtifactManagementAction[];
}

export interface PromptArtifactUseCaseProfile {
  useCase: PromptArtifactUseCase;
  label: string;
  contextCollection: readonly string[];
  codeEditingFocus: readonly string[];
  requiredSourceGroups: readonly (readonly string[])[];
  requiredQualityDimensions: readonly PromptArtifactQualityDimension[];
}

export const PROMPT_ARTIFACT_COMMON_SECTIONS = [
  "artifact_metadata",
  "source_evidence",
  "context_collection_contract",
  "quality_gate",
] as const;

export const PROMPT_ARTIFACT_REQUIRED_SECTIONS: Record<
  PromptArtifactKind,
  readonly string[]
> = {
  self_reflection: [
    "context_boundary",
    "context_gathering",
    "tool_reflection",
    "completion_check",
  ],
  code_editing_rules: [
    "work_area_boundary",
    "editing_principles",
    "ontology_binding",
    "verification",
  ],
};

export const PROMPT_ARTIFACT_USE_CASE_PROFILES: Record<
  PromptArtifactUseCase,
  PromptArtifactUseCaseProfile
> = {
  test_exploration_and_edit: {
    useCase: "test_exploration_and_edit",
    label: "Test exploration and edit",
    contextCollection: [
      "Collect test files, fixtures, scenario docs, and verification bindings before editing behavior.",
      "Use traversal evidence to distinguish source-under-test from test-only support code.",
    ],
    codeEditingFocus: [
      "Keep production edits separate from test harness edits unless governance evidence binds both.",
      "Preserve fixture meaning and update assertions only after source behavior is understood.",
    ],
    requiredSourceGroups: [
      ["traversal"],
      ["governance-blueprint"],
      ["governance-run"],
    ],
    requiredQualityDimensions: [
      "source_coverage",
      "boundary_clarity",
      "traversal_grounding",
      "governance_closure",
      "verification_surface",
      "content_consistency",
    ],
  },
  feature_modification: {
    useCase: "feature_modification",
    label: "Feature modification",
    contextCollection: [
      "Collect implementation entrypoints, corridor contracts, dependent definitions, and verification surfaces.",
      "Use traversal evidence to identify blast radius before editing shared modules.",
    ],
    codeEditingFocus: [
      "Preserve existing facade boundaries and update definition docs when the feature boundary changes.",
      "Treat failing governance verdicts as design work before broad implementation changes.",
    ],
    requiredSourceGroups: [
      ["corridor"],
      ["checkpoint-lattice", "checkpoint"],
      ["traversal"],
      ["governance-blueprint"],
      ["governance-run"],
    ],
    requiredQualityDimensions: PROMPT_ARTIFACT_QUALITY_DIMENSIONS,
  },
  event_inventory: {
    useCase: "event_inventory",
    label: "Event inventory",
    contextCollection: [
      "Collect event keys, payload fields, address_context bindings, and checkpoint observations.",
      "Separate observed event facts from inferred governance or implementation intent.",
    ],
    codeEditingFocus: [
      "Do not edit feature behavior while inventorying events unless checkpoint evidence exposes a broken emitter.",
      "Prefer checkpoint and corridor evidence over broad traversal context.",
    ],
    requiredSourceGroups: [["corridor"], ["checkpoint-lattice", "checkpoint"]],
    requiredQualityDimensions: [
      "source_coverage",
      "boundary_clarity",
      "corridor_contract_coverage",
      "checkpoint_observability",
      "content_consistency",
    ],
  },
  incident_investigation: {
    useCase: "incident_investigation",
    label: "Incident investigation",
    contextCollection: [
      "Collect checkpoint observations, route decisions, failed verdicts, and recent traversal terminals.",
      "Start from observed failures before proposing implementation changes.",
    ],
    codeEditingFocus: [
      "Patch the narrow failing corridor first and preserve incident evidence for follow-up governance.",
      "Escalate if recovery requires changing core coordinates or relation grammar.",
    ],
    requiredSourceGroups: [
      ["corridor"],
      ["checkpoint-lattice", "checkpoint"],
      ["traversal"],
      ["governance-run"],
    ],
    requiredQualityDimensions: [
      "source_coverage",
      "boundary_clarity",
      "corridor_contract_coverage",
      "checkpoint_observability",
      "traversal_grounding",
      "governance_closure",
      "content_consistency",
    ],
  },
  schema_governance_review: {
    useCase: "schema_governance_review",
    label: "Schema governance review",
    contextCollection: [
      "Collect schema ids, blueprint coordinates, constraint verdicts, and adjustment records.",
      "Use traversal evidence to identify which definitions are constrained by the schema change.",
    ],
    codeEditingFocus: [
      "Do not relax required facets or relation grammar without an explicit governance adjustment.",
      "Keep schema validation and implementation binding changes in the same review surface.",
    ],
    requiredSourceGroups: [
      ["traversal"],
      ["governance-blueprint"],
      ["governance-run"],
    ],
    requiredQualityDimensions: [
      "source_coverage",
      "boundary_clarity",
      "traversal_grounding",
      "governance_closure",
      "verification_surface",
      "content_consistency",
    ],
  },
  release_verification: {
    useCase: "release_verification",
    label: "Release verification",
    contextCollection: [
      "Collect release gates, verification refs, checkpoint coverage, and unresolved governance adjustments.",
      "Confirm the artifact closes the release surface rather than opening new design work.",
    ],
    codeEditingFocus: [
      "Prefer verification fixes over new feature scope during release verification.",
      "Block release if required governance evidence or checkpoint coverage is missing.",
    ],
    requiredSourceGroups: [
      ["corridor"],
      ["checkpoint-lattice", "checkpoint"],
      ["governance-run"],
    ],
    requiredQualityDimensions: [
      "source_coverage",
      "boundary_clarity",
      "corridor_contract_coverage",
      "checkpoint_observability",
      "governance_closure",
      "verification_surface",
      "content_consistency",
    ],
  },
};

export class InMemoryPromptArtifactContextProviderRegistry
  implements PromptArtifactContextProviderRegistry
{
  private readonly providers: readonly PromptArtifactContextProvider[];

  constructor(providers: readonly PromptArtifactContextProvider[] = []) {
    this.providers = [...providers];
  }

  list(): readonly PromptArtifactContextProvider[] {
    return [...this.providers];
  }

  resolve(request: PromptArtifactContextRequest): PromptArtifactDefinitionContextExtraction | null {
    for (const provider of this.providers) {
      if (!provider.targetKinds.includes(request.targetKind)) continue;
      if (!provider.canResolve(request)) continue;
      const resolved = provider.resolve(request);
      if (resolved) return resolved;
    }
    return null;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function joinValues(values: readonly string[] | undefined): string {
  return unique(values ?? []).join(", ");
}

function formatMaybe(label: string, value: string | undefined): string[] {
  return value && value.trim().length > 0 ? [`${label}: ${value}`] : [];
}

function formatMaybeList(label: string, values: readonly string[] | undefined): string[] {
  const joined = joinValues(values);
  return joined ? [`${label}: ${joined}`] : [];
}

function useCaseProfile(
  useCase: PromptArtifactUseCase | undefined,
): PromptArtifactUseCaseProfile | undefined {
  return useCase ? PROMPT_ARTIFACT_USE_CASE_PROFILES[useCase] : undefined;
}

function section(tag: string, lines: readonly string[]): PromptArtifactSection {
  return {
    tag,
    lines: unique(lines),
  };
}

function renderSection({ tag, lines }: PromptArtifactSection): string[] {
  return [`<${tag}>`, ...lines.map((line) => `- ${line}`), `</${tag}>`];
}

function renderArtifact(kind: PromptArtifactKind, sections: readonly PromptArtifactSection[]): string {
  return [`<${kind}>`, ...sections.flatMap(renderSection), `</${kind}>`].join("\n");
}

function commonArtifactSections(input: {
  artifactId: string;
  kind: PromptArtifactKind;
  useCase?: PromptArtifactUseCase;
  workArea: PromptArtifactWorkArea;
  sourceRefs: readonly string[];
}): PromptArtifactSection[] {
  const profile = useCaseProfile(input.useCase);
  return [
    section("artifact_metadata", [
      `Artifact id: ${input.artifactId}`,
      `Kind: ${input.kind}`,
      ...formatMaybe("Use case", profile?.label),
      `Work area id: ${input.workArea.workAreaId}`,
      ...formatMaybe("Guidance source", GPT5_PROMPT_GUIDE_SOURCE.label),
    ]),
    section("source_evidence", [
      ...input.sourceRefs.map((ref) => `Source ref: ${ref}`),
      "Use source refs as retrieval anchors before changing rules or code.",
    ]),
    section("context_collection_contract", [
      ...(profile?.contextCollection ?? [
        "Collect work area boundary, relevant definitions, verification surface, and source refs.",
      ]),
      ...formatMaybeList("Required source groups", profile?.requiredSourceGroups.map((group) => group.join(" | "))),
      ...formatMaybeList("Required quality dimensions", profile?.requiredQualityDimensions),
    ]),
  ];
}

function qualityGateSection(): PromptArtifactSection {
  return section("quality_gate", [
    "Run evaluatePromptArtifactQuality before using this artifact as model guidance.",
    "If grade is blocked, manage operational ontology first and regenerate the artifact.",
    "If ontologyManagementRequired is true, follow recommendedManagementActions before expanding scope.",
  ]);
}

function traversalRef(observation: TraversalObservation): string {
  const traversal = observation.traversal;
  return `traversal:${traversal.canonicalKey ?? `${traversal.purpose}:${traversal.start}->${traversal.end}`}`;
}

function sourceRef(prefix: string, id: string): string {
  return id.startsWith(`${prefix}:`) ? id : `${prefix}:${id}`;
}

function collectSourceRefs(
  workArea: PromptArtifactWorkArea,
  sources: PromptArtifactSourceSet | undefined,
): string[] {
  return unique([
    sourceRef("work-area", workArea.workAreaId),
    ...(sources?.corridors ?? []).map((corridor) => sourceRef("corridor", corridor.flowId)),
    ...(sources?.checkpointLattices ?? []).map(
      (lattice) => `checkpoint-lattice:${lattice.corridorId}`,
    ),
    ...(sources?.checkpoints ?? []).map(
      (checkpoint) => `checkpoint:${checkpoint.checkpointId}`,
    ),
    ...(sources?.traversals ?? []).map(traversalRef),
    ...(sources?.blueprints ?? []).map(
      (blueprint) => `governance-blueprint:${blueprint.blueprintId}`,
    ),
    ...(sources?.governanceRuns ?? []).map((run) => `governance-run:${run.runId}`),
  ]);
}

function summarizeCorridors(sources: PromptArtifactSourceSet | undefined): string[] {
  return (sources?.corridors ?? []).flatMap((corridor) => [
    `Corridor ${corridor.flowId} starts at ${corridor.entryNodeId} and carries schemas ${joinValues(corridor.schemaIds) || "none"}.`,
    `Corridor ${corridor.flowId} has ${corridor.endpoints.length} endpoints, ${corridor.contracts.length} contracts, and ${corridor.links.length} links.`,
  ]);
}

function summarizeCheckpoints(sources: PromptArtifactSourceSet | undefined): string[] {
  const latticeLines = (sources?.checkpointLattices ?? []).map(
    (lattice) =>
      `Checkpoint lattice ${lattice.corridorId} has ${lattice.definitions.length} definitions and ${lattice.observations.length} observations.`,
  );
  const checkpointLines = (sources?.checkpoints ?? []).map(
    (checkpoint) =>
      `Checkpoint ${checkpoint.checkpointId} observes ${checkpoint.observedNodeKeys.length} nodes and ${checkpoint.observedEdgeKeys.length} edges.`,
  );
  return [...latticeLines, ...checkpointLines];
}

function summarizeTraversals(sources: PromptArtifactSourceSet | undefined): string[] {
  return (sources?.traversals ?? []).map((observation) => {
    const traversal = observation.traversal;
    const status = observation.loopDetected
      ? "loop detected"
      : observation.unreachableGoalIds.length > 0
        ? "unreachable goals remain"
        : "goals reachable";
    return `Traversal ${traversal.purpose} from ${traversal.start} to ${traversal.end}: ${status}.`;
  });
}

function summarizeBlueprints(sources: PromptArtifactSourceSet | undefined): string[] {
  return (sources?.blueprints ?? []).map(
    (blueprint) =>
      `Blueprint ${blueprint.blueprintId} binds ${blueprint.unitKind} at ${blueprint.coordinateRef}.`,
  );
}

function summarizeGovernanceRuns(sources: PromptArtifactSourceSet | undefined): string[] {
  return (sources?.governanceRuns ?? []).flatMap((run) => {
    const failed = run.constraintVerdicts.filter((verdict) => !verdict.valid);
    const base = `Governance run ${run.runId} has ${failed.length} failing verdicts and ${run.adjustmentRecords.length} adjustments.`;
    const failures = failed.map((verdict) => `${verdict.code}: ${verdict.message}`);
    return [base, ...failures];
  });
}

function summarizeVerificationRefs(sources: PromptArtifactSourceSet | undefined): string[] {
  return unique([
    ...(sources?.governanceRuns ?? []).flatMap((run) => run.verificationRefs),
    ...(sources?.blueprints ?? []).flatMap((blueprint) =>
      (blueprint.verificationBinding?.verificationRefs ?? []).map((ref) => ref.ref),
    ),
  ]).map((ref) => `Verification ref: ${ref}`);
}

function purposeForUseCase(useCase: PromptArtifactUseCase | undefined): string {
  if (useCase === "event_inventory" || useCase === "incident_investigation") {
    return "observe";
  }
  if (useCase === "schema_governance_review" || useCase === "release_verification") {
    return "validate";
  }
  return "implement";
}

function docLabel(doc: PromptArtifactDefinitionDoc): string {
  return doc.title ?? doc.docId;
}

function inferVerificationRefs(
  docs: readonly PromptArtifactDefinitionDoc[],
  explicitRefs: readonly string[] | undefined,
): string[] {
  const refs = new Set(explicitRefs ?? []);
  for (const doc of docs) {
    if (doc.sourcePath?.endsWith(".test.ts")) {
      refs.add(doc.sourcePath);
    }
    const body = doc.body ?? "";
    for (const match of body.matchAll(/`([^`]+\.test\.ts[^`]*)`/g)) {
      refs.add(match[1]!);
    }
    for (const match of body.matchAll(/packages\/[^\s`"']+\.test\.ts(?::[^\s`"']+)?/g)) {
      refs.add(match[0]!);
    }
  }
  return [...refs];
}

export function extractPromptArtifactSourcesFromDefinitionContext(
  input: PromptArtifactDefinitionContextInput,
): PromptArtifactDefinitionContextExtraction {
  const root = input.root;
  const children = input.children ?? [];
  const docs = [root, ...children];
  const flowId = `${root.docId}-definition-context`;
  const nodeIds = unique(docs.map((doc) => doc.docId));
  const outgoingLinks = input.outgoingLinks ?? [];
  const incomingLinks = input.incomingLinks ?? [];
  const verificationRefs = inferVerificationRefs(docs, input.verificationRefs);
  const implementationRefs = unique(
    docs.flatMap((doc) => (doc.sourcePath ? [doc.sourcePath] : [])),
  );
  const schemaIds = unique([
    root.docId,
    ...children
      .filter((doc) => doc.lifecycle === "approved" || doc.lifecycle === "draft")
      .map((doc) => doc.docId),
  ]);
  const edgeKeys = unique([
    ...children.map((child) => `contains:${root.docId}->${child.docId}`),
    ...outgoingLinks.map((link) => `${link.type}:${link.source}->${link.target}`),
    ...incomingLinks.map((link) => `${link.type}:${link.source}->${link.target}`),
  ]);
  const corridor: FlowCorridor = {
    flowId,
    templateKind: "pipe_graph",
    entryNodeId: root.docId,
    nodeIds,
    schemaIds,
    endpoints: [
      {
        endpointId: `endpoint:${root.docId}:definition`,
        templateKind: "port",
        nodeId: root.docId,
        direction: "in",
        facetKind: "definition",
        sourceKind: "port",
      },
      ...children.map((child) => ({
        endpointId: `endpoint:${child.docId}:context`,
        templateKind: "port" as const,
        nodeId: child.docId,
        direction: "out" as const,
        facetKind: "consumption" as const,
        sourceKind: "port" as const,
      })),
    ],
    contracts: [
      {
        contractId: `contract:${root.docId}:definition-context`,
        templateKind: "pipe_contract",
        nodeId: root.docId,
        consumes: [
          { field: "purpose", type: "definition-purpose", required: true },
          { field: "links", type: "definition-links", required: true },
        ],
        produces: [
          { field: "children", type: "definition-context", required: children.length > 0 },
          { field: "concerns", type: "definition-tags", required: (root.tags ?? []).length > 0 },
        ],
      },
    ],
    links: edgeKeys.map((edgeKey, index) => ({
      linkId: `link:${flowId}:${index + 1}`,
      templateKind: "pipe_connection",
      fromEndpointId: `endpoint:${root.docId}:definition`,
      toEndpointId:
        children[index]?.docId
          ? `endpoint:${children[index]!.docId}:context`
          : `endpoint:${root.docId}:definition`,
      semantic: "contract_descent",
      medium: "direct",
      relationType: edgeKey.split(":", 1)[0],
      sourceKind: "connection",
    })),
  };
  const checkpointLattice = {
    corridorId: flowId,
    rootCheckpointId: `checkpoint:${root.docId}:definition-context`,
    definitions: docs.map((doc, index) => ({
      checkpointId: `checkpoint:${doc.docId}:definition-context`,
      templateKind: index === 0 ? "root" as const : "payload_field" as const,
      nodeId: doc.docId,
      observedPrefixIds: ["def_document"],
      observedFields: unique([
        doc.purpose ? "purpose" : "",
        ...(doc.tags ?? []).length > 0 ? ["tags"] : [],
        doc.sourcePath ? "sourcePath" : "",
      ]),
    })),
    observations: [
      {
        checkpointId: `checkpoint:${root.docId}:definition-context`,
        templateKind: "root" as const,
        recordId: `def:${root.docId}`,
        traceId: `definition-context:${root.docId}`,
        eventKey: "definition.context.extracted",
        timestamp: input.now ?? new Date(0).toISOString(),
        observedNodeKeys: nodeIds,
        observedEdgeKeys: edgeKeys,
        transmissions: [],
        dataFlow: corridor,
      },
    ],
    links: children.map((child) => ({
      fromCheckpointId: `checkpoint:${root.docId}:definition-context`,
      toCheckpointId: `checkpoint:${child.docId}:definition-context`,
      relation: "contains" as const,
    })),
  };
  const traversalPurpose = purposeForUseCase(input.useCase);
  const terminalNodeId = children[0]?.docId ?? root.docId;
  const blueprintId = `${root.docId}-prompt-artifact-governance`;
  const blueprint: ImplementationBlueprint = {
    blueprintId,
    coordinateRef: `corridor:${flowId}`,
    unitKind: "corridor_bundle",
    implementationBinding: {
      coordinateRef: `corridor:${flowId}`,
      implementationRefs: implementationRefs.map((ref) => ({
        kind: "document",
        ref,
      })),
    },
    verificationBinding: {
      coordinateRef: `corridor:${flowId}`,
      verificationRefs: verificationRefs.map((ref) => ({ kind: "test", ref })),
    },
    constraints: [
      { kind: "unit_boundary", severity: "core" },
      { kind: "validation_surface", requiredRefs: verificationRefs.length > 0 ? ["test"] : [] },
      { kind: "evolution_rule" },
    ],
    adjustmentPolicy: { allowedActions: ["defer", "escalate"] },
    evolutionPolicy: { kind: "append_only" },
  };
  const evaluation = evaluateImplementationGovernance({
    blueprint,
    runId: `governance:${root.docId}:definition-context`,
    now: input.now,
  });
  const workArea: PromptArtifactWorkArea = {
    workAreaId: root.docId,
    displayName: docLabel(root),
    rootRef: root.sourcePath ?? root.docId,
    purpose: root.purpose,
    paths: unique(
      implementationRefs.length > 0
        ? implementationRefs
        : [`docs/specs/${root.docId}`],
    ),
    stack: ["Definition Catalog", "Operational Ontology"],
    constraints: unique([
      ...(root.tags ?? []).map((tag) => `tag:${tag}`),
      ...outgoingLinks.map((link) => `${link.type}:${link.target}`),
    ]),
  };
  return {
    workArea,
    sources: {
      corridors: [corridor],
      checkpointLattices: [checkpointLattice],
      traversals: [
        {
          traversal: {
            purpose: traversalPurpose,
            start: root.docId,
            edges: edgeKeys,
            end: terminalNodeId,
            canonicalKey: `${root.docId}:${traversalPurpose}`,
          },
          reachedGoalIds: children.map((child) => child.docId),
          unreachableGoalIds: [],
          loopDetected: false,
          recoveryUsed: false,
          terminalNodeId,
          terminalReason: "definition-context-extracted",
        },
      ],
      blueprints: [
        blueprint,
      ],
      governanceRuns: [
        evaluation.governanceRun,
      ],
    },
  };
}

function selfReflectionSections(input: PromptArtifactGenerationInput): PromptArtifactSection[] {
  const { workArea, sources } = input;
  const profile = useCaseProfile(input.useCase);
  return [
    section("context_boundary", [
      `Work area: ${workArea.displayName ?? workArea.workAreaId}`,
      ...formatMaybe("Use case", profile?.label),
      ...formatMaybe("Root", workArea.rootRef),
      ...formatMaybe("Purpose", workArea.purpose),
      ...formatMaybeList("Allowed paths", workArea.paths),
      "Treat ontology source refs as evidence and do not invent missing contracts.",
    ]),
    section("context_gathering", [
      "Start broad, then use one focused pass when signals conflict.",
      "Stop gathering context once exact files, definitions, or coordinates to change are named.",
      "Search again only when validation fails or a new unknown appears.",
      ...(profile?.contextCollection ?? []),
      ...summarizeCorridors(sources),
      ...summarizeTraversals(sources),
    ]),
    section("tool_reflection", [
      "After each read, edit, or verification step, decide whether corridor, checkpoint, traversal, or governance evidence changed the plan.",
      "If checkpoint validation or governance verdicts fail, record the allowed adjustment before continuing.",
      ...summarizeCheckpoints(sources),
      ...summarizeGovernanceRuns(sources),
    ]),
    section("completion_check", [
      "Finish only after source refs, verification status, and remaining gaps are explicit.",
      "Escalate core coordinate or required facet changes instead of silently rewriting the design boundary.",
      ...formatMaybeList("Local constraints", workArea.constraints),
      ...(input.extraInstructions ?? []),
    ]),
  ];
}

function codeEditingRuleSections(input: PromptArtifactGenerationInput): PromptArtifactSection[] {
  const { workArea, sources } = input;
  const profile = useCaseProfile(input.useCase);
  return [
    section("work_area_boundary", [
      `Work area: ${workArea.displayName ?? workArea.workAreaId}`,
      ...formatMaybe("Use case", profile?.label),
      ...formatMaybe("Root", workArea.rootRef),
      ...formatMaybeList("Editable paths", workArea.paths),
      "Stay inside the work area unless a traversal or governance adjustment names an external dependency.",
    ]),
    section("editing_principles", [
      "Write code for clarity first; prefer readable names and straightforward control flow.",
      "Reuse existing local patterns before adding new abstractions.",
      "Keep comments sparse and use them only where they reduce real parsing cost.",
      ...(profile?.codeEditingFocus ?? []),
      ...formatMaybeList("Stack", workArea.stack),
      ...formatMaybeList("Local instructions", workArea.localInstructions),
    ]),
    section("ontology_binding", [
      "Every edit should preserve the blueprint coordinate and the corridor contracts it implements.",
      "Do not hardcode derived observation coordinates when a builder or projector owns them.",
      "Update the definition document when the implementation changes the managed design boundary.",
      ...summarizeBlueprints(sources),
      ...summarizeCorridors(sources),
    ]),
    section("verification", [
      "Run the named verification surface when it is available; otherwise record the missing gate as a governance gap.",
      "A passing edit needs matching implementation refs and verification refs in the governance run.",
      "Treat failing core constraints as escalation, not local cleanup.",
      ...summarizeVerificationRefs(sources),
      ...summarizeGovernanceRuns(sources),
      ...(input.extraInstructions ?? []),
    ]),
  ];
}

function createIssue(
  level: "error" | "warning",
  code: string,
  message: string,
  path: string,
): PromptArtifactValidationIssue {
  return { level, code, message, path };
}

function normalizePromptContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

export function validatePromptArtifact(
  artifact: Omit<PromptArtifact, "validation">,
): PromptArtifactValidationResult {
  const issues: PromptArtifactValidationIssue[] = [];
  const requiredSections = [
    ...PROMPT_ARTIFACT_COMMON_SECTIONS,
    ...PROMPT_ARTIFACT_REQUIRED_SECTIONS[artifact.kind],
  ];
  const sectionTags = new Set(artifact.sections.map((item) => item.tag));

  if (!artifact.artifactId.trim()) {
    issues.push(createIssue("error", "prompt-artifact-id-empty", "Artifact id must not be empty", "artifactId"));
  }

  if (!artifact.workAreaId.trim()) {
    issues.push(createIssue("error", "prompt-work-area-empty", "Work area id must not be empty", "workAreaId"));
  }

  if (!artifact.content.startsWith(`<${artifact.kind}>`)) {
    issues.push(
      createIssue(
        "error",
        "prompt-root-tag-missing",
        `Prompt artifact must start with <${artifact.kind}>`,
        "content",
      ),
    );
  }

  if (!artifact.content.endsWith(`</${artifact.kind}>`)) {
    issues.push(
      createIssue(
        "error",
        "prompt-root-tag-unclosed",
        `Prompt artifact must end with </${artifact.kind}>`,
        "content",
      ),
    );
  }

  for (const requiredSection of requiredSections) {
    if (!sectionTags.has(requiredSection)) {
      issues.push(
        createIssue(
          "error",
          "prompt-section-missing",
          `Prompt artifact is missing required section "${requiredSection}"`,
          `sections.${requiredSection}`,
        ),
      );
    }
  }

  artifact.sections.forEach((item, index) => {
    if (item.lines.length === 0) {
      issues.push(
        createIssue(
          "error",
          "prompt-section-empty",
          `Prompt section "${item.tag}" must contain at least one line`,
          `sections.${index}`,
        ),
      );
    }
  });

  const expectedContent = renderArtifact(artifact.kind, artifact.sections);
  if (normalizePromptContent(artifact.content) !== expectedContent) {
    issues.push(
      createIssue(
        "error",
        "prompt-content-section-mismatch",
        "Prompt artifact content must match the rendered section structure",
        "content",
      ),
    );
  }

  if (artifact.sourceRefs.length <= 1) {
    issues.push(
      createIssue(
        "warning",
        "prompt-ontology-source-missing",
        "Prompt artifact has no ontology source refs beyond the work area",
        "sourceRefs",
      ),
    );
  }

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}

const QUALITY_WEIGHTS: Record<PromptArtifactQualityDimension, number> = {
  source_coverage: 15,
  boundary_clarity: 10,
  corridor_contract_coverage: 15,
  checkpoint_observability: 10,
  traversal_grounding: 10,
  governance_closure: 15,
  verification_surface: 10,
  content_consistency: 15,
};

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function qualityGrade(score: number): PromptArtifactQualityGrade {
  if (score >= 85) return "ready";
  if (score >= 60) return "usable";
  if (score >= 40) return "degraded";
  return "blocked";
}

function issueLevel(score: number): PromptArtifactQualityIssue["level"] {
  if (score < 40) return "error";
  if (score < 85) return "warning";
  return "info";
}

function hasSourceRef(
  artifact: PromptArtifact,
  prefix: string,
): boolean {
  return artifact.sourceRefs.some((ref) => ref.startsWith(`${prefix}:`));
}

function hasAnySourceRef(
  artifact: PromptArtifact,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => hasSourceRef(artifact, prefix));
}

function sourceCoverageGroups(
  artifact: PromptArtifact,
): readonly (readonly string[])[] {
  return (
    useCaseProfile(artifact.useCase)?.requiredSourceGroups ?? [
      ["corridor"],
      ["checkpoint-lattice", "checkpoint"],
      ["traversal"],
      ["governance-blueprint"],
      ["governance-run"],
    ]
  );
}

function qualityIssue(input: {
  score: number;
  code: string;
  message: string;
  dimension: PromptArtifactQualityDimension;
  managementPlane: PromptArtifactManagementPlane;
  sourceRefs?: readonly string[];
}): PromptArtifactQualityIssue {
  return {
    level: issueLevel(input.score),
    code: input.code,
    message: input.message,
    dimension: input.dimension,
    managementPlane: input.managementPlane,
    sourceRefs: input.sourceRefs ?? [],
  };
}

function governanceWarning(input: {
  code: string;
  message: string;
  sourceRefs?: readonly string[];
}): PromptArtifactQualityIssue {
  return {
    level: "warning",
    code: input.code,
    message: input.message,
    dimension: "governance_closure",
    managementPlane: "governance",
    sourceRefs: input.sourceRefs ?? [],
  };
}

function metric(
  dimension: PromptArtifactQualityDimension,
  score: number,
  issues: readonly PromptArtifactQualityIssue[] = [],
  applicable = true,
): PromptArtifactQualityMetric {
  return {
    dimension,
    score: clampScore(score),
    weight: applicable ? QUALITY_WEIGHTS[dimension] : 0,
    applicable,
    issues,
  };
}

function scoreSourceCoverage(artifact: PromptArtifact): PromptArtifactQualityMetric {
  const groups = sourceCoverageGroups(artifact);
  const covered = groups.filter((group) => hasAnySourceRef(artifact, group)).length;
  const score = groups.length > 0 ? (covered / groups.length) * 100 : 100;
  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-source-coverage-low",
            message:
              "Prompt artifact lacks enough ontology source refs to explain the work area.",
            dimension: "source_coverage",
            managementPlane: "governance",
          }),
        ]
      : [];
  return metric("source_coverage", score, issues);
}

function scoreBoundaryClarity(
  artifact: PromptArtifact,
  workArea: PromptArtifactWorkArea | undefined,
): PromptArtifactQualityMetric {
  const score =
    (artifact.workAreaId.trim().length > 0 ? 25 : 0) +
    (workArea?.rootRef ? 25 : 0) +
    ((workArea?.paths?.length ?? 0) > 0 ? 25 : 0) +
    (workArea?.purpose ? 25 : 0);
  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-boundary-unclear",
            message: "Work area root, purpose, or editable paths are not fully defined.",
            dimension: "boundary_clarity",
            managementPlane: "work_area",
            sourceRefs: [sourceRef("work-area", artifact.workAreaId)],
          }),
        ]
      : [];
  return metric("boundary_clarity", score, issues);
}

function scoreCorridor(corridor: FlowCorridor): number {
  return (
    20 +
    (corridor.endpoints.length > 0 ? 25 : 0) +
    (corridor.contracts.length > 0 ? 30 : 0) +
    (corridor.links.length > 0 ? 25 : 0)
  );
}

function scoreCorridorContractCoverage(
  artifact: PromptArtifact,
  sources: PromptArtifactSourceSet | undefined,
): PromptArtifactQualityMetric {
  const corridors = sources?.corridors ?? [];
  const score =
    corridors.length > 0
      ? corridors.reduce((sum, corridor) => sum + scoreCorridor(corridor), 0) /
        corridors.length
      : hasSourceRef(artifact, "corridor")
        ? 60
        : 0;
  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-corridor-contract-coverage-low",
            message: "Corridor evidence lacks endpoints, contracts, or links.",
            dimension: "corridor_contract_coverage",
            managementPlane: "corridor",
            sourceRefs: artifact.sourceRefs.filter((ref) => ref.startsWith("corridor:")),
          }),
        ]
      : [];
  return metric("corridor_contract_coverage", score, issues);
}

function scoreCheckpointObservability(
  artifact: PromptArtifact,
  sources: PromptArtifactSourceSet | undefined,
): PromptArtifactQualityMetric {
  const lattices = sources?.checkpointLattices ?? [];
  const checkpoints = sources?.checkpoints ?? [];
  let score = 0;

  if (lattices.length > 0 || checkpoints.length > 0) {
    const latticeScore =
      lattices.length > 0
        ? lattices.reduce(
            (sum, lattice) =>
              sum +
              20 +
              (lattice.definitions.length > 0 ? 35 : 0) +
              (lattice.observations.length > 0 ? 35 : 0) +
              (lattice.links.length > 0 ? 10 : 0),
            0,
          ) / lattices.length
        : 0;
    const checkpointScore =
      checkpoints.length > 0
        ? checkpoints.reduce(
            (sum, checkpoint) =>
              sum +
              40 +
              (checkpoint.observedNodeKeys.length > 0 ? 30 : 0) +
              (checkpoint.observedEdgeKeys.length > 0 ? 30 : 0),
            0,
          ) / checkpoints.length
        : 0;
    score = Math.max(latticeScore, checkpointScore);
  } else if (
    hasSourceRef(artifact, "checkpoint-lattice") ||
    hasSourceRef(artifact, "checkpoint")
  ) {
    score = 60;
  }

  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-checkpoint-observability-low",
            message:
              "Checkpoint evidence does not yet prove stable observation points for this work area.",
            dimension: "checkpoint_observability",
            managementPlane: "checkpoint",
            sourceRefs: artifact.sourceRefs.filter(
              (ref) => ref.startsWith("checkpoint-lattice:") || ref.startsWith("checkpoint:"),
            ),
          }),
        ]
      : [];
  return metric("checkpoint_observability", score, issues);
}

function scoreTraversalGrounding(
  artifact: PromptArtifact,
  sources: PromptArtifactSourceSet | undefined,
): PromptArtifactQualityMetric {
  const traversals = sources?.traversals ?? [];
  const score =
    traversals.length > 0
      ? traversals.reduce((sum, observation) => {
          if (observation.loopDetected) return sum + 30;
          if (observation.unreachableGoalIds.length > 0) return sum + 50;
          return sum + 100;
        }, 0) / traversals.length
      : hasSourceRef(artifact, "traversal")
        ? 60
        : 0;
  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-traversal-grounding-low",
            message:
              "Traversal evidence does not explain cross-boundary dependencies well enough.",
            dimension: "traversal_grounding",
            managementPlane: "traversal",
            sourceRefs: artifact.sourceRefs.filter((ref) => ref.startsWith("traversal:")),
          }),
        ]
      : [];
  return metric("traversal_grounding", score, issues);
}

function scoreGovernanceClosure(
  artifact: PromptArtifact,
  sources: PromptArtifactSourceSet | undefined,
  qualityStatusEvidence: readonly PromptArtifactQualityStatusEvidence[] | undefined,
): PromptArtifactQualityMetric {
  const blueprints = sources?.blueprints ?? [];
  const runs = sources?.governanceRuns ?? [];
  const hasBlueprint = blueprints.length > 0 || hasSourceRef(artifact, "governance-blueprint");
  const hasRun = runs.length > 0 || hasSourceRef(artifact, "governance-run");
  const hasOnlySyntheticRuns =
    runs.length > 0 && runs.every((run) => run.runId.includes(":definition-context"));
  const hasPersistedSyntheticRuns =
    hasOnlySyntheticRuns && runs.every((run) => run.runId.includes(":persisted"));
  const syntheticRunsHaveVerdicts =
    hasOnlySyntheticRuns && runs.every((run) => run.constraintVerdicts.length > 0);
  const failingVerdicts = runs.flatMap((run) =>
    run.constraintVerdicts.filter((verdict) => !verdict.valid),
  );
  const unresolvedAdjustments = runs.flatMap((run) => run.adjustmentRecords);
  const rawScore =
    (hasBlueprint ? 30 : 0) +
    (hasRun ? 30 : 0) +
    (runs.length > 0 && failingVerdicts.length === 0 ? 25 : hasRun ? 10 : 0) +
    (runs.length > 0 && unresolvedAdjustments.length === 0 ? 15 : hasRun ? 5 : 0);
  const score = hasOnlySyntheticRuns
    ? hasPersistedSyntheticRuns
      ? rawScore
      : syntheticRunsHaveVerdicts && failingVerdicts.length === 0 && unresolvedAdjustments.length === 0
      ? Math.min(rawScore, 95)
      : Math.min(rawScore, 80)
    : rawScore;
  const qualityStatusAdjustment = qualityStatusEvidence
    ? governanceClosureQualityStatusAdjustment(score, qualityStatusEvidence)
    : { score };
  const adjustedScore = qualityStatusAdjustment.score;
  const issues =
    adjustedScore < 85
      ? [
          qualityIssue({
            score: adjustedScore,
            code: hasOnlySyntheticRuns
              ? "prompt-governance-evidence-synthetic"
              : "prompt-governance-closure-low",
            message: hasOnlySyntheticRuns
              ? "Governance evidence was synthesized from definition context and should be closed by a real governance run."
              : "Governance evidence is missing, failing, or still has unresolved adjustments.",
            dimension: "governance_closure",
            managementPlane: "governance",
            sourceRefs: artifact.sourceRefs.filter((ref) => ref.startsWith("governance-")),
          }),
        ]
      : [];
  return metric(
    "governance_closure",
    adjustedScore,
    [...issues, ...(qualityStatusAdjustment.issues ?? [])],
  );
}

function governanceClosureQualityStatusAdjustment(
  baseScore: number,
  evidence: readonly PromptArtifactQualityStatusEvidence[],
): { score: number; issues?: readonly PromptArtifactQualityIssue[] } {
  if (evidence.length === 0) {
    return {
      score: Math.min(baseScore, 75),
      issues: [
        governanceWarning({
          code: "prompt-quality-status-evidence-missing",
          message:
            "Artifact extraction did not include quality-status evidence, so governance closure confidence is capped.",
        }),
      ],
    };
  }

  const targetEvidence = evidence.filter((item) => item.verifiesTarget);
  if (targetEvidence.length === 0) {
    return {
      score: Math.min(baseScore, 75),
      issues: [
        governanceWarning({
          code: "prompt-quality-status-evidence-target-missing",
          message:
            "Quality-status evidence did not verify the prompt target, so it cannot close governance.",
          sourceRefs: evidence.flatMap(qualityStatusEvidenceSourceRefs),
        }),
      ],
    };
  }

  const issues = targetEvidence.flatMap((item) => qualityStatusEvidenceWarnings(item));
  if (issues.length > 0) {
    return {
      score: Math.min(baseScore, 80),
      issues,
    };
  }

  const verifiedEvidence = targetEvidence.filter(hasVerifiedQualityStatusClosure);
  if (verifiedEvidence.length === 0) {
    return {
      score: Math.min(baseScore, 80),
      issues,
    };
  }

  const verifiedSurfaceCount = verifiedEvidence.reduce(
    (sum, item) =>
      sum +
      (item.verifiedBundleRefs?.length ?? 0) +
      (item.verifiedGateRefs?.length ?? 0) +
      (item.verifiedGateCount ?? 0),
    0,
  );
  const additiveScore = Math.min(20, 10 + verifiedSurfaceCount * 5);
  return {
    score: Math.min(100, baseScore + additiveScore),
    issues,
  };
}

function hasVerifiedQualityStatusClosure(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  return evidence.outcome === "verified" &&
    hasCompleteVerifiedQualityStatusSurface(evidence);
}

function hasCompleteVerifiedQualityStatusSurface(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  const bundleRefs = evidence.bundleRefs ?? [];
  const verifiedBundleRefs = evidence.verifiedBundleRefs ?? [];
  const hasCompleteBundleSurface =
    verifiedBundleRefs.length > 0 &&
    bundleRefs.every((ref) => verifiedBundleRefs.includes(ref));
  const gateRefs = evidence.gateRefs ?? [];
  const verifiedGateRefs = evidence.verifiedGateRefs ?? [];
  const hasCompleteGateRefSurface =
    verifiedGateRefs.length > 0 &&
    gateRefs.every((ref) => verifiedGateRefs.includes(ref));
  const verifiedGateCount = evidence.verifiedGateCount ?? 0;
  const hasCompleteGateCountSurface =
    evidence.totalGateCount === undefined
      ? verifiedGateCount > 0
      : evidence.totalGateCount > 0 && verifiedGateCount >= evidence.totalGateCount;

  return hasCompleteBundleSurface ||
    hasCompleteGateRefSurface ||
    hasCompleteGateCountSurface;
}

function qualityStatusEvidenceWarnings(
  evidence: PromptArtifactQualityStatusEvidence,
): PromptArtifactQualityIssue[] {
  const refs = qualityStatusEvidenceSourceRefs(evidence);
  if (evidence.outcome === "verified") {
    if (hasVerifiedQualityStatusClosure(evidence)) return [];
    return [
      governanceWarning({
        code: "prompt-quality-status-evidence-incomplete",
        message:
          evidence.message ??
          "Quality-status evidence verified the target but did not report a complete verified bundle or gate surface.",
        sourceRefs: refs,
      }),
    ];
  }

  return [
    governanceWarning({
      code: `prompt-quality-status-evidence-${evidence.outcome}`,
      message:
        evidence.message ??
        `Quality-status evidence reported ${evidence.outcome} verification for the target.`,
      sourceRefs: refs,
    }),
  ];
}

function qualityStatusEvidenceSourceRefs(
  evidence: PromptArtifactQualityStatusEvidence,
): string[] {
  return unique([
    evidence.evidenceId,
    ...evidence.targetRefs,
    ...(evidence.sourceRefs ?? []),
    ...(evidence.bundleRefs ?? []),
    ...(evidence.verifiedBundleRefs ?? []),
    ...(evidence.gateRefs ?? []),
    ...(evidence.verifiedGateRefs ?? []),
  ]);
}

function scoreVerificationSurface(
  artifact: PromptArtifact,
  sources: PromptArtifactSourceSet | undefined,
): PromptArtifactQualityMetric {
  const verificationRefs = [
    ...(sources?.governanceRuns ?? []).flatMap((run) => run.verificationRefs),
    ...(sources?.blueprints ?? []).flatMap((blueprint) =>
      (blueprint.verificationBinding?.verificationRefs ?? []).map((ref) => ref.ref),
    ),
  ];
  const score = verificationRefs.length > 0 ? 100 : hasSourceRef(artifact, "governance-run") ? 60 : 0;
  const issues =
    score < 85
      ? [
          qualityIssue({
            score,
            code: "prompt-verification-surface-low",
            message: "Prompt artifact is not grounded in a concrete verification surface.",
            dimension: "verification_surface",
            managementPlane: "verification",
            sourceRefs: verificationRefs,
          }),
        ]
      : [];
  return metric("verification_surface", score, issues);
}

function scoreContentConsistency(
  validation: PromptArtifactValidationResult,
): PromptArtifactQualityMetric {
  const hasErrors = validation.issues.some((issue) => issue.level === "error");
  const score = hasErrors ? 0 : validation.issues.length > 0 ? 85 : 100;
  const issues = validation.issues
    .filter((issue) => issue.level === "error")
    .map((issue) =>
      qualityIssue({
        score,
        code: issue.code,
        message: issue.message,
        dimension: "content_consistency",
        managementPlane: "generator",
      }),
    );
  return metric("content_consistency", score, issues);
}

function actionForMetric(
  metricResult: PromptArtifactQualityMetric,
): PromptArtifactManagementAction | undefined {
  if (!metricResult.applicable) return undefined;
  if (metricResult.score >= 85) return undefined;

  const priority = metricResult.score < 40 ? "required" : "recommended";
  const issue = metricResult.issues[0];
  const targetRefs = issue?.sourceRefs ?? [];

  if (metricResult.dimension === "source_coverage") {
    return {
      kind: "add_ontology_source_refs",
      plane: "governance",
      priority,
      reason: issue?.message ?? "Add ontology evidence refs before using this artifact.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "boundary_clarity") {
    return {
      kind: "define_work_area_boundary",
      plane: "work_area",
      priority,
      reason: issue?.message ?? "Define the work area boundary.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "corridor_contract_coverage") {
    return {
      kind: "enrich_corridor_contracts",
      plane: "corridor",
      priority,
      reason: issue?.message ?? "Enrich corridor contracts.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "checkpoint_observability") {
    return {
      kind: "add_checkpoint_observability",
      plane: "checkpoint",
      priority,
      reason: issue?.message ?? "Add checkpoint observability.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "traversal_grounding") {
    return {
      kind: "record_traversal_grounding",
      plane: "traversal",
      priority,
      reason: issue?.message ?? "Record traversal grounding.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "governance_closure") {
    return {
      kind: "close_governance_evidence",
      plane: "governance",
      priority,
      reason: issue?.message ?? "Close governance evidence.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "verification_surface") {
    return {
      kind: "bind_verification_surface",
      plane: "verification",
      priority,
      reason: issue?.message ?? "Bind verification surface.",
      targetRefs,
    };
  }

  if (metricResult.dimension === "content_consistency") {
    return {
      kind: "repair_prompt_artifact_content",
      plane: "generator",
      priority,
      reason: issue?.message ?? "Repair prompt artifact content.",
      targetRefs,
    };
  }

  return undefined;
}

export function evaluatePromptArtifactQuality(
  input: PromptArtifactQualityEvaluationInput,
): PromptArtifactQualityEvaluation {
  const { validation: _existingValidation, ...artifactWithoutValidation } = input.artifact;
  const validation = validatePromptArtifact(artifactWithoutValidation);
  const profile = useCaseProfile(input.artifact.useCase);
  const metrics = [
    scoreSourceCoverage(input.artifact),
    scoreBoundaryClarity(input.artifact, input.workArea),
    scoreCorridorContractCoverage(input.artifact, input.sources),
    scoreCheckpointObservability(input.artifact, input.sources),
    scoreTraversalGrounding(input.artifact, input.sources),
    scoreGovernanceClosure(
      input.artifact,
      input.sources,
      input.qualityStatusEvidence,
    ),
    scoreVerificationSurface(input.artifact, input.sources),
    scoreContentConsistency(validation),
  ].map((item) => applyUseCaseQualityProfile(item, profile));
  const totalWeight = metrics.reduce((sum, item) => sum + item.weight, 0);
  const score = clampScore(
    totalWeight > 0
      ? metrics.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
      : 100,
  );
  const grade = qualityGrade(score);
  const issues = metrics.flatMap((item) => item.issues);
  const recommendedManagementActions = uniqueActions(
    metrics.flatMap((item) => {
      const action = actionForMetric(item);
      return action ? [action] : [];
    }),
  );

  return {
    score,
    grade,
    ontologyManagementRequired: recommendedManagementActions.some(
      (action) => action.plane !== "generator",
    ),
    validation,
    metrics,
    issues,
    recommendedManagementActions,
  };
}

function uniqueActions(
  actions: readonly PromptArtifactManagementAction[],
): PromptArtifactManagementAction[] {
  const seen = new Set<string>();
  const result: PromptArtifactManagementAction[] = [];
  for (const action of actions) {
    const key = `${action.kind}:${action.plane}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function applyUseCaseQualityProfile(
  metricResult: PromptArtifactQualityMetric,
  profile: PromptArtifactUseCaseProfile | undefined,
): PromptArtifactQualityMetric {
  if (!profile) return metricResult;
  if (profile.requiredQualityDimensions.includes(metricResult.dimension)) {
    return metricResult;
  }
  return metric(metricResult.dimension, 0, [], false);
}

export function generatePromptArtifact(input: PromptArtifactGenerationInput): PromptArtifact {
  const artifactId =
    input.artifactId ?? `prompt-artifact:${input.workArea.workAreaId}:${input.kind}`;
  const sourceRefs = collectSourceRefs(input.workArea, input.sources);
  const kindSections =
    input.kind === "self_reflection"
      ? selfReflectionSections(input)
      : codeEditingRuleSections(input);
  const sections = [
    ...commonArtifactSections({
      artifactId,
      kind: input.kind,
      useCase: input.useCase,
      workArea: input.workArea,
      sourceRefs,
    }),
    ...kindSections,
    qualityGateSection(),
  ];
  const base = {
    artifactId,
    kind: input.kind,
    useCase: input.useCase,
    workAreaId: input.workArea.workAreaId,
    sourceRefs,
    sections,
    content: renderArtifact(input.kind, sections),
    guidanceSource: GPT5_PROMPT_GUIDE_SOURCE,
  } satisfies Omit<PromptArtifact, "validation">;

  return {
    ...base,
    validation: validatePromptArtifact(base),
  };
}

export function generatePromptArtifacts(
  input: Omit<PromptArtifactGenerationInput, "kind"> & {
    kinds?: readonly PromptArtifactKind[];
  },
): PromptArtifact[] {
  const kinds = input.kinds ?? PROMPT_ARTIFACT_KINDS;
  return kinds.map((kind) => generatePromptArtifact({ ...input, kind }));
}
