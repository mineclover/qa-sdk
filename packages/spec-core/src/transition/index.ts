// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * transition — Transition Spec DSL sub-path barrel.
 *
 * raw coordinate 위에 state semantics를 덧씌우는 해석 계층.
 * 상태는 DEMO_CATALOG 축(axis)으로 표현한다.
 */

// ── 순수 transition (from spec-transition) ──────────────
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
} from "spec-transition";

export { EFFECT_KINDS } from "spec-transition";

// ── Schema Validation ────────────────────────────────────
export { validateTransitionSpec } from "spec-transition";

// ── Catalog Validation ───────────────────────────────────
export { validateWithCatalog } from "spec-transition";

// ── Registry ─────────────────────────────────────────────
export { TransitionRegistry } from "spec-transition";

// ── Match Adapter ────────────────────────────────────────
export {
  deriveEventKey,
  coordToConstraints,
  transitionMatchToScenarioSteps,
} from "spec-transition";

// ── State Store ──────────────────────────────────────────
export type { StateStore } from "spec-transition";
export { InMemoryStateStore } from "spec-transition";
export { SqliteStateStore } from "spec-transition";
export type { AsyncStateStore } from "spec-transition";

// ── Bind Extractor ───────────────────────────────────────
export { extractBind } from "spec-transition";
export type { BindResult, BindError } from "spec-transition";

// ── Input Validator ──────────────────────────────────────
export { validateInput } from "spec-transition";
export type { InputViolation, InputValidationResult } from "spec-transition";

// ── Output Applier ───────────────────────────────────────
export { applyOutput } from "spec-transition";

// ── Engine ───────────────────────────────────────────────
export { TransitionEngine } from "spec-transition";
export type { TransitionResult, TransitionEvent } from "spec-transition";

// ── Decode Adapter ───────────────────────────────────────
export { decodeAddressContext } from "spec-transition";

// ── Demo Specs ───────────────────────────────────────────
export {
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  DEMO_TRANSITION_SPECS,
} from "spec-transition";

// ── DKG Bridge (from dkg) ───────────────────────────────
export { toTransitionSpecNode, toTransitionSpecNodes, deriveInterSpecEdges, deriveDslSatisfiesEdges } from "dkg";
export { violationsToObservations } from "dkg";

// ── Transition Pipeline (로컬) ──────────────────────────
export type { TransitionFunctions, TransitionSessionInput, TransitionSessionResult, TransitionFlushResult } from "./transition-pipeline.js";
export { createTransitionFunctions } from "./transition-pipeline.js";

// ── Transition Metrics (로컬) ────────────────────────────
export { aggregateTransitionResults, transitionFlushToMetrics } from "./transition-metrics.js";
