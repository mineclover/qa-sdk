/**
 * transition — Transition Spec DSL sub-path barrel.
 *
 * raw coordinate 위에 state semantics를 덧씌우는 해석 계층.
 * 상태는 DEMO_CATALOG 축(axis)으로 표현한다.
 */

// ── Types ────────────────────────────────────────────────
export type {
  EffectKind,
  MatchMode,
  CoordinatePattern,
  MatchPattern,
  BindDef,
  StateCondition,
  InputCondition,
  StateAssignment,
  OutputMutation,
  EffectDef,
  TransitionSpec,
  TransitionInstance,
  ValidationIssue,
  ValidationResult,
} from "./transition.types.js";

export { EFFECT_KINDS } from "./transition.types.js";

// ── Schema Validation ────────────────────────────────────
export { validateTransitionSpec } from "./transition.schema.js";

// ── Catalog Validation ───────────────────────────────────
export { validateWithCatalog } from "./catalog-validator.js";

// ── Registry ─────────────────────────────────────────────
export { TransitionRegistry } from "./transition.registry.js";

// ── Match Adapter ────────────────────────────────────────
export {
  deriveEventKey,
  coordToConstraints,
  transitionMatchToScenarioSteps,
} from "./match-adapter.js";

// ── State Store ──────────────────────────────────────────
export type { StateStore } from "./state-store.js";
export { InMemoryStateStore } from "./state-store.js";
export { SqliteStateStore } from "./sqlite-state-store.js";
export type { AsyncStateStore } from "./sqlite-state-store.js";

// ── Bind Extractor ───────────────────────────────────────
export { extractBind } from "./bind-extractor.js";
export type { BindResult, BindError } from "./bind-extractor.js";

// ── Input Validator ──────────────────────────────────────
export { validateInput } from "./input-validator.js";
export type { InputViolation, InputValidationResult } from "./input-validator.js";

// ── Output Applier ───────────────────────────────────────
export { applyOutput } from "./output-applier.js";

// ── Engine ───────────────────────────────────────────────
export { TransitionEngine } from "./transition-engine.js";
export type { TransitionResult, TransitionEvent } from "./transition-engine.js";

// ── DKG Bridge ───────────────────────────────────────
export { toTransitionSpecNode, toTransitionSpecNodes, deriveInterSpecEdges, deriveDslSatisfiesEdges } from "./dkg-bridge.js";

// ── Violation Bridge ─────────────────────────────────
export { violationsToObservations } from "./violation-bridge.js";

// ── Transition Pipeline ──────────────────────────────
export type { TransitionFunctions, TransitionSessionInput, TransitionSessionResult, TransitionFlushResult } from "./transition-pipeline.js";
export { createTransitionFunctions } from "./transition-pipeline.js";

// ── Demo Specs ───────────────────────────────────────────
export {
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  DEMO_TRANSITION_SPECS,
} from "./demo-transition-specs.js";
