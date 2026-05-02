/**
 * test-types — 테스트 분류 타입 SSOT.
 *
 * demo-catalog test_phase/test_kind/test_scope 축과 동기화.
 * core, test-scenario-store, CLI 모두 이 패키지에서 import.
 */

// ── TestPhase — 테스트 단계 ─────────────────────────

/** SSOT: demo-catalog test_phase axis entries */
export type TestPhase =
  | "precondition" | "fixture" | "arrange" | "act" | "observe"
  | "assert-primary" | "assert-side" | "assert-negative"
  | "snapshot" | "teardown" | "report";

export const TEST_PHASES: readonly TestPhase[] = [
  "precondition", "fixture", "arrange", "act", "observe",
  "assert-primary", "assert-side", "assert-negative",
  "snapshot", "teardown", "report",
] as const;

// ── TestKind — 테스트 유형 ────────────────────��─────

/** SSOT: demo-catalog test_kind axis entries */
export type TestKind =
  | "unit" | "ui-logic" | "ui" | "db-transaction"
  | "data-exchange" | "auth-flow" | "e2e" | "simulation";

export const TEST_KINDS: readonly TestKind[] = [
  "unit", "ui-logic", "ui", "db-transaction",
  "data-exchange", "auth-flow", "e2e", "simulation",
] as const;

// ── TestScope — 테스트 범위 ─────────────────────────

/** SSOT: demo-catalog test_scope axis entries */
export type TestScope = "single" | "pair" | "multi" | "system";

export const TEST_SCOPES: readonly TestScope[] = [
  "single", "pair", "multi", "system",
] as const;

// ── TestLifecycle — 테스트 생명주기 ─────────────────

export type TestLifecycle =
  | "declared" | "assigned" | "collected" | "verified" | "archived";

export const TEST_LIFECYCLES: readonly TestLifecycle[] = [
  "declared", "assigned", "collected", "verified", "archived",
] as const;
