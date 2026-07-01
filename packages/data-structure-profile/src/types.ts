export type DiagnosticSeverity = "error" | "warning" | "info";

export type ProfileDiagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  target: string;
  message: string;
};

export type DataStructureProfile = {
  kind?: string;
  profile: string;
  version: number;
  taxonomy_ref?: string;
  description?: string;
  source: ProfileSource;
  structures: ProfileStructure[];
  relationships: ProfileRelationship[];
  transforms: ProfileTransform[];
  measurements: ProfileMeasurements;
  quality_gates: QualityGate[];
  privacy?: PrivacyReadinessConfig;
  outputs?: Record<string, string>;
};

export type ProfileSource = {
  id: string;
  kind: string;
  ref: string;
  payload_format?: string;
  schema_ref?: string;
  sample_ref?: string;
  event_id_path?: string;
  event_time_path?: string;
  partition_key_path?: string;
  replay_policy?: Record<string, unknown>;
};

export type ProfileStructure = {
  id: string;
  kind: string;
  source_path?: string;
  target_ref?: string;
  parent?: string;
  lifecycle?: string;
  sensitivity?: string;
  grain?: string;
};

export type ProfileRelationship = {
  id: string;
  kind: string;
  from: string;
  to: string;
};

export type ProfileTransform = {
  id: string;
  kind: string;
  from: string;
  to: string;
  source_path?: string;
  semantics?: TransformSemantics;
  mappings?: Record<string, string>;
};

export type TransformSemantics = {
  empty_array?: string;
  output_grain?: string;
  max_array_length?: number;
  dedup_key_paths?: string[];
  [key: string]: unknown;
};

export type ProfileMeasurements = {
  expected_event_rate_per_sec?: number;
  average_payload_bytes?: number;
  average_array_length?: number;
  max_array_length?: number;
  estimated_fact_row_bytes?: number;
};

export type QualityGate = {
  id: string;
  risk: string;
  severity: DiagnosticSeverity;
  evidence?: {
    path?: string;
    expectation?: string;
  };
  threshold?: {
    max_array_length?: number;
    max_row_multiplier?: number;
  };
};

export type SensitivePath = {
  path: string;
  role: string;
};

export type PrivacyReadinessConfig = {
  mode?: string;
  dpm_policy_ref?: string | null;
  required?: boolean;
  sensitive_paths?: Array<string | SensitivePath>;
};

export type ValidationReport = {
  kind: "data-structure-profile.validation-report.v1";
  profile: string;
  status: "pass" | "needs-review" | "fail";
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  checkedGates: CheckedGate[];
  diagnostics: ProfileDiagnostic[];
};

export type TaxonomyVocabulary = {
  taxonomy: string;
  version: number;
  axes: ReadonlyMap<string, ReadonlySet<string>>;
};

export type ValidateProfileOptions = {
  taxonomy?: TaxonomyVocabulary;
};

export type CheckedGate = {
  id: string;
  risk: string;
  severity: DiagnosticSeverity;
  result: "pass" | "warn" | "fail";
  evidence: string;
};

export type CompiledLineage = {
  kind: "data-structure-profile.compiled.v1";
  profile: string;
  taxonomyRef: string;
  lineage: {
    nodes: LineageNode[];
    edges: LineageEdge[];
  };
  diagnosticTargets: Record<string, string>;
};

export type LineageNode = {
  id: string;
  kind: string;
  label: string;
  taxonomyRef: string;
};

export type LineageEdge = {
  from: string;
  to: string;
  kind: string;
};

export type MeasurementReport = {
  kind: "data-structure-profile.measurement-report.v1";
  profile: string;
  inputs: {
    expectedEventRatePerSec: number;
    averagePayloadBytes: number;
    averageArrayLength: number;
    maxArrayLength: number;
    estimatedFactRowBytes: number;
  };
  estimates: {
    rowMultiplier: number;
    estimatedFactRowsPerSec: number;
    estimatedOutputBytesPerSec: number;
    estimatedDailyFactRows: number;
  };
  thresholds: {
    maxRowMultiplier: number;
  };
  warnings: string[];
};

export type DpmReadinessReport = {
  kind: "data-structure-profile.dpm-readiness.v1";
  profile: string;
  required: boolean;
  policyRef: string | null;
  sensitivePaths: SensitivePath[];
  diagnostics: ProfileDiagnostic[];
};

export type QualityLedgerRunInput = {
  gateDocId: string;
  docVersion: number;
  bundleId: string;
  command: string;
  outcome: "pass" | "fail";
  exitCode: number;
  notes: string;
  successPattern: string;
  successPatternMatched: boolean;
  failureClass?: "static-check-failure";
};

export type QualityLedgerAdapterOptions = {
  docVersion?: number;
  bundleId?: string;
  command?: string;
  warnAsPass?: boolean;
};

export type DistributionSummary = {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

export type BenchCompatibleRunSummary = {
  scenarioId: string;
  scenarioName: string;
  concurrency: number;
  warmupIterations: number;
  measuredIterations: number;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  scenarioLatencyMs: DistributionSummary;
  scenarioRate: number;
  counters: {
    sessionsStarted: number;
    eventsEmitted: number;
    metricsEmitted: number;
    flushCalls: number;
  };
  transport: {
    envelopesSent: number;
    recordsSent: number;
    failedSends: number;
    bytesSent: number;
    sendLatencyMs: DistributionSummary;
  };
};

export type BenchReportInput = {
  title: string;
  metadata: Record<string, string | number | boolean | undefined>;
  summary: BenchCompatibleRunSummary;
};

export type BenchReportAdapterOptions = {
  startedAt?: string;
  completedAt?: string;
};
