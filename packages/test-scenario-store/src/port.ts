// @def.boundary persistence-system-root
// @def.doc test-scenario-store

import type {
  CreateTestScenarioInput,
  TestLifecycle,
  TestScenario,
  TestScenarioRun,
} from './types.js';

/**
 * 테스트 시나리오 저장소의 논리 계약.
 *
 * 이 port는 저장 backend를 선택하지 않는다. SQLite·RDB·NoSQL·인메모리
 * 구현은 같은 좌표·생명주기·실행 결과 계약을 만족해야 한다.
 * 현재 계약의 생명주기는 declared → assigned → collected까지다.
 * collected → verified 승격은 별도 정책이 확정될 때까지 포함하지 않는다.
 */
export interface TestScenarioStore {
  /** A 좌표 선언을 저장한다. 같은 A 좌표는 멱등적으로 유지한다. */
  upsertDeclared(input: CreateTestScenarioInput): void;
  /** 선언된 시나리오에 B 좌표와 테스트 파일을 연결한다. */
  assign(aCoord: string, bCoord: string, filePath: string, violation: boolean): void;
  /**
   * 실행 결과와 commit/duration 메타데이터를 저장하고 assigned를 collected로 전이한다.
   * 현재 schema에는 idempotency key가 없으므로 재시도 병합 정책은 후속 결정이다.
   */
  recordRun(
    scenarioId: string,
    passed: boolean,
    commitHash: string | null,
    durationMs: number | null,
  ): void;
  /** 시나리오 실행 이력을 최신 실행부터 반환한다. */
  listRuns(scenarioId: string): TestScenarioRun[];
  /** 시나리오의 가장 최근 실행을 반환한다. */
  latestRun(scenarioId: string): TestScenarioRun | undefined;
  getByACoord(aCoord: string): TestScenario | undefined;
  getById(id: string): TestScenario | undefined;
  listAll(): TestScenario[];
  listByLifecycle(lifecycle: TestLifecycle): TestScenario[];
  /** B 좌표의 전역 단조 증가 시퀀스를 조회한다. */
  nextSeq(kind: string, scope: string): number;
}

/** 저장 port가 현재 지원하는 lifecycle 전이 표. */
export const TEST_SCENARIO_LIFECYCLE_TRANSITIONS = {
  declared: ['assigned'],
  assigned: ['collected'],
  collected: [],
  verified: [],
  archived: [],
} as const satisfies Readonly<Record<TestLifecycle, readonly TestLifecycle[]>>;

/** 두 lifecycle 사이의 전이가 현재 저장 계약에 포함되는지 확인한다. */
export function canTransitionTestScenario(from: TestLifecycle, to: TestLifecycle): boolean {
  const allowed = TEST_SCENARIO_LIFECYCLE_TRANSITIONS[from] as readonly TestLifecycle[];
  return allowed.includes(to);
}

/** 실행 결과 저장 계약의 필수 메타데이터 shape. */
export interface TestScenarioRunContract extends Pick<
  TestScenarioRun,
  'scenarioId' | 'passed' | 'commitHash' | 'durationMs'
> {
  /** 실행 시각은 adapter가 부여하되 ISO-8601 문자열로 반환한다. */
  readonly runAt: string;
}
