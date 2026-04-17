import type {
  DeterministicLabelRecord,
  DeterministicLabelRecordState,
  SemanticCoordinateDiagnostic,
} from "./deterministic-labels.js";
import type { DocumentMetadata } from "./types.js";

export const DETERMINISTIC_LABEL_READINESS_GATES = [
  "lint",
  "resolve",
  "activate",
] as const;

export type DeterministicLabelReadinessGate =
  (typeof DETERMINISTIC_LABEL_READINESS_GATES)[number];

export interface DeterministicLabelReadinessGateResult {
  readonly gate: DeterministicLabelReadinessGate;
  readonly fromState: DeterministicLabelRecordState;
  readonly toState: DeterministicLabelRecordState;
  readonly ready: boolean;
  readonly blockers: readonly SemanticCoordinateDiagnostic[];
  readonly evidence: DocumentMetadata;
}

export interface DeterministicLabelReadinessProjection {
  readonly records: readonly DeterministicLabelRecord[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
}

export type DeterministicLabelTransitionDecision = "accepted" | "rejected";

export interface DeterministicLabelTransitionRequest {
  readonly targetLabel: string;
  readonly requestedState: DeterministicLabelRecordState;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly metadata?: DocumentMetadata | null;
}

export interface DeterministicLabelAppendOnlyTransitionEventSchemaCandidate {
  readonly schemaId: "deterministic-label-transition-event";
  readonly version: "candidate-v1";
  readonly appendOnly: true;
  readonly fields: readonly string[];
  readonly deferredFields: readonly string[];
}

export interface DeterministicLabelTransitionDryRunEventCandidate {
  readonly schemaId: "deterministic-label-transition-event";
  readonly schemaVersion: "candidate-v1";
  readonly targetLabel: string;
  readonly requestedState: DeterministicLabelRecordState;
  readonly currentState: DeterministicLabelRecordState | null;
  readonly nextState: DeterministicLabelRecordState | null;
  readonly decision: DeterministicLabelTransitionDecision;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly blockerCount: number;
}

export interface DeterministicLabelTransitionDryRunResult {
  readonly mode: "dry-run";
  readonly targetLabel: string;
  readonly requestedState: DeterministicLabelRecordState;
  readonly accepted: boolean;
  readonly decision: DeterministicLabelTransitionDecision;
  readonly currentState: DeterministicLabelRecordState | null;
  readonly nextState: DeterministicLabelRecordState | null;
  readonly blockers: readonly SemanticCoordinateDiagnostic[];
  readonly gateEvidence: readonly DeterministicLabelReadinessGateResult[];
  readonly evidenceRefs: readonly string[];
  readonly metadata: DocumentMetadata;
}

export const DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE = {
  schemaId: "deterministic-label-transition-event",
  version: "candidate-v1",
  appendOnly: true,
  fields: [
    "eventId",
    "targetLabel",
    "requestedState",
    "currentState",
    "nextState",
    "decision",
    "reason",
    "evidenceRefs",
    "gateEvidence",
    "blockers",
  ],
  deferredFields: [
    "actor",
    "sequence",
    "committedAt",
    "registryRevision",
  ],
} as const satisfies DeterministicLabelAppendOnlyTransitionEventSchemaCandidate;

interface GateEvaluation {
  readonly gate: DeterministicLabelReadinessGate;
  readonly fromState: DeterministicLabelRecordState;
  readonly toState: DeterministicLabelRecordState;
  readonly blockers: readonly SemanticCoordinateDiagnostic[];
  readonly evidence: DocumentMetadata;
}

export function computeDeterministicLabelReadiness(
  records: readonly DeterministicLabelRecord[],
): DeterministicLabelReadinessProjection {
  const computedRecords = records.map((record) =>
    computeDeterministicLabelRecordReadiness(record, records)
  );
  return {
    records: computedRecords,
    diagnostics: computedRecords.flatMap((record) =>
      record.diagnostics.filter((diagnostic) =>
        diagnostic.code === "deterministic-label-readiness-blocked"
      )
    ),
  };
}

export function computeDeterministicLabelRecordReadiness(
  record: DeterministicLabelRecord,
  records: readonly DeterministicLabelRecord[] = [record],
): DeterministicLabelRecord {
  const labels = new Set(records.map((item) => item.label));
  const terminalState = terminalStateForRecord(record);
  if (terminalState) {
    return withReadiness(record, terminalState, [], [{
      gate: "activate",
      fromState: terminalState,
      toState: terminalState,
      blockers: [],
      evidence: {
        terminal: true,
        reason: terminalState.toLowerCase(),
      },
    }]);
  }

  let state = record.currentState;
  const blockedDiagnostics: SemanticCoordinateDiagnostic[] = [];
  const gateResults: GateEvaluation[] = [];

  while (true) {
    const gate = nextGate(state);
    if (!gate) break;

    const evaluation = evaluateGate(record, labels, gate);
    gateResults.push(evaluation);
    if (evaluation.blockers.length > 0) {
      blockedDiagnostics.push(...blockedTransitionDiagnostics(record, evaluation));
      break;
    }
    state = evaluation.toState;
  }

  if (state === "ACTIVE") {
    const activeHealth = evaluateGate(record, labels, {
      gate: "activate",
      fromState: "RESOLVED",
      toState: "ACTIVE",
    });
    if (activeHealth.blockers.length > 0) {
      gateResults.push(activeHealth);
      blockedDiagnostics.push(...blockedTransitionDiagnostics(record, activeHealth));
    }
  }

  return withReadiness(record, state, blockedDiagnostics, gateResults);
}

export function dryRunDeterministicLabelTransition(
  request: DeterministicLabelTransitionRequest,
  records: readonly DeterministicLabelRecord[],
): DeterministicLabelTransitionDryRunResult {
  const evidenceRefs = normalizeEvidenceRefs(request.evidenceRefs);
  const target = records.find((record) => record.label === request.targetLabel);
  if (!target) {
    return transitionDryRunResult({
      request,
      evidenceRefs,
      currentState: null,
      nextState: null,
      decision: "rejected",
      blockers: [
        transitionBlocker(request.targetLabel, "target label is not projected.", {
          blockerCode: "target-label-missing",
          targetLabel: request.targetLabel,
        }),
      ],
      gateEvidence: [],
    });
  }

  const evaluationRecord = {
    ...target,
    evidenceRefs: normalizeEvidenceRefs([...target.evidenceRefs, ...evidenceRefs]),
  };
  const evaluationRecords = records.map((record) =>
    record.label === target.label ? evaluationRecord : record
  );
  const labels = new Set(evaluationRecords.map((record) => record.label));
  const requestBlockers = transitionRequestBlockers(request, target);
  const route = transitionRoute(target.currentState, request.requestedState);
  const routeBlockers = route
    ? []
    : [transitionBlocker(target.label, "requested transition route is not supported by the read-only FSM.", {
      blockerCode: "transition-route-unsupported",
      currentState: target.currentState,
      requestedState: request.requestedState,
    })];
  const gateResults: DeterministicLabelReadinessGateResult[] = [];
  const gateBlockers: SemanticCoordinateDiagnostic[] = [];

  if (route) {
    for (const transition of route) {
      const evaluation = evaluateGate(evaluationRecord, labels, transition);
      gateResults.push({
        gate: evaluation.gate,
        fromState: evaluation.fromState,
        toState: evaluation.toState,
        ready: evaluation.blockers.length === 0,
        blockers: evaluation.blockers,
        evidence: evaluation.evidence,
      });
      if (evaluation.blockers.length > 0) {
        gateBlockers.push(...blockedTransitionDiagnostics(evaluationRecord, evaluation));
        break;
      }
    }
  }

  const blockers = [
    ...requestBlockers,
    ...routeBlockers,
    ...gateBlockers,
  ];
  const decision: DeterministicLabelTransitionDecision =
    blockers.length === 0 ? "accepted" : "rejected";

  return transitionDryRunResult({
    request,
    evidenceRefs,
    currentState: target.currentState,
    nextState: decision === "accepted" ? request.requestedState : target.currentState,
    decision,
    blockers,
    gateEvidence: gateResults,
  });
}

function nextGate(
  state: DeterministicLabelRecordState,
): {
  readonly gate: DeterministicLabelReadinessGate;
  readonly fromState: DeterministicLabelRecordState;
  readonly toState: DeterministicLabelRecordState;
} | undefined {
  if (state === "DRAFT") {
    return { gate: "lint", fromState: "DRAFT", toState: "LINTED" };
  }
  if (state === "LINTED") {
    return { gate: "resolve", fromState: "LINTED", toState: "RESOLVED" };
  }
  if (state === "RESOLVED") {
    return { gate: "activate", fromState: "RESOLVED", toState: "ACTIVE" };
  }
  return undefined;
}

function transitionRoute(
  currentState: DeterministicLabelRecordState,
  requestedState: DeterministicLabelRecordState,
): readonly {
  readonly gate: DeterministicLabelReadinessGate;
  readonly fromState: DeterministicLabelRecordState;
  readonly toState: DeterministicLabelRecordState;
}[] | undefined {
  if (currentState === requestedState) return [];
  if (requestedState === "BLOCKED") return undefined;

  const route: Array<{
    readonly gate: DeterministicLabelReadinessGate;
    readonly fromState: DeterministicLabelRecordState;
    readonly toState: DeterministicLabelRecordState;
  }> = [];
  let state = currentState;
  while (state !== requestedState) {
    const transition = nextGate(state);
    if (!transition) return undefined;
    route.push(transition);
    state = transition.toState;
  }
  return route;
}

function evaluateGate(
  record: DeterministicLabelRecord,
  labels: ReadonlySet<string>,
  transition: {
    readonly gate: DeterministicLabelReadinessGate;
    readonly fromState: DeterministicLabelRecordState;
    readonly toState: DeterministicLabelRecordState;
  },
): GateEvaluation {
  if (transition.gate === "lint") {
    return {
      ...transition,
      blockers: lintBlockers(record),
      evidence: lintEvidence(record),
    };
  }
  if (transition.gate === "resolve") {
    return {
      ...transition,
      blockers: resolutionBlockers(record, labels),
      evidence: resolutionEvidence(record),
    };
  }
  return {
    ...transition,
    blockers: activationBlockers(record, labels),
    evidence: activationEvidence(record),
  };
}

function lintBlockers(
  record: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  const diagnostics = record.diagnostics.filter((diagnostic) =>
    diagnostic.severity === "error"
    && diagnostic.code !== "deterministic-label-readiness-blocked"
  );
  const metadataBlockers = validationFlagBlockers(record);
  return [...diagnostics, ...metadataBlockers];
}

function validationFlagBlockers(
  record: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  const validation = asRecord(record.metadata.validation)
    ?? asRecord(record.metadata.validationSignals)
    ?? {};
  const checks: Array<readonly [string, string, unknown]> = [
    ["syntax", "syntax validation failed", validation.syntax ?? record.metadata.syntaxValid],
    ["frontmatter", "frontmatter validation failed", validation.frontmatter ?? record.metadata.frontmatterValid],
    ["schema", "schema validation failed", validation.schema ?? record.metadata.schemaValid],
    ["doc-type", "doc-type validation failed", validation.docType ?? record.metadata.docTypeValid],
  ];

  return checks
    .filter(([, , value]) => value === false)
    .map(([check, message]) => syntheticBlocker(record, message, {
      blockerCode: `${check}-validation-failed`,
      check,
    }));
}

function resolutionBlockers(
  record: DeterministicLabelRecord,
  labels: ReadonlySet<string>,
): readonly SemanticCoordinateDiagnostic[] {
  return [
    ...missingRefBlockers(record, labels, "dependency", record.dependencyLabels),
    ...missingRefBlockers(record, labels, "source", record.sourceRefs),
    ...missingRefBlockers(record, labels, "evidence", record.evidenceRefs),
    ...packReadinessResolutionBlockers(record),
  ];
}

function missingRefBlockers(
  record: DeterministicLabelRecord,
  labels: ReadonlySet<string>,
  refKind: "dependency" | "source" | "evidence",
  refs: readonly string[],
): readonly SemanticCoordinateDiagnostic[] {
  return refs
    .filter((ref) => ref.startsWith("urn:") && !labels.has(ref))
    .map((ref) => syntheticBlocker(
      record,
      `${refKind} ref ${ref} does not resolve to a deterministic label record.`,
      {
        blockerCode: `${refKind}-ref-unresolved`,
        refKind,
        ref,
      },
    ));
}

function packReadinessResolutionBlockers(
  record: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  const readinessStatus = ontologyPackReadinessStatus(record);
  if (!readinessStatus) return [];

  const blockers: SemanticCoordinateDiagnostic[] = [];
  for (const key of ["docs", "sourceMap"] as const) {
    const status = asString(readinessStatus[key]);
    if (status === "missing") {
      blockers.push(syntheticBlocker(record, `ontology pack ${key} readiness is missing.`, {
        blockerCode: `ontology-pack-${key}-missing`,
        readiness: key,
        status,
      }));
    }
  }
  return blockers;
}

function activationBlockers(
  record: DeterministicLabelRecord,
  labels: ReadonlySet<string>,
): readonly SemanticCoordinateDiagnostic[] {
  return [
    ...driftBlockers(record),
    ...requiredEvidenceBlockers(record, labels),
    ...roleQualityBlockers(record),
    ...packRuntimeBlockers(record),
  ];
}

function driftBlockers(record: DeterministicLabelRecord): readonly SemanticCoordinateDiagnostic[] {
  const status = driftFreeStatus(record);
  if (status === true) return [];
  return [
    syntheticBlocker(record, status === false
      ? "drift-free status is false."
      : "drift-free status is not available.", {
      blockerCode: status === false ? "drift-detected" : "drift-status-missing",
    }),
  ];
}

function requiredEvidenceBlockers(
  record: DeterministicLabelRecord,
  labels: ReadonlySet<string>,
): readonly SemanticCoordinateDiagnostic[] {
  const requiredEvidence = requiredEvidenceRefs(record);
  if (requiredEvidence === false) return [];

  if (requiredEvidence === true) {
    if (record.evidenceRefs.length > 0) return [];
    return [
      syntheticBlocker(record, "required evidence is missing.", {
        blockerCode: "required-evidence-missing",
      }),
    ];
  }

  const missing = requiredEvidence.filter((ref) =>
    !record.evidenceRefs.includes(ref) || (ref.startsWith("urn:") && !labels.has(ref))
  );
  return missing.map((ref) =>
    syntheticBlocker(record, `required evidence ref ${ref} is missing.`, {
      blockerCode: "required-evidence-ref-missing",
      ref,
    })
  );
}

function roleQualityBlockers(
  record: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  const status = roleQualityStatus(record);
  if (status !== "blocked") return [];
  return [
    syntheticBlocker(record, "role quality status is blocked.", {
      blockerCode: "role-quality-blocked",
      roleQualityStatus: status,
    }),
  ];
}

function packRuntimeBlockers(
  record: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  if (record.kind !== "ontology-pack") return [];
  const runtime = asRecord(asRecord(record.metadata.ontologyPackValidate)?.runtime);
  if (runtime?.valid === true) return [];
  return [
    syntheticBlocker(record, "ontology pack runtime validation is not valid.", {
      blockerCode: "ontology-pack-runtime-invalid",
      runtimeValid: runtime?.valid,
    }),
  ];
}

function lintEvidence(record: DeterministicLabelRecord): DocumentMetadata {
  return {
    diagnostics: record.diagnostics.length,
    errorDiagnostics: record.diagnostics.filter((diagnostic) =>
      diagnostic.severity === "error"
      && diagnostic.code !== "deterministic-label-readiness-blocked"
    ).length,
    validationSignals: {
      syntax: readValidationFlag(record, "syntax"),
      frontmatter: readValidationFlag(record, "frontmatter"),
      schema: readValidationFlag(record, "schema"),
      docType: readValidationFlag(record, "docType"),
    },
  };
}

function resolutionEvidence(record: DeterministicLabelRecord): DocumentMetadata {
  const readinessStatus = ontologyPackReadinessStatus(record);
  return {
    dependencyRefs: record.dependencyLabels.length,
    sourceRefs: record.sourceRefs.length,
    evidenceRefs: record.evidenceRefs.length,
    ...(readinessStatus ? { ontologyPackReadinessStatus: readinessStatus } : {}),
  };
}

function activationEvidence(record: DeterministicLabelRecord): DocumentMetadata {
  return {
    driftFree: driftFreeStatus(record),
    requiredEvidence: requiredEvidenceRefs(record),
    evidenceRefs: record.evidenceRefs.length,
    roleQualityStatus: roleQualityStatus(record),
    ...(record.kind === "ontology-pack"
      ? {
        ontologyPackRuntime: asRecord(
          asRecord(record.metadata.ontologyPackValidate)?.runtime,
        ) ?? null,
      }
      : {}),
  };
}

function blockedTransitionDiagnostics(
  record: DeterministicLabelRecord,
  evaluation: GateEvaluation,
): readonly SemanticCoordinateDiagnostic[] {
  return evaluation.blockers.map((blocker) => ({
    code: "deterministic-label-readiness-blocked",
    severity: "error",
    label: record.label,
    id: record.candidate.id,
    message: `${evaluation.fromState} -> ${evaluation.toState} readiness is blocked for ${record.label}: ${blocker.message}`,
    metadata: {
      gate: evaluation.gate,
      fromState: evaluation.fromState,
      toState: evaluation.toState,
      blockerCode: blocker.code,
      blockerMessage: blocker.message,
      blockerMetadata: blocker.metadata,
    },
  }));
}

function syntheticBlocker(
  record: DeterministicLabelRecord,
  message: string,
  metadata: DocumentMetadata,
): SemanticCoordinateDiagnostic {
  return {
    code: "deterministic-label-readiness-blocked",
    severity: "error",
    label: record.label,
    id: record.candidate.id,
    message,
    metadata,
  };
}

function withReadiness(
  record: DeterministicLabelRecord,
  currentState: DeterministicLabelRecordState,
  diagnostics: readonly SemanticCoordinateDiagnostic[],
  gates: readonly GateEvaluation[],
): DeterministicLabelRecord {
  return {
    ...record,
    currentState,
    diagnostics: dedupeDiagnostics([...record.diagnostics, ...diagnostics]),
    metadata: {
      ...record.metadata,
      deterministicLabelReadiness: {
        computedState: currentState,
        blocked: diagnostics.length > 0,
        gates: gates.map((gate): DeterministicLabelReadinessGateResult => ({
          gate: gate.gate,
          fromState: gate.fromState,
          toState: gate.toState,
          ready: gate.blockers.length === 0,
          blockers: gate.blockers,
          evidence: gate.evidence,
        })),
      },
    },
  };
}

function transitionDryRunResult(input: {
  readonly request: DeterministicLabelTransitionRequest;
  readonly evidenceRefs: readonly string[];
  readonly currentState: DeterministicLabelRecordState | null;
  readonly nextState: DeterministicLabelRecordState | null;
  readonly decision: DeterministicLabelTransitionDecision;
  readonly blockers: readonly SemanticCoordinateDiagnostic[];
  readonly gateEvidence: readonly DeterministicLabelReadinessGateResult[];
}): DeterministicLabelTransitionDryRunResult {
  const accepted = input.decision === "accepted";
  const eventCandidate: DeterministicLabelTransitionDryRunEventCandidate = {
    schemaId: DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE.schemaId,
    schemaVersion: DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE.version,
    targetLabel: input.request.targetLabel,
    requestedState: input.request.requestedState,
    currentState: input.currentState,
    nextState: input.nextState,
    decision: input.decision,
    reason: input.request.reason,
    evidenceRefs: input.evidenceRefs,
    blockerCount: input.blockers.length,
  };

  return {
    mode: "dry-run",
    targetLabel: input.request.targetLabel,
    requestedState: input.request.requestedState,
    accepted,
    decision: input.decision,
    currentState: input.currentState,
    nextState: input.nextState,
    blockers: input.blockers,
    gateEvidence: input.gateEvidence,
    evidenceRefs: input.evidenceRefs,
    metadata: {
      ...(input.request.metadata ?? {}),
      dryRun: true,
      readOnly: true,
      writes: false,
      mutationTargets: {
        labels: false,
        documents: false,
        prds: false,
        registries: false,
      },
      appendOnlyTransitionEventSchema:
        DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE,
      appendOnlyTransitionEventCandidate: eventCandidate,
    },
  };
}

function transitionRequestBlockers(
  request: DeterministicLabelTransitionRequest,
  target: DeterministicLabelRecord,
): readonly SemanticCoordinateDiagnostic[] {
  const blockers: SemanticCoordinateDiagnostic[] = [];
  if (!asString(request.reason)) {
    blockers.push(transitionBlocker(target.label, "transition reason is required.", {
      blockerCode: "transition-reason-missing",
      requestedState: request.requestedState,
    }));
  }
  return blockers;
}

function transitionBlocker(
  label: string,
  message: string,
  metadata: DocumentMetadata,
): SemanticCoordinateDiagnostic {
  return {
    code: "deterministic-label-transition-blocked",
    severity: "error",
    label,
    message,
    metadata,
  };
}

function normalizeEvidenceRefs(refs: readonly string[]): readonly string[] {
  return [...new Set(refs.map(asString).filter((ref): ref is string => ref !== undefined))]
    .toSorted((left, right) => left.localeCompare(right));
}

function terminalStateForRecord(
  record: DeterministicLabelRecord,
): DeterministicLabelRecordState | undefined {
  if (record.currentState === "ARCHIVED" || isArchivedRecord(record)) return "ARCHIVED";
  if (record.currentState === "DEPRECATED" || isDeprecatedRecord(record)) return "DEPRECATED";
  if (record.currentState === "BLOCKED") return "BLOCKED";
  return undefined;
}

function isArchivedRecord(record: DeterministicLabelRecord): boolean {
  const completedRecord = asRecord(record.metadata.completedRecord);
  return record.metadata.archiveScope === true
    || record.metadata.lifecycle === "archived"
    || completedRecord?.lifecycle === "archived";
}

function isDeprecatedRecord(record: DeterministicLabelRecord): boolean {
  return record.metadata.deprecated === true
    || record.metadata.lifecycle === "deprecated"
    || asString(record.metadata.lifecycle) === "deprecated";
}

function driftFreeStatus(record: DeterministicLabelRecord): boolean | undefined {
  if (typeof record.metadata.driftFree === "boolean") return record.metadata.driftFree;
  const drift = asRecord(record.metadata.drift);
  if (!drift) return undefined;
  if (typeof drift.free === "boolean") return drift.free;
  if (typeof drift.driftFree === "boolean") return drift.driftFree;
  const counts = asRecord(drift.counts);
  if (!counts) return undefined;
  const errors = asNumber(counts.error) ?? 0;
  const warnings = asNumber(counts.warning) ?? 0;
  return errors === 0 && warnings === 0;
}

function requiredEvidenceRefs(
  record: DeterministicLabelRecord,
): boolean | readonly string[] {
  const explicit = stringArray(record.metadata.requiredEvidenceRefs);
  if (explicit.length > 0) return explicit;
  if (record.metadata.requiresEvidence === true || record.metadata.requiredEvidence === true) {
    return true;
  }
  return false;
}

function roleQualityStatus(record: DeterministicLabelRecord): "ready" | "placeholder" | "blocked" {
  const direct = asString(record.metadata.roleQualityStatus);
  if (direct === "ready" || direct === "placeholder" || direct === "blocked") return direct;
  const roleQuality = asRecord(record.metadata.roleQuality);
  const nested = asString(roleQuality?.status);
  if (nested === "ready" || nested === "placeholder" || nested === "blocked") return nested;
  return "placeholder";
}

function ontologyPackReadinessStatus(
  record: DeterministicLabelRecord,
): Record<string, unknown> | undefined {
  return asRecord(asRecord(record.metadata.ontologyPackValidate)?.readinessStatus);
}

function readValidationFlag(
  record: DeterministicLabelRecord,
  key: "syntax" | "frontmatter" | "schema" | "docType",
): unknown {
  const validation = asRecord(record.metadata.validation)
    ?? asRecord(record.metadata.validationSignals)
    ?? {};
  const directKeys = {
    syntax: "syntaxValid",
    frontmatter: "frontmatterValid",
    schema: "schemaValid",
    docType: "docTypeValid",
  } as const;
  return validation[key] ?? record.metadata[directKeys[key]];
}

function dedupeDiagnostics(
  diagnostics: readonly SemanticCoordinateDiagnostic[],
): readonly SemanticCoordinateDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify({
      code: diagnostic.code,
      label: diagnostic.label,
      id: diagnostic.id,
      message: diagnostic.message,
      metadata: diagnostic.metadata,
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value
      .map((item) => asString(item))
      .filter((item): item is string => item !== undefined)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
