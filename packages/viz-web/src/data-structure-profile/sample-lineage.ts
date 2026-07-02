import type {
  CompiledLineage,
  MeasurementReport,
  ValidationReport,
} from "data-structure-profile";
import expectedLineage from "../../../../docs/proposals/data-structure-profile/fixtures/expected-lineage.json";
import expectedMeasurement from "../../../../docs/proposals/data-structure-profile/fixtures/expected-measurement-report.json";
import expectedValidation from "../../../../docs/proposals/data-structure-profile/fixtures/expected-validation-report.json";
import expectedCustomerLineage from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-lineage.json";
import expectedCustomerMeasurement from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-measurement-report.json";
import expectedCustomerValidation from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-validation-report.json";

export type DataStructureProfileExample = {
  name: string;
  desc: string;
  lineage: CompiledLineage;
  validation: ValidationReport;
  measurement: MeasurementReport;
};

const orderLineage = expectedLineage as CompiledLineage;
const measurement = expectedMeasurement as MeasurementReport;
const privacyWarningValidation = expectedValidation as ValidationReport;
const customerOrdersLineage = expectedCustomerLineage as CompiledLineage;
const customerOrdersMeasurement = expectedCustomerMeasurement as MeasurementReport;
const customerOrdersValidation = expectedCustomerValidation as ValidationReport;

const transformFailureLineage: CompiledLineage = {
  ...orderLineage,
  diagnosticTargets: {
    ...orderLineage.diagnosticTargets,
    "dsp-transform-array-threshold-exceeded": "transforms.explode-items.semantics.max_array_length",
  },
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
    lineage: transformFailureLineage,
    validation: transformFailureValidation,
    measurement: {
      ...measurement,
      thresholds: { maxRowMultiplier: 3 },
      warnings: ["rowMultiplier exceeds maxRowMultiplier"],
    },
  },
  {
    name: "Customer orders",
    desc: "Relational join to pseudonymized analytics",
    lineage: customerOrdersLineage,
    validation: customerOrdersValidation,
    measurement: customerOrdersMeasurement,
  },
];
