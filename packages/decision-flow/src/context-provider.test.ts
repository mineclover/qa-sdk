/**
 * 컨텍스트 제공자 테스트
 *
 * "사람에게는 쉬운 의사결정을, 시스템으로서는 일관된 컨텍스트를"
 */

import { describe, it, expect } from 'vitest';
import { FlowEngine } from './engine.js';
import { MemoryInstanceStore } from './instance-store.js';
import { ContextProvider } from './context-provider.js';
import { MENTAL_MODELS } from './mental-model.js';
import type { Evidence, FlowPolicy, FlowSchema } from './types.js';

const SCHEMA: FlowSchema = {
  id: 'feature-decision',
  name: '기능 결정',
  description: '기능 추가 여부 결정',
  version: 'v1',
  gates: [
    {
      id: 'scope',
      name: '범위',
      phase: 'evaluate',
      weight: 'core',
      mentalModels: ['bezos-doors', 'jobs-subtraction'],
      branches: [
        { id: 'new', label: '신규' },
        { id: 'extend', label: '확장' },
        { id: 'skip', label: '안 함' },
      ],
    },
    {
      id: 'approach',
      name: '접근',
      phase: 'decide',
      mentalModels: ['speed-calibration'],
      branches: [
        { id: 'fast', label: '빠르게' },
        { id: 'careful', label: '신중하게' },
      ],
    },
  ],
};

function ev(conf: number): Evidence[] {
  return [{ kind: 'data', source: 'test', content: '테스트', weight: conf }];
}

function buildProvider(opts?: { policies?: FlowPolicy[] }) {
  const store = new MemoryInstanceStore();
  const engine = new FlowEngine({ instanceStore: store });
  engine.registerSchema(SCHEMA);

  const policies = opts?.policies ?? [];
  for (const p of policies) engine.registerPolicy(p);

  const modelMap = new Map<string, { question: string }>();
  for (const [id, m] of Object.entries(MENTAL_MODELS)) {
    modelMap.set(id, { question: m.question });
  }

  const provider = new ContextProvider({
    store,
    policies: new Map([['feature-decision', policies]]),
    schemas: new Map([['feature-decision', SCHEMA]]),
    mentalModels: modelMap,
  });

  return { engine, store, provider };
}

// ─── 이력 기반 컨텍스트 ──────────────────────────────────

describe('이력 기반 컨텍스트', () => {
  it('이전 결정이 없으면 빈 컨텍스트를 반환한다 (첫 결정도 쉽게)', () => {
    const { provider } = buildProvider();
    const ctx = provider.provide('feature-decision');

    expect(ctx.history.totalCompleted).toBe(0);
    expect(ctx.patterns).toHaveLength(0);
    // 하지만 인지 모델 힌트는 항상 제공
    expect(ctx.modelHints.length).toBeGreaterThan(0);
  });

  it('이전 결정이 쌓이면 이력 요약이 제공된다', () => {
    const { engine, provider } = buildProvider();

    // 3회 결정
    for (let i = 0; i < 3; i++) {
      const inst = engine.startFlow('feature-decision', { team: 'platform' });
      engine.selectBranch(inst.id, 'extend', ev(0.8));
      engine.selectBranch(inst.id, 'fast', ev(0.9));
    }

    const ctx = provider.provide('feature-decision');

    expect(ctx.history.totalCompleted).toBe(3);
    expect(ctx.history.averageConfidence).toBeGreaterThan(0.8);
    expect(ctx.history.mostCommonPath).toBeDefined();
    expect(ctx.history.lastDecisionAt).toBeDefined();
  });

  it('같은 팀의 반복 패턴이 힌트로 표면화된다', () => {
    const { engine, provider } = buildProvider();

    // platform 팀: 5회 같은 결정
    for (let i = 0; i < 5; i++) {
      const inst = engine.startFlow('feature-decision', { team: 'platform' });
      engine.selectBranch(inst.id, 'extend', ev(0.8));
      engine.selectBranch(inst.id, 'fast', ev(0.9));
    }

    // platform 팀으로 새 결정 시작할 때 컨텍스트 요청
    const ctx = provider.provide('feature-decision', { team: 'platform' });

    // 패턴이 표면화됨
    expect(ctx.patterns.length).toBeGreaterThan(0);
    const matchingPattern = ctx.patterns.find((p) => p.matchesCurrent);
    expect(matchingPattern).toBeDefined();
    expect(matchingPattern!.frequency).toBe(5);
    expect(matchingPattern!.description).toContain('team=platform');
  });

  it('다른 팀이면 패턴이 match되지 않는다', () => {
    const { engine, provider } = buildProvider();

    for (let i = 0; i < 5; i++) {
      const inst = engine.startFlow('feature-decision', { team: 'platform' });
      engine.selectBranch(inst.id, 'extend', ev(0.8));
      engine.selectBranch(inst.id, 'fast', ev(0.9));
    }

    // infra 팀으로 요청 → platform 패턴이 match 안 됨
    const ctx = provider.provide('feature-decision', { team: 'infra' });
    const matchingPattern = ctx.patterns.find((p) => p.matchesCurrent);
    expect(matchingPattern).toBeUndefined();
  });
});

// ─── 정책 힌트 ──────────────────────────────────────────

describe('정책 힌트', () => {
  it('등록된 자동 정책이 힌트로 표면화된다', () => {
    const { provider } = buildProvider({
      policies: [
        {
          id: 'auto-extend',
          name: '확장 자동 선택',
          flowId: 'feature-decision',
          priority: 100,
          conditions: [{ field: 'context.standard', op: 'eq', value: true }],
          action: { gateId: 'scope', branchId: 'extend', confidence: 0.9 },
          rationale: '표준 패턴은 확장 (autoplan principle 1)',
        },
      ],
    });

    const ctx = provider.provide('feature-decision', { standard: true });

    expect(ctx.activePolicies.length).toBe(1);
    expect(ctx.activePolicies[0].name).toBe('확장 자동 선택');
    expect(ctx.activePolicies[0].gateId).toBe('scope');
    expect(ctx.activePolicies[0].branchId).toBe('extend');
  });
});

// ─── 인지 모델 힌트 ─────────────────────────────────────

describe('인지 모델 힌트', () => {
  it('스키마의 gate에 연결된 mentalModel의 질문이 표면화된다', () => {
    const { provider } = buildProvider();
    const ctx = provider.provide('feature-decision');

    // scope gate: bezos-doors + jobs-subtraction
    const scopeHints = ctx.modelHints.filter((h) => h.gateId === 'scope');
    expect(scopeHints.length).toBe(2);

    const bezos = scopeHints.find((h) => h.modelId === 'bezos-doors');
    expect(bezos).toBeDefined();
    expect(bezos!.question).toContain('되돌릴 수 있는가');

    const jobs = scopeHints.find((h) => h.modelId === 'jobs-subtraction');
    expect(jobs).toBeDefined();
    expect(jobs!.question).toContain('빼면');
  });
});

// ─── gate별 컨텍스트 ────────────────────────────────────

describe('gate별 컨텍스트', () => {
  it('특정 gate의 이전 선택 분포를 보여준다', () => {
    const { engine, provider } = buildProvider();

    // extend 3회, new 1회
    for (let i = 0; i < 3; i++) {
      const inst = engine.startFlow('feature-decision');
      engine.selectBranch(inst.id, 'extend', ev(0.8));
      engine.selectBranch(inst.id, 'fast', ev(0.9));
    }
    const inst = engine.startFlow('feature-decision');
    engine.selectBranch(inst.id, 'new', ev(0.7));
    engine.selectBranch(inst.id, 'careful', ev(0.8));

    const gateCtx = provider.provideForGate('feature-decision', 'scope');

    expect(gateCtx.isCore).toBe(true);
    expect(gateCtx.previousChoiceCount).toBe(4);
    expect(gateCtx.branchDistribution[0].branchId).toBe('extend');
    expect(gateCtx.branchDistribution[0].count).toBe(3);
    expect(gateCtx.branchDistribution[0].ratio).toBeCloseTo(0.75, 1);
  });

  it('코어 gate에서 인지 모델 질문을 제공한다', () => {
    const { provider } = buildProvider();
    const gateCtx = provider.provideForGate('feature-decision', 'scope');

    expect(gateCtx.isCore).toBe(true);
    expect(gateCtx.modelHints.length).toBe(2);
    expect(gateCtx.modelHints.find((h) => h.modelId === 'bezos-doors')).toBeDefined();
  });
});

// ─── 컨텍스트 축적 사이클 ────────────────────────────────

describe('컨텍스트 축적 사이클', () => {
  it('결정할수록 다음 결정의 컨텍스트가 풍부해진다', () => {
    const { engine, provider } = buildProvider();

    // 1회차: 컨텍스트 없음
    const ctx1 = provider.provide('feature-decision', { team: 'platform' });
    expect(ctx1.history.totalCompleted).toBe(0);
    expect(ctx1.patterns).toHaveLength(0);

    // 결정 실행
    const i1 = engine.startFlow('feature-decision', { team: 'platform' });
    engine.selectBranch(i1.id, 'extend', ev(0.8));
    engine.selectBranch(i1.id, 'fast', ev(0.9));

    // 2회차: 이력 1건
    const ctx2 = provider.provide('feature-decision', { team: 'platform' });
    expect(ctx2.history.totalCompleted).toBe(1);

    // 4회 더 실행 (총 5회)
    for (let i = 0; i < 4; i++) {
      const inst = engine.startFlow('feature-decision', { team: 'platform' });
      engine.selectBranch(inst.id, 'extend', ev(0.8));
      engine.selectBranch(inst.id, 'fast', ev(0.9));
    }

    // 6회차: 이력 5건 + 패턴 감지 + 매칭
    const ctx6 = provider.provide('feature-decision', { team: 'platform' });
    expect(ctx6.history.totalCompleted).toBe(5);
    expect(ctx6.patterns.length).toBeGreaterThan(0);
    expect(ctx6.patterns.find((p) => p.matchesCurrent)).toBeDefined();

    // 컨텍스트가 풍부해짐을 확인
    expect(ctx6.history.totalCompleted).toBeGreaterThan(ctx1.history.totalCompleted);
    expect(ctx6.patterns.length).toBeGreaterThan(ctx1.patterns.length);
  });
});
