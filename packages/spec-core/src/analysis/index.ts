/**
 * analysis — deprecated barrel.
 *
 * @deprecated `"@qa-sdk/spec-core/dkg"` 와 `"@qa-sdk/spec-core/convergence"` 를 사용할 것.
 * 이 모듈은 하위 호환을 위해 유지된다.
 */

// ── DKG ────────────────────────────────────────────
export * from "../dkg/index.js";

// ── Convergence ────────────────────────────────────
export * from "../convergence/index.js";

// ── Schema: Prefix Consumer (analysis에서 제공하던 것) ──
export { mapErrorToCoordinate, mapValidationToCoordinates, decodeCoordinate, AXIS_ENTRIES } from "../schema/schema-validation-codec.js";
export type { ValidationCoordinate } from "../schema/schema-validation-codec.js";
export { bridgeValidationToObservation } from "../schema/schema-observation-bridge.js";
export type { SchemaObservationResult } from "../schema/schema-observation-bridge.js";
export { auditSchemaHealth } from "../schema/schema-health-audit.js";
export type { SchemaHealthReport, SchemaViolationEntry } from "../schema/schema-health-audit.js";
