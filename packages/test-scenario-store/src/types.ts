export type TestKind =
  | "unit"
  | "ui-logic"
  | "ui"
  | "db-transaction"
  | "data-exchange"
  | "auth-flow"
  | "e2e"
  | "simulation";

export type TestScope = "single" | "pair" | "multi" | "system";

export type TestLifecycle =
  | "declared"
  | "assigned"
  | "collected"
  | "verified"
  | "archived";

export interface TestScenario {
  /** B 좌표 — test_scenario:v1:M (assigned 이후 부여) */
  id: string;
  /** A 좌표 — def:{spec_address}/{test_kind} */
  aCoord: string;
  /** 스펙 문서 address (def_document:v2:N) */
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  lifecycle: TestLifecycle;
  /** 테스트 의도 (스펙 frontmatter tests[].intent) */
  intent: string;
  /** 진입점 서비스 모듈 import 경로 */
  primarySvc: string;
  /** 교차 서비스 목록 (JSON 직렬화) */
  participants: string[];
  /** 실제 테스트 파일 경로 */
  filePath: string | null;
  /** 연결된 PipeSpec 주소 (simulation 타입) */
  simulationRef: string | null;
  /** 스펙 lifecycle 버전 */
  specVersion: string | null;
  /** convention_violation 마킹 */
  conventionViolation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestScenarioRun {
  id: number;
  scenarioId: string;
  passed: boolean;
  commitHash: string | null;
  runAt: string;
  durationMs: number | null;
}

export interface CreateTestScenarioInput {
  aCoord: string;
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  intent: string;
  primarySvc: string;
  participants?: string[];
}
