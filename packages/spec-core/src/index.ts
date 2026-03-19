// ── Export Surface ───────────────────────────────────
export type { ExportSurface } from "./export-surface/export-surface.types.js";
export { ExportSurfaceRegistry } from "./export-surface/export-surface.registry.js";

// ── Schema (Layer 2) ────────────────────────────────
export type {
  SchemaCategory,
  SchemaValueType,
  SchemaAxis,
  SchemaDef,
  SchemaFragment,
  SchemaConstraint,
} from "./schema/schema.types.js";
export { SchemaRegistry } from "./schema/schema.registry.js";
export { SchemaValidator } from "./schema/schema.validator.js";
export {
  registerPresets,
  DEFAULT_SCHEMAS,
  DEFAULT_FRAGMENTS,
  SCHEMA_EVENT_BASE,
  SCHEMA_ENTITY_BASE,
  SCHEMA_RELATION_BASE,
  SCHEMA_STATE_BASE,
  SCHEMA_POLICY_BASE,
  SCHEMA_OBSERVATION_BASE,
  FRAGMENT_HAS_ACTOR,
  FRAGMENT_HAS_TARGET,
  FRAGMENT_HAS_OUTCOME,
  FRAGMENT_IDENTIFIED,
} from "./schema/presets.js";
export type { ValidationResult } from "./schema/schema.validator.js";

// ── Spec Document ───────────────────────────────────
export type {
  SpecType,
  SpecId,
  SpecLifecycle,
  SpecRelation,
  SpecDocument,
} from "./spec/spec.types.js";
export { SpecDocumentRegistry } from "./spec/spec-document.registry.js";

// ── PrefixSpec ──────────────────────────────────────
export type { DimRef, PrefixSpec } from "./spec/prefix-spec.types.js";

// ── Loader ──────────────────────────────────────────
export { catalogToPrefixSpecs, prefixToPrefixSpec } from "./loader/catalog-bridge.js";
export type { CatalogInput, CatalogPrefix } from "./loader/catalog-bridge.js";
export { loadSpecs, parseSpecFile } from "./loader/spec-loader.js";
export type { LoadResult, LoadError, ParseResult } from "./loader/spec-loader.js";

// ── Codegen IR ──────────────────────────────────────
export type { IRModule, IREnum, IREnumValue, IRStruct, IRField } from "./codegen/ir.js";
export { buildIR } from "./codegen/ir-builder.js";
export type { BuildIROptions } from "./codegen/ir-builder.js";

// ── Codegen TypeScript ──────────────────────────────
export {
  generateAxisType,
  generateExportInterface,
  generateTypescriptFile,
  generateFromIR,
} from "./codegen/ts-generator.js";
export type { AxisInput, GenerateOptions } from "./codegen/ts-generator.js";

// ── Codegen JavaScript ──────────────────────────────
export { generateJSFromIR, generateCJSFromIR } from "./codegen/js-generator.js";
export type { JSFormat } from "./codegen/js-generator.js";

// ── Codegen Protobuf ────────────────────────────────
export { generateProtoFromIR } from "./codegen/proto-generator.js";
export type { ProtoOptions } from "./codegen/proto-generator.js";

// ── Codegen JSON Schema ─────────────────────────────
export { generateJsonSchemaFromIR } from "./codegen/json-schema-generator.js";

// ── Shared ──────────────────────────────────────────
export { ok, err } from "./shared/result.js";
export type { Result } from "./shared/result.js";
export {
  SpecError,
  DuplicateRegistrationError,
  NotFoundError,
  ValidationError,
} from "./shared/errors.js";
export type { ValidationErrorDetail } from "./shared/errors.js";
