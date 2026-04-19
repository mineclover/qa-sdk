// @def.boundary spec-engine-system
// @def.doc spec-engine-system

// ── Shared (from spec-schema) ──────────────────────
export { ok, err } from "spec-schema";
export type { Result } from "spec-schema";
export {
  SpecError,
  DuplicateRegistrationError,
  NotFoundError,
  ValidationError,
} from "spec-schema";
export type { ValidationErrorDetail } from "spec-schema";
export type { GraphPort, GraphNodeLike, GraphEdgeLike, PrefixLike } from "spec-schema";

// ── Export Surface ───────────────────────────────────
export type { ExportSurface } from "./export-surface/export-surface.types.js";
export { ExportSurfaceRegistry } from "./export-surface/export-surface.registry.js";

// ── Schema (from spec-schema) ──────────────────────
export type {
  SchemaCategory,
  SchemaValueType,
  SchemaAxis,
  SchemaDef,
  SchemaFragment,
  SchemaConstraint,
} from "spec-schema";
export { SchemaRegistry } from "spec-schema";
export { CATEGORY_RULES, validatePrefixCategory, validateAllCategories } from "spec-schema";
export type { CategoryRule, CategoryValidationResult } from "spec-schema";
export { SchemaValidator } from "spec-schema";
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
} from "spec-schema";
export type { ValidationResult } from "spec-schema";

// ── Schema: Validation Codec (from spec-schema) ────
export {
  mapErrorToCoordinate,
  mapValidationToCoordinates,
  decodeCoordinate,
  AXIS_ENTRIES,
} from "spec-schema";
export type { ValidationCoordinate } from "spec-schema";

// ── Schema: Bridges (from dkg) ─────────────────────
export { bridgeValidationToObservation } from "dkg";
export type { SchemaObservationResult } from "dkg";
export { auditSchemaHealth } from "dkg";
export type { SchemaHealthReport, SchemaViolationEntry } from "dkg";

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
export { catalogToPrefixSpecs, prefixToPrefixSpec, catalogToSchemaSnapshot } from "./loader/catalog-bridge.js";
export type { CatalogInput, CatalogPrefix, SchemaSnapshotOutput, FullCatalogInput } from "./loader/catalog-bridge.js";
export { loadSpecs, parseSpecFile } from "./loader/spec-loader.js";
export { mergeCatalogs, extractServiceCatalog } from "./loader/catalog-merge.js";
export type { PartialCatalog, MergeResult, MergeConflict } from "./loader/catalog-merge.js";
export type { LoadResult, LoadError, ParseResult } from "./loader/spec-loader.js";
