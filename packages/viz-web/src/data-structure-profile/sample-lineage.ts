import type {
  CompiledLineage,
  MeasurementReport,
  ValidationReport,
} from "data-structure-profile";

export type DataStructureProfileExample = {
  name: string;
  desc: string;
  lineage: CompiledLineage;
  validation: ValidationReport;
  measurement: MeasurementReport;
};

const orderLineage: CompiledLineage = {
  kind: "data-structure-profile.compiled.v1",
  profile: "order-events-to-order-item-facts",
  taxonomyRef: "data-structure-profile@draft",
  lineage: {
    nodes: [
      {
        id: "commerce-orders-topic",
        kind: "source",
        label: "commerce.orders.v1",
        taxonomyRef: "data-source-kind:kafka",
      },
      {
        id: "order-event",
        kind: "event",
        label: "Order event",
        taxonomyRef: "structure-kind:event",
      },
      {
        id: "item-array",
        kind: "array",
        label: "$.items[*]",
        taxonomyRef: "structure-kind:array",
      },
      {
        id: "explode-items",
        kind: "transform",
        label: "explode items",
        taxonomyRef: "transform-kind:explode",
      },
      {
        id: "project-order-item-fields",
        kind: "transform",
        label: "project order item fields",
        taxonomyRef: "transform-kind:project",
      },
      {
        id: "order-item-fact",
        kind: "fact",
        label: "analytics.fact_order_items",
        taxonomyRef: "structure-kind:fact",
      },
    ],
    edges: [
      { from: "commerce-orders-topic", to: "order-event", kind: "emits" },
      { from: "order-event", to: "item-array", kind: "contains" },
      { from: "item-array", to: "explode-items", kind: "input" },
      { from: "explode-items", to: "project-order-item-fields", kind: "feeds" },
      { from: "project-order-item-fields", to: "order-item-fact", kind: "produces" },
    ],
  },
  diagnosticTargets: {
    "event-id-dedup-required": "source.event_id_path",
    "replay-policy-required": "source.replay_policy",
    "schema-drift-watch": "source.schema_ref",
    "array-explosion-budget": "transforms.explode-items.semantics.max_array_length",
    "dsp-privacy-dpm-ref-missing": "privacy.dpm_policy_ref",
    "dsp-transform-array-threshold-exceeded": "transforms.explode-items.semantics.max_array_length",
  },
};

const measurement: MeasurementReport = {
  kind: "data-structure-profile.measurement-report.v1",
  profile: "order-events-to-order-item-facts",
  inputs: {
    expectedEventRatePerSec: 1000,
    averagePayloadBytes: 2048,
    averageArrayLength: 5,
    maxArrayLength: 200,
    estimatedFactRowBytes: 256,
  },
  estimates: {
    rowMultiplier: 5,
    estimatedFactRowsPerSec: 5000,
    estimatedOutputBytesPerSec: 1280000,
    estimatedDailyFactRows: 432000000,
  },
  thresholds: { maxRowMultiplier: 50 },
  warnings: [],
};

const privacyWarningValidation: ValidationReport = {
  kind: "data-structure-profile.validation-report.v1",
  profile: "order-events-to-order-item-facts",
  status: "needs-review",
  summary: { errors: 0, warnings: 1, infos: 0 },
  checkedGates: [
    {
      id: "event-id-dedup-required",
      risk: "dedup",
      severity: "error",
      result: "pass",
      evidence: "$.event_id",
    },
    {
      id: "replay-policy-required",
      risk: "replay",
      severity: "error",
      result: "pass",
      evidence: "source.replay_policy",
    },
    {
      id: "schema-drift-watch",
      risk: "schema-drift",
      severity: "warning",
      result: "pass",
      evidence: "./order-event.schema.json",
    },
    {
      id: "array-explosion-budget",
      risk: "array-explosion",
      severity: "error",
      result: "pass",
      evidence: "max_array_length=200",
    },
    {
      id: "privacy-readiness",
      risk: "pii-leak",
      severity: "warning",
      result: "warn",
      evidence: "privacy.dpm_policy_ref",
    },
  ],
  diagnostics: [
    {
      code: "dsp-privacy-dpm-ref-missing",
      severity: "warning",
      target: "privacy.dpm_policy_ref",
      message: "Sensitive paths exist but no DPM policy reference is declared.",
    },
  ],
};

const transformFailureValidation: ValidationReport = {
  ...privacyWarningValidation,
  status: "fail",
  summary: { errors: 1, warnings: 1, infos: 0 },
  checkedGates: privacyWarningValidation.checkedGates.map((gate) => (
    gate.id === "array-explosion-budget"
      ? {
          ...gate,
          result: "fail" as const,
          evidence: "transforms.explode-items.semantics.max_array_length",
        }
      : gate
  )),
  diagnostics: [
    ...privacyWarningValidation.diagnostics,
    {
      code: "dsp-transform-array-threshold-exceeded",
      severity: "error",
      target: "transforms.explode-items.semantics.max_array_length",
      message: "Explode transform max_array_length=200 exceeds threshold=50.",
    },
  ],
};

export const DATA_STRUCTURE_PROFILE_EXAMPLES: DataStructureProfileExample[] = [
  {
    name: "Order fixture",
    desc: "Kafka event to fact lineage with DPM warning",
    lineage: orderLineage,
    validation: privacyWarningValidation,
    measurement,
  },
  {
    name: "Array budget failure",
    desc: "Transform-level explosion diagnostic",
    lineage: orderLineage,
    validation: transformFailureValidation,
    measurement: {
      ...measurement,
      thresholds: { maxRowMultiplier: 3 },
      warnings: ["rowMultiplier exceeds maxRowMultiplier"],
    },
  },
];
