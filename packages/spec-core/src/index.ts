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
export type { GraphPort, GraphNodeLike, PrefixLike } from "./shared/graph-port.js";

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
export { CATEGORY_RULES, validatePrefixCategory, validateAllCategories } from "./schema/category-rules.js";
export type { CategoryRule, CategoryValidationResult } from "./schema/category-rules.js";
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
export { mergeCatalogs, extractServiceCatalog } from "./loader/catalog-merge.js";
export type { PartialCatalog, MergeResult, MergeConflict } from "./loader/catalog-merge.js";
export type { LoadResult, LoadError, ParseResult } from "./loader/spec-loader.js";
