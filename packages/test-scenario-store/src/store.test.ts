// @def.boundary persistence-system-root
// @def.doc test-scenario-store-test

import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteTestScenarioStore } from './store.js';
import {
  canTransitionTestScenario,
  TEST_SCENARIO_LIFECYCLE_TRANSITIONS,
  type TestScenarioStore,
} from './port.js';

describe('SqliteTestScenarioStore', () => {
  let store: SqliteTestScenarioStore;

  beforeEach(() => {
    store = new SqliteTestScenarioStore(':memory:');
  });

  it('upsertDeclared → declared 상태로 저장', () => {
    store.upsertDeclared({
      aCoord: 'def:42/unit',
      specAddress: 'def:42',
      kind: 'unit',
      scope: 'single',
      intent: '입력 검증',
      primarySvc: '@qa-sdk/auth/process-auth',
    });

    const s = store.getByACoord('def:42/unit');
    expect(s?.lifecycle).toBe('declared');
    expect(s?.kind).toBe('unit');
  });

  it('중복 upsertDeclared는 skip', () => {
    const input = {
      aCoord: 'def:42/unit',
      specAddress: 'def:42',
      kind: 'unit' as const,
      scope: 'single' as const,
      intent: '테스트',
      primarySvc: '@qa-sdk/auth/process-auth',
    };
    store.upsertDeclared(input);
    store.upsertDeclared(input);
    expect(store.listAll().length).toBe(1);
  });

  it('assign → assigned 상태 + B 좌표 부여', () => {
    store.upsertDeclared({
      aCoord: 'def:42/unit',
      specAddress: 'def:42',
      kind: 'unit',
      scope: 'single',
      intent: '테스트',
      primarySvc: '@qa-sdk/auth/process-auth',
    });

    store.assign(
      'def:42/unit',
      'test_scenario:v1:1',
      'packages/auth-service/src/auth.test.ts',
      false,
    );

    const s = store.getById('test_scenario:v1:1');
    expect(s?.lifecycle).toBe('assigned');
    expect(s?.filePath).toBe('packages/auth-service/src/auth.test.ts');
  });

  it('recordRun → collected 상태 전이', () => {
    store.upsertDeclared({
      aCoord: 'def:42/unit',
      specAddress: 'def:42',
      kind: 'unit',
      scope: 'single',
      intent: '테스트',
      primarySvc: '@qa-sdk/auth/process-auth',
    });
    store.assign('def:42/unit', 'test_scenario:v1:1', 'auth.test.ts', false);
    store.recordRun('test_scenario:v1:1', true, 'abc123', 200);

    const s = store.getById('test_scenario:v1:1');
    expect(s?.lifecycle).toBe('collected');
    expect(store.listRuns('test_scenario:v1:1')).toHaveLength(1);
    expect(store.latestRun('test_scenario:v1:1')).toMatchObject({
      scenarioId: 'test_scenario:v1:1',
      passed: true,
      commitHash: 'abc123',
      durationMs: 200,
    });
  });

  it('listByLifecycle → lifecycle 필터', () => {
    store.upsertDeclared({
      aCoord: 'def:10/unit',
      specAddress: 'def:10',
      kind: 'unit',
      scope: 'single',
      intent: '테스트A',
      primarySvc: '@qa-sdk/svc-a',
    });
    store.upsertDeclared({
      aCoord: 'def:11/e2e',
      specAddress: 'def:11',
      kind: 'e2e',
      scope: 'system',
      intent: '테스트B',
      primarySvc: '@qa-sdk/svc-b',
    });
    store.assign('def:10/unit', 'test_scenario:v1:1', 'svc-a.test.ts', false);

    expect(store.listByLifecycle('declared').length).toBe(1);
    expect(store.listByLifecycle('assigned').length).toBe(1);
  });

  it('nextSeq → 전역 B 좌표(test_scenario:v1:N) 단조 증가', () => {
    // declared 만 있을 때는 B 좌표 미부여 → 0 행. nextSeq=1.
    store.upsertDeclared({
      aCoord: 'def:20/unit',
      specAddress: 'def:20',
      kind: 'unit',
      scope: 'single',
      intent: '테스트',
      primarySvc: '@qa-sdk/svc',
    });
    expect(store.nextSeq('unit', 'single')).toBe(1);

    // assign 으로 test_scenario:v1:1 부여 후에는 다음 N=2.
    store.assign('def:20/unit', 'test_scenario:v1:1', 'svc.test.ts', false);
    expect(store.nextSeq('unit', 'single')).toBe(2);
    expect(store.nextSeq('e2e', 'system')).toBe(2); // kind/scope 무관 — 전역.
  });

  it('backend-agnostic port는 현재 lifecycle과 실행 메타데이터 계약을 고정한다', () => {
    const port: TestScenarioStore = store;
    expect(port).toBe(store);
    expect(TEST_SCENARIO_LIFECYCLE_TRANSITIONS).toEqual({
      declared: ['assigned'],
      assigned: ['collected'],
      collected: [],
      verified: [],
      archived: [],
    });
    expect(canTransitionTestScenario('declared', 'assigned')).toBe(true);
    expect(canTransitionTestScenario('assigned', 'collected')).toBe(true);
    expect(canTransitionTestScenario('collected', 'verified')).toBe(false);
  });
});
