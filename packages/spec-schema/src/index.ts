// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * spec-schema — Layer 2 스키마 시스템.
 *
 * 6종 카테고리(entity/event/relation/state/policy/observation),
 * 검증(Layer 0~2), 프리셋, 카테고리 규칙, 좌표 코덱.
 *
 * GraphPort/SpecError 등 공유 인터페이스도 이 패키지가 canonical 소유.
 */

// ── Shared (GraphPort, Errors, Result) ─────────────
export type { GraphPort, GraphNodeLike, GraphEdgeLike, PrefixLike } from "./shared/graph-port.js";
export {
  SpecError,
  DuplicateRegistrationError,
  NotFoundError,
  ValidationError,
} from "./shared/errors.js";
export type { ValidationErrorDetail } from "./shared/errors.js";
export { ok, err } from "./shared/result.js";
export type { Result } from "./shared/result.js";

// ── Schema Types ───────────────────────────────────
export type {
  SchemaCategory,
  SchemaValueType,
  SchemaAxis,
  SchemaDef,
  SchemaFragment,
  SchemaConstraint,
} from "./schema.types.js";

// ── Snapshot Types ─────────────────────────────────
export type {
  SchemaSnapshot,
  Axis,
  Composite,
  SnapshotSupply,
} from "./snapshot-types.js";

// ── Registry ───────────────────────────────────────
export { SchemaRegistry } from "./schema.registry.js";

// ── Validator ──────────────────────────────────────
export { SchemaValidator } from "./schema.validator.js";
export type { ValidationResult } from "./schema.validator.js";

// ── Category Rules ─────────────────────────────────
export { CATEGORY_RULES, validatePrefixCategory, validateAllCategories } from "./category-rules.js";
export type { CategoryRule, CategoryValidationResult } from "./category-rules.js";

// ── Presets ────────────────────────────────────────
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
} from "./presets.js";

// ── Validation Codec ───────────────────────────────
export {
  mapErrorToCoordinate,
  mapValidationToCoordinates,
  decodeCoordinate,
  AXIS_ENTRIES,
} from "./schema-validation-codec.js";
export type { ValidationCoordinate } from "./schema-validation-codec.js";
