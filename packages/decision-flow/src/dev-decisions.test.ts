/**
 * 일상 개발 의사결정 플로우 평가
 *
 * 5가지 태스크를 실전 시나리오로 실행한다.
 */

import { describe, it, expect } from 'vitest';
import { FlowEngine } from './engine.js';
import { MemoryInstanceStore } from './instance-store.js';
import { ContextProvider } from './context-provider.js';
import { validateFlowSchema } from './schema.js';
import { MENTAL_MODELS } from './mental-model.js';
import {
  TEST_NEEDED_FLOW,
  SCOPE_EXPANSION_FLOW,
  STABILIZATION_FLOW,
  DECISION_ROUTER,
  DEV_DECISION_POLICIES,
  ALL_DEV_DECISION_FLOWS,
} from './dev-decisions.js';
import { buildNarrative, summarizeNarrative } from './narrative.js';
import { DecisionMonitor } from './monitor.js';
import type { Evidence, FlowPolicy } from './types.js';

function ev(kind: Evidence['kind'], content: string, weight = 0.8): Evidence {
  return { kind, source: 'dev', content, weight };
}

function setupAll() {
  const store = new MemoryInstanceStore();
  const engine = new FlowEngine({ instanceStore: store });
  const monitor = new DecisionMonitor();
  engine.addListener(monitor);

  for (const schema of ALL_DEV_DECISION_FLOWS) engine.registerSchema(schema);
  for (const policy of DEV_DECISION_POLICIES) engine.registerPolicy(policy);

  const modelMap = new Map<string, { question: string }>();
  for (const [id, m] of Object.entries(MENTAL_MODELS)) {
    modelMap.set(id, { question: m.question });
  }

  const allPolicies = new Map<string, readonly FlowPolicy[]>();
  for (const schema of ALL_DEV_DECISION_FLOWS) {
    allPolicies.set(
      schema.id,
      DEV_DECISION_POLICIES.filter((p) => p.flowId === schema.id),
    );
  }

  const provider = new ContextProvider({
    store,
    policies: allPolicies,
    schemas: new Map(ALL_DEV_DECISION_FLOWS.map((s) => [s.id, s])),
    mentalModels: modelMap,
  });

  return { engine, store, monitor, provider };
}

// ─── 구조 검증 ──────────────────────────────────────────

describe('구조 검증', () => {
  it('모든 dev decision flow가 유효하다', () => {
    for (const flow of ALL_DEV_DECISION_FLOWS) {
      const result = validateFlowSchema(flow);
      expect(result.valid, `${flow.id}: ${result.issues.map((i) => i.message).join(', ')}`).toBe(
        true,
      );
    }
  });
});

// ─── 시나리오 A: 테스트 필요 여부 판단 ───────────────────

describe('테스트 필요 여부 판단', () => {
  it('문서만 변경 → 자동으로 테스트 불필요 판정', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('test-needed');

    engine.selectBranch(inst.id, 'docs', [ev('data', 'README 수정만')]);
    engine.selectBranch(inst.id, 'local', [ev('data', '영향 없음')]);
    engine.selectBranch(inst.id, 'sufficient', [ev('data', '해당 없음')]);

    // 자동 정책: docs → not-needed
    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections.find((s) => s.gateId === 'verdict')?.branchId).toBe('not-needed');
  });

  it('신규 기능 + 시스템 영향 → 자동으로 E2E 테스트 판정', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('test-needed');

    engine.selectBranch(inst.id, 'new-feature', [ev('data', '새 API 엔드포인트 추가')]);
    engine.selectBranch(inst.id, 'system', [ev('data', '다른 서비스에서 호출하는 API')]);
    engine.selectBranch(inst.id, 'none', [ev('data', '관련 테스트 전무')]);

    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections.find((s) => s.gateId === 'verdict')?.branchId).toBe('add-e2e');
  });

  it('리팩터 + 국소 + 커버리지 충분 → 자동으로 테스트 불필요', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('test-needed');

    engine.selectBranch(inst.id, 'refactor');
    engine.selectBranch(inst.id, 'local');
    engine.selectBranch(inst.id, 'sufficient');

    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections.find((s) => s.gateId === 'verdict')?.branchId).toBe('not-needed');
  });

  it('버그 수정 + 모듈 영향 + 부분 커버리지 → 수동 판단 필요', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('test-needed');

    engine.selectBranch(inst.id, 'bug-fix', [ev('data', '결제 로직 버그')]);
    engine.selectBranch(inst.id, 'module', [ev('data', 'payment 모듈 import 3곳')]);
    engine.selectBranch(inst.id, 'partial', [ev('data', 'happy path만 커버')]);

    // 자동 정책 매칭 안 됨 → 수동 판단
    const autoResult = engine.autoSelect(inst.id);
    expect(autoResult).toBeNull();

    // 수동으로 통합 테스트 추가 판정
    const result = engine.selectBranch(inst.id, 'add-integration', [
      ev('rule', 'edge-paranoia — 결제는 엣지 케이스가 위험'),
    ]);
    expect(result.status).toBe('completed');
  });
});

// ─── 시나리오 B: 기획 확장 여부 판단 ────────────────────

describe('기획 확장 여부 판단', () => {
  it('안정 + 수요 많음 + 부채 낮음 → 확장', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('scope-expansion', { feature: 'event-catalog' });

    engine.selectBranch(inst.id, 'stable', [ev('data', '프로덕션 6주 무사고')]);
    engine.selectBranch(inst.id, 'high-demand', [ev('data', '3팀에서 확장 요청')]);
    engine.selectBranch(inst.id, 'low', [ev('data', '최근 리팩터 완료')]);
    const result = engine.selectBranch(inst.id, 'expand', [
      ev('rule', 'bezos-doors — two-way door, 확장 후 축소 가능'),
    ]);

    expect(result.status).toBe('completed');

    const narrative = buildNarrative({
      instance: result,
      schema: SCOPE_EXPANSION_FLOW,
      context: { source: 'team-feedback', trigger: 'event-catalog 확장 요청 3건' },
      outcome: { artifactType: 'plan', artifactRef: 'event-catalog-v2-plan' },
    });
    expect(summarizeNarrative(narrative)).toContain('event-catalog');
  });

  it('미완성 + 수요 없음 → 자동으로 보류 판정', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('scope-expansion', { feature: 'experimental' });

    engine.selectBranch(inst.id, 'incomplete');
    engine.selectBranch(inst.id, 'none');
    engine.selectBranch(inst.id, 'moderate');

    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections.find((s) => s.gateId === 'verdict')?.branchId).toBe('defer');
  });
});

// ─── 시나리오 C: 기능 안정화 ────────────────────────────

describe('기능 안정화 의사결정', () => {
  it('버그 빈도 높음 → 자동으로 개선 필요 판정', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('stabilization', { module: 'payment' });

    engine.selectBranch(inst.id, 'high', [ev('data', '이번 주 5건 보고')]);
    engine.selectBranch(inst.id, 'borderline', [ev('data', 'P99 200ms, SLA 250ms')]);
    engine.selectBranch(inst.id, 'acceptable');

    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections.find((s) => s.gateId === 'verdict')?.branchId).toBe('needs-fix');
  });

  it('전부 양호 → 안정 판정', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('stabilization', { module: 'core' });

    engine.selectBranch(inst.id, 'low', [ev('data', '3개월간 버그 0건')]);
    engine.selectBranch(inst.id, 'healthy', [ev('data', 'P99 50ms, SLA 250ms')]);
    engine.selectBranch(inst.id, 'clean', [ev('data', '최근 리팩터 완료')]);
    const result = engine.selectBranch(inst.id, 'stable', [ev('data', '모든 지표 양호')]);

    expect(result.status).toBe('completed');
  });
});

// ─── 시나리오 D: 기존 기능 조회 ─────────────────────────

describe('기존 기능 조회', () => {
  it('이전 결정 이력에서 키워드로 관련 기능을 찾는다', () => {
    const { engine, provider } = setupAll();

    // event-catalog 관련 결정 3건 쌓기
    for (let i = 0; i < 3; i++) {
      const inst = engine.startFlow('scope-expansion', { feature: 'event-catalog' });
      engine.selectBranch(inst.id, 'stable');
      engine.selectBranch(inst.id, 'high-demand');
      engine.selectBranch(inst.id, 'low');
      engine.selectBranch(inst.id, 'expand');
    }

    // payment 관련 결정 1건
    const pay = engine.startFlow('stabilization', { module: 'payment' });
    engine.selectBranch(pay.id, 'high');
    engine.selectBranch(pay.id, 'borderline');
    engine.selectBranch(pay.id, 'acceptable');
    engine.selectBranch(pay.id, 'needs-fix');

    // "event-catalog" 조회
    const lookup = provider.lookup('event-catalog');
    expect(lookup.relatedInstances.length).toBe(3);
    expect(lookup.lastDecision).toBeDefined();
    expect(lookup.lastDecision!.schemaId).toBe('scope-expansion');

    // "payment" 조회
    const payLookup = provider.lookup('payment');
    expect(payLookup.relatedInstances.length).toBe(1);
    expect(payLookup.lastDecision!.schemaId).toBe('stabilization');

    // 없는 기능 조회
    const noResult = provider.lookup('nonexistent');
    expect(noResult.relatedInstances.length).toBe(0);
  });
});

// ─── 시나리오 E: 라우터 → 하위 플로우 ───────────────────

describe('범용 라우터', () => {
  it('결정 유형을 선택하면 적절한 하위 플로우를 안내한다', () => {
    const { engine } = setupAll();
    const inst = engine.startFlow('decision-router', {
      description: '새 API에 테스트가 필요한가?',
    });

    engine.selectBranch(inst.id, 'test-needed', [ev('data', '새 엔드포인트 추가 예정')]);
    engine.selectBranch(inst.id, 'important', [ev('data', '이번 스프린트 내 해결')]);
    const result = engine.selectBranch(inst.id, 'two-way', [
      ev('rule', 'bezos-doors — 테스트 추가는 가역적'),
    ]);

    expect(result.status).toBe('completed');
    // decision-type=test-needed → 다음 단계로 test-needed 플로우 실행
    expect(result.selections[0].branchId).toBe('test-needed');
  });
});

// ─── 시나리오 F: 컨텍스트 축적 사이클 ───────────────────

describe('컨텍스트 축적 — 결정할수록 다음 결정이 쉬워진다', () => {
  it('5회 안정화 판정 후 다음 안정화 결정에 패턴이 표면화된다', () => {
    const { engine, provider } = setupAll();

    // platform 모듈: 5회 안정 판정
    for (let i = 0; i < 5; i++) {
      const inst = engine.startFlow('stabilization', { module: 'platform' });
      engine.selectBranch(inst.id, 'low', [ev('data', '버그 없음')]);
      engine.selectBranch(inst.id, 'healthy', [ev('data', '성능 양호')]);
      engine.selectBranch(inst.id, 'clean', [ev('data', '코드 깨끗')]);
      engine.selectBranch(inst.id, 'stable', [ev('data', '안정')]);
    }

    // 6회차: 컨텍스트 요청
    const ctx = provider.provide('stabilization', { module: 'platform' });
    expect(ctx.history.totalCompleted).toBe(5);
    expect(ctx.patterns.length).toBeGreaterThan(0);

    const matching = ctx.patterns.find((p) => p.matchesCurrent);
    expect(matching).toBeDefined();
    expect(matching!.description).toContain('platform');

    // 기능 조회로도 확인 가능
    const lookup = provider.lookup('platform');
    expect(lookup.relatedInstances.length).toBe(5);
  });
});
