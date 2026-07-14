/**
 * 실전 평가 — 실제 소프트웨어 설계 시나리오를 decision-flow로 실행
 *
 * 시나리오: qa-sdk에 event-catalog 패키지를 추가하는 의사결정
 * gstack 파이프라인의 Think → Plan → Build → Review → Ship을 순서대로 실행하며
 * 시스템이 실제 의사결정을 얼마나 잘 포착하는지 평가한다.
 */

import { describe, it, expect } from 'vitest';
import { FlowEngine } from './engine.js';
import { MemoryInstanceStore } from './instance-store.js';
import {
  FORCING_QUESTIONS_FLOW,
  OFFICE_HOURS_FLOW,
  CEO_REVIEW_FLOW,
  ENG_REVIEW_FLOW,
  CODE_REVIEW_FLOW,
  BUILD_FLOW,
  SHIP_FLOW,
  REFLECT_FLOW,
  AUTOPLAN_POLICIES,
  ALL_SPRINT_FLOWS,
} from './sprint.js';
import {
  buildNarrative,
  extractPivotPoints,
  summarizeNarrative,
  findNarrativeDivergence,
} from './narrative.js';
import { diffInstances } from './comparison.js';
import { detectPatterns, generatePolicyCandidates } from './policy-learning.js';
import { analyzeGateStructure, identifyCoreGates } from './core-analysis.js';
import { validateInstanceModelCoverage } from './mental-model.js';
import type { Evidence, FlowInstance } from './types.js';

// ─── 공통 ────────────────────────────────────────────────

function ev(kind: Evidence['kind'], source: string, content: string, weight = 0.8): Evidence {
  return { kind, source, content, weight };
}

function setupEngine(): { engine: FlowEngine; store: MemoryInstanceStore } {
  const store = new MemoryInstanceStore();
  const engine = new FlowEngine({ instanceStore: store });
  for (const schema of ALL_SPRINT_FLOWS) {
    engine.registerSchema(schema);
  }
  for (const policy of AUTOPLAN_POLICIES) {
    engine.registerPolicy(policy);
  }
  return { engine, store };
}

// ─── 시나리오 1: event-catalog 패키지 신규 추가 ──────────

describe('시나리오 1: event-catalog 신규 패키지 — Think → Plan → Build → Review → Ship', () => {
  it('Think (Forcing Questions) — 6개 질문이 각각 독립 gate로 평가된다', () => {
    const { engine } = setupEngine();

    // Forcing Questions 단독 실행
    const fq = engine.startFlow('forcing-questions', {
      project: 'qa-sdk',
      feature: 'event-catalog',
    });

    engine.selectBranch(fq.id, 'strong', [
      ev('data', 'demand-reality', '5개 서비스에서 이벤트 정의 중복 발견'),
    ]);
    engine.selectBranch(fq.id, 'painful-workaround', [
      ev('data', 'status-quo', '수동으로 각 서비스에서 이벤트 키 관리 중'),
    ]);
    engine.selectBranch(fq.id, 'named-person', [
      ev('data', 'specificity', 'shop-web 개발자가 매주 이벤트 키 충돌 보고'),
    ]);
    engine.selectBranch(fq.id, 'defined', [
      ev('data', 'wedge', 'auto-track + prefix 매핑만으로 시작 가능'),
    ]);
    engine.selectBranch(fq.id, 'observed', [
      ev('data', 'observation', 'browser-sdk 연동 시 이벤트 누락 3건 발견'),
    ]);
    const fqResult = engine.selectBranch(fq.id, 'more-essential', [
      ev('data', 'future', '서비스 추가될수록 이벤트 관리 복잡도 O(n²) 증가'),
    ]);

    expect(fqResult.status).toBe('completed');
    expect(fqResult.selections.length).toBe(6); // 6 FQ = 6 gates

    // 6차원 좌표 인코딩 — 729 경로 중 하나
    expect(fqResult.coordinateAddress).toBeDefined();

    // 서사: 6개 질문 각각이 여정의 한 걸음
    const narrative = buildNarrative({
      instance: fqResult,
      schema: FORCING_QUESTIONS_FLOW,
      context: {
        source: 'developer-feedback',
        trigger: '이벤트 정의 중복 + 키 충돌 반복 보고',
      },
      outcome: {
        artifactType: 'validation-result',
        artifactRef: '6/6 FQ 강한 증거',
      },
    });

    expect(narrative.journey.length).toBe(6);
    // 모든 FQ에 강한 증거
    expect(narrative.journey.every((s) => s.confidence > 0.5)).toBe(true);
  });

  it('Think (Office Hours) — FQ subFlow 참조 + 전제 도전 + 접근법 선택', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('office-hours', {
      project: 'qa-sdk',
      feature: 'event-catalog',
    });

    // 기존 프로젝트의 확장
    engine.selectBranch(inst.id, 'existing-project', [
      ev('data', 'monorepo-analysis', 'qa-sdk에 이벤트 정의가 산재'),
    ]);

    // 스타트업 모드
    engine.selectBranch(inst.id, 'startup', [ev('rule', 'gstack-ethos', '수요 현실 검증 필요')]);

    // diagnostic = subFlow gate → subFlowInstanceId로 FQ 결과 연결
    engine.selectBranch(inst.id, 'fq-completed', [], { subFlowInstanceId: 'fq-inst-001' });

    // 환경 조사
    engine.selectBranch(inst.id, 'search', [ev('external', 'market-research', '유사 패턴 존재')]);

    // 전제 검증
    engine.selectBranch(inst.id, 'validated', [
      ev('data', 'evidence-summary', '6 FQ 전부 강한 증거 확보'),
      ev('rule', 'three-layer', 'L3: 이벤트는 좌표계의 입력 — 중앙화가 자연스럽다'),
    ]);

    // 접근법
    const result = engine.selectBranch(inst.id, 'recommended', [
      ev('precedent', 'demo-snapshot', 'DEMO_CATALOG SSOT 패턴이 성공적'),
      ev('rule', 'jobs-subtraction', 'auto-track만 → 최소 쐐기'),
    ]);

    expect(result.status).toBe('completed');
    // subFlow gate 포함 6 gates
    expect(result.selections.length).toBe(6);
  });

  it('Plan - Strategic (CEO Review) — 스코프와 위험 결정', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('ceo-review', {
      project: 'qa-sdk',
      feature: 'event-catalog',
      designDoc: 'office-hours 결과 참조',
    });

    // 올바른 문제다
    engine.selectBranch(inst.id, 'right-problem', [
      ev('data', 'office-hours', '6 FQ 통과, 실증거 확보'),
    ]);

    // 기존 코드 확장
    engine.selectBranch(inst.id, 'extend', [
      ev('data', 'codebase', 'demo-snapshot의 DEMO_CATALOG 패턴 확장'),
      ev('rule', 'boil-the-lake', '기존 인프라 위에 쌓는 게 한계 비용 최소'),
    ]);

    // 실용적 절충안
    engine.selectBranch(inst.id, 'pragmatic', [
      ev('rule', 'jobs-subtraction', 'auto-track + prefix 매핑이 핵심, 나머지 후속'),
      ev('data', 'timeline', '1 스프린트 내 완료 가능한 범위'),
    ]);

    // 선택적 확장
    engine.selectBranch(inst.id, 'selective', [
      ev('rule', 'bezos-doors', 'two-way door — 패키지 추가는 쉽게 되돌림 가능'),
      ev('data', 'scope', '코어 기능만 먼저, UI/대시보드는 후속'),
    ]);

    // 위험: 낮음
    engine.selectBranch(inst.id, 'low', [
      ev('data', 'risk-analysis', '기존 패턴 확장이므로 예측 가능'),
    ]);

    // 스프린트 내 완료
    const result = engine.selectBranch(inst.id, 'within-sprint', [
      ev('data', 'estimation', 'auto-track + prefix 매핑 = 2-3일 작업량'),
    ]);

    expect(result.status).toBe('completed');

    const narrative = buildNarrative({
      instance: result,
      schema: CEO_REVIEW_FLOW,
      context: {
        source: 'office-hours-output',
        trigger: 'event-catalog 설계 문서에 대한 전략 리뷰',
      },
      outcome: {
        artifactType: 'strategic-plan',
        artifactRef: 'selective-expansion/event-catalog',
      },
    });

    // 코어 전환점
    const pivots = extractPivotPoints(narrative);
    expect(pivots.length).toBe(2); // premise + scope-mode (core gates)
    expect(pivots.find((p) => p.gateId === 'scope-mode')?.choice).toBe('selective');
  });

  it('Plan - Technical (Eng Review) — 아키텍처 + 자동 정책 적용', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('eng-review', {
      project: 'qa-sdk',
      feature: 'event-catalog',
      isStandardPattern: true, // DEMO_CATALOG 패턴 재사용
      changeType: 'observability', // 관측성 추가 성격
    });

    // 자동 정책 테스트: isStandardPattern=true → architecture 자동 승인
    const autoResult = engine.autoSelect(inst.id);
    expect(autoResult).not.toBeNull();
    expect(autoResult!.selections.find((s) => s.gateId === 'architecture')?.branchId).toBe(
      'approved',
    );

    // 나머지 수동 진행
    engine.selectBranch(inst.id, 'all-mapped', [
      ev('data', 'failure-analysis', '실패 경로: 카탈로그 누락 시 fallback to manual'),
    ]);

    engine.selectBranch(inst.id, 'integration-focus', [
      ev('rule', 'convention', '카탈로그 변경은 다른 패키지에 영향 — 통합 테스트 중심'),
    ]);

    // 자동 정책: changeType=observability → full-trace 자동 선택
    const autoObs = engine.autoSelect(inst.id);
    expect(autoObs).not.toBeNull();

    const result = engine.getInstance(inst.id)!;
    expect(result.status).toBe('completed');
    expect(result.selections.find((s) => s.gateId === 'observability')?.branchId).toBe(
      'full-trace',
    );
  });

  it('Build — boil-the-lake 판정 + 기술 부채 처리', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('build', {
      project: 'qa-sdk',
      feature: 'event-catalog',
      marginalCostIsLow: true, // AI가 한계 비용 낮춤
    });

    // 자동 정책: marginalCostIsLow=true → full 구현
    const autoResult = engine.autoSelect(inst.id);
    expect(autoResult).not.toBeNull();
    expect(autoResult!.selections.find((s) => s.gateId === 'implementation-scope')?.branchId).toBe(
      'full',
    );

    // 발견 즉시 정리
    engine.selectBranch(inst.id, 'clean-as-you-go', [
      ev('rule', 'temporal-depth', '지금 정리 안 하면 다음 스프린트에 2배 비용'),
    ]);

    // 프로덕션 준비 완료
    const result = engine.selectBranch(inst.id, 'production-ready', [
      ev('data', 'test-result', '통합 테스트 전부 통과'),
      ev('data', 'code-review', '셀프 리뷰 완료'),
    ]);

    expect(result.status).toBe('completed');
  });

  it('Review → Ship — 저위험 자동 승인 + 출시', () => {
    const { engine } = setupEngine();

    // Code Review
    const review = engine.startFlow('code-review', {
      project: 'qa-sdk',
      feature: 'event-catalog',
    });

    engine.selectBranch(review.id, 'on-scope');
    engine.selectBranch(review.id, 'auto-fixable', [
      ev('data', 'linter', 'import 순서 + 타입 export 누락'),
    ]);

    // 자동 정책: on-scope + auto-fixable → approve
    const autoApprove = engine.autoSelect(review.id);
    expect(autoApprove).not.toBeNull();
    expect(autoApprove!.selections.find((s) => s.gateId === 'action')?.branchId).toBe('approve');

    // Ship
    const ship = engine.startFlow('ship', {
      project: 'qa-sdk',
      feature: 'event-catalog',
    });

    engine.selectBranch(ship.id, 'all-pass', [ev('data', 'ci', '125 tests passed')]);
    engine.selectBranch(ship.id, 'reviewed');
    const shipResult = engine.selectBranch(ship.id, 'minor', [
      ev('rule', 'semver', '신규 기능 추가 = minor bump'),
    ]);

    expect(shipResult.status).toBe('completed');
  });
});

// ─── 시나리오 2: 대안 비교 — extend vs new ──────────────

describe('시나리오 2: 같은 문제, 다른 접근 — extend vs new 서사 비교', () => {
  it('두 CEO Review 서사의 분기점과 이유를 비교한다', () => {
    const { engine } = setupEngine();

    // 접근 A: 기존 확장 (extend → pragmatic → selective)
    const instA = engine.startFlow('ceo-review', { approach: 'conservative' });
    engine.selectBranch(instA.id, 'right-problem', [ev('data', 'analysis', '검증됨')]);
    engine.selectBranch(instA.id, 'extend', [
      ev('precedent', 'history', 'DEMO_CATALOG 패턴이 잘 작동해옴'),
    ]);
    engine.selectBranch(instA.id, 'pragmatic', [ev('rule', 'convention', '현실적 절충')]);
    engine.selectBranch(instA.id, 'selective', [ev('rule', 'bezos-doors', 'two-way door')]);
    engine.selectBranch(instA.id, 'low', [ev('data', 'risk', '예측 가능')]);
    const resultA = engine.selectBranch(instA.id, 'within-sprint', [ev('data', 'est', '2-3일')]);

    // 접근 B: 처음부터 다시 (rebuild → ideal → expansion)
    const instB = engine.startFlow('ceo-review', { approach: 'ambitious' });
    engine.selectBranch(instB.id, 'right-problem', [ev('data', 'analysis', '검증됨')]);
    engine.selectBranch(instB.id, 'rebuild', [
      ev('data', 'tech-debt', '기존 구조의 한계가 보임 — 새 아키텍처가 나음'),
      ev('intuition', 'experience', '이번에 제대로 안 하면 나중에 2배 비용'),
    ]);
    engine.selectBranch(instB.id, 'ideal', [ev('rule', 'boil-the-lake', 'AI가 비용을 낮췄다')]);
    engine.selectBranch(instB.id, 'expansion', [
      ev('rule', 'founder-mode', '10x 비전으로 가야 한다'),
    ]);
    engine.selectBranch(instB.id, 'high', [ev('data', 'risk', '새 아키텍처 검증 필요')]);
    const resultB = engine.selectBranch(instB.id, 'multi-sprint', [ev('data', 'est', '2-3주')]);

    // 인스턴스 비교
    const diff = diffInstances(resultA, resultB, CEO_REVIEW_FLOW);
    expect(diff.divergencePoint).toBeDefined();
    expect(diff.divergencePoint!.gateId).toBe('code-leverage'); // 여기서 갈림

    // 서사 비교
    const narA = buildNarrative({
      instance: resultA,
      schema: CEO_REVIEW_FLOW,
      context: { source: 'same-problem', trigger: '이벤트 카탈로그 필요' },
      outcome: { artifactType: 'plan', artifactRef: 'extend-plan' },
    });
    const narB = buildNarrative({
      instance: resultB,
      schema: CEO_REVIEW_FLOW,
      context: { source: 'same-problem', trigger: '이벤트 카탈로그 필요' },
      outcome: { artifactType: 'plan', artifactRef: 'rebuild-plan' },
    });

    const divergence = findNarrativeDivergence(narA, narB);
    expect(divergence).not.toBeNull();
    expect(divergence!.gateId).toBe('code-leverage');
    expect(divergence!.choiceA).toBe('extend');
    expect(divergence!.choiceB).toBe('rebuild');

    // A는 precedent 근거, B는 data+intuition 근거
    expect(divergence!.reasonA).toContain('잘 작동해옴');
    expect(divergence!.reasonB).toContain('한계가 보임');

    // 다른 주소 (다른 결정 공간의 점)
    expect(resultA.coordinateAddress).not.toBe(resultB.coordinateAddress);
  });
});

// ─── 시나리오 3: 반복 결정에서 패턴 발견 ─────────────────

describe('시나리오 3: 반복 패턴 — code-review 5회 반복 후 자동 정책 발견', () => {
  it('같은 팀의 PR이 5회 연속 on-scope + clean이면 패턴으로 감지된다', () => {
    const { engine, store } = setupEngine();

    // platform 팀: 5회 연속 on-scope + clean → approve
    for (let i = 0; i < 5; i++) {
      const inst = engine.startFlow('code-review', { team: 'platform' });
      engine.selectBranch(inst.id, 'on-scope', [ev('data', 'diff', `PR #${100 + i}: 스코프 내`)]);
      engine.selectBranch(inst.id, 'clean', [ev('data', 'analysis', '이슈 없음')]);
      engine.selectBranch(inst.id, 'approve', [ev('rule', 'standard', '표준 승인')]);
    }

    // infra 팀: 다양한 패턴 (3회)
    const infraPatterns = [
      ['on-scope', 'blocking', 'reject'],
      ['minor-drift', 'auto-fixable', 'approve-with-nits'],
      ['on-scope', 'needs-discussion', 'request-changes'],
    ];
    for (const [drift, sev, action] of infraPatterns) {
      const inst = engine.startFlow('code-review', { team: 'infra' });
      engine.selectBranch(inst.id, drift);
      engine.selectBranch(inst.id, sev);
      engine.selectBranch(inst.id, action);
    }

    // 패턴 감지
    const patterns = detectPatterns(store, 'code-review', {
      contextKeys: ['team'],
      minFrequency: 5,
    });

    expect(patterns.length).toBe(1);
    expect(patterns[0].contextKey).toBe('team');
    expect(patterns[0].contextValue).toBe('platform');
    expect(patterns[0].frequency).toBe(5);

    // 정책 후보 생성
    const candidates = generatePolicyCandidates(patterns, {
      minFrequency: 5,
      minAverageConfidence: 0.5,
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].rationale).toContain('5회 반복');
  });
});

// ─── 시나리오 4: Reflect — 회고에서 패턴 발견 ─────────────

describe('시나리오 4: Reflect — 스프린트 회고에서 교훈 추출', () => {
  it('회고 서사에 반복 패턴 발견이 기록된다', () => {
    const { engine } = setupEngine();

    const inst = engine.startFlow('reflect', {
      sprint: '2026-W13',
      project: 'qa-sdk',
    });

    engine.selectBranch(inst.id, 'faster', [
      ev('data', 'velocity', '계획 3일 → 실제 2일. AI 코드 생성이 예상보다 빨랐다'),
    ]);

    engine.selectBranch(inst.id, 'high', [ev('data', 'quality', '125 tests 통과, 인시던트 0')]);

    const result = engine.selectBranch(inst.id, 'pattern-found', [
      ev('data', 'analysis', 'event-catalog 패턴이 decision-flow에도 적용 가능'),
      ev('rule', 'three-layer', 'L3: 카탈로그 중앙화 = 범용 패턴'),
    ]);

    expect(result.status).toBe('completed');

    const narrative = buildNarrative({
      instance: result,
      schema: REFLECT_FLOW,
      context: {
        source: 'sprint-retro',
        trigger: '2026-W13 스프린트 회고',
      },
      outcome: {
        artifactType: 'insight',
        artifactRef: 'catalog-centralization-pattern',
      },
      reflection: {
        patternFound:
          '카탈로그 중앙화는 event-catalog뿐 아니라 decision-catalog에도 적용되는 범용 패턴',
        lesson: 'boil-the-lake 원칙이 유효 — AI가 한계 비용을 낮추면 완전 구현이 정답',
        openQuestions: [
          '다음 카탈로그 후보는 무엇인가? (permission-catalog?)',
          '카탈로그 간 교차 참조(prefix_ref 패턴)를 자동화할 수 있는가?',
        ],
      },
    });

    // 회고 구조 검증
    expect(narrative.reflection).toBeDefined();
    expect(narrative.reflection!.patternFound).toContain('범용 패턴');
    expect(narrative.reflection!.lesson).toContain('boil-the-lake');
    expect(narrative.reflection!.openQuestions).toHaveLength(2);

    // 한 줄 요약
    const summary = summarizeNarrative(narrative);
    expect(summary).toContain('스프린트 회고');
    expect(summary).toContain('insight');
  });
});

// ─── 시나리오 5: 코어 gate의 mentalModel이 실제로 연결됨 ──

describe('시나리오 5: mentalModels 연결 검증 — 주석이 아니라 코드에 산다', () => {
  it('CEO Review의 scope-mode gate에 bezos-doors가 연결되어 있다', () => {
    const scopeMode = CEO_REVIEW_FLOW.gates.find((g) => g.id === 'scope-mode');
    expect(scopeMode).toBeDefined();
    expect(scopeMode!.mentalModels).toContain('bezos-doors');
    expect(scopeMode!.mentalModels).toContain('founder-mode');
    expect(scopeMode!.weight).toBe('core');
  });

  it('모든 sprint flow의 gate 중 mentalModels가 있는 비율이 50% 이상이다', () => {
    const allGates = ALL_SPRINT_FLOWS.filter((f) => f.id !== 'sprint-pipeline') // 파이프라인은 subFlow 참조만
      .flatMap((f) => f.gates);

    const withModels = allGates.filter((g) => g.mentalModels && g.mentalModels.length > 0);
    const ratio = withModels.length / allGates.length;

    expect(ratio).toBeGreaterThan(0.5);
  });

  it('Build flow에 boil-the-lake가 연결되어 있다', () => {
    const implScope = BUILD_FLOW.gates.find((g) => g.id === 'implementation-scope');
    expect(implScope).toBeDefined();
    expect(implScope!.mentalModels).toContain('boil-the-lake');
  });

  it('Reflect flow에 three-layer, narrative-coherence가 연결되어 있다', () => {
    const learning = REFLECT_FLOW.gates.find((g) => g.id === 'learning');
    expect(learning).toBeDefined();
    expect(learning!.mentalModels).toContain('three-layer');
    expect(learning!.mentalModels).toContain('narrative-coherence');
  });
});

// ─── 시나리오 6: mentalModel 답변 검증 ──────────────────

describe('시나리오 6: mentalModel 답변 검증 — 인지 모델의 질문에 답했는가', () => {
  it('bezos-doors를 근거에 언급하면 답변한 것으로 인정', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('ceo-review');

    engine.selectBranch(inst.id, 'right-problem', [
      ev('rule', 'munger-inversion', '실패 모드: 카탈로그 없이 성장하면 키 충돌 폭증'),
    ]);
    engine.selectBranch(inst.id, 'extend', [ev('data', 'codebase', '확장')]);
    engine.selectBranch(inst.id, 'pragmatic', [ev('rule', 'convention', '절충')]);
    engine.selectBranch(inst.id, 'selective', [
      ev('rule', 'bezos-doors', 'two-way door — 패키지 추가는 쉽게 되돌림 가능'),
      ev('rule', 'founder-mode', '깊이 관여하되 팀 자율성 유지'),
    ]);
    engine.selectBranch(inst.id, 'low', [ev('data', 'risk', '낮음')]);
    const result = engine.selectBranch(inst.id, 'within-sprint', [
      ev('data', 'temporal-depth', '12개월 뒤에도 이 구조가 유효'),
    ]);

    const validations = validateInstanceModelCoverage(result, CEO_REVIEW_FLOW);

    // premise gate: mentalModels=["munger-inversion"] → 답변함 (evidence source에 munger-inversion)
    const premiseCheck = validations.find((v) => v.gateId === 'premise');
    expect(premiseCheck).toBeDefined();
    expect(premiseCheck!.allAnswered).toBe(true);

    // scope-mode gate: mentalModels=["bezos-doors", "founder-mode"] → 둘 다 답변함
    const scopeCheck = validations.find((v) => v.gateId === 'scope-mode');
    expect(scopeCheck).toBeDefined();
    expect(scopeCheck!.allAnswered).toBe(true);
    expect(scopeCheck!.checks.find((c) => c.modelId === 'bezos-doors')!.answered).toBe(true);
    expect(scopeCheck!.checks.find((c) => c.modelId === 'founder-mode')!.answered).toBe(true);
  });

  it('mentalModel을 언급하지 않으면 미답변 경고', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('ceo-review');

    // 모든 gate에서 mentalModel 언급 없이 진행
    engine.selectBranch(inst.id, 'right-problem', [ev('data', 'analysis', '검증됨')]);
    engine.selectBranch(inst.id, 'extend', [ev('data', 'code', '확장')]);
    engine.selectBranch(inst.id, 'pragmatic', [ev('data', 'plan', '절충')]);
    engine.selectBranch(inst.id, 'selective', [ev('data', 'scope', '선택적')]);
    engine.selectBranch(inst.id, 'low', [ev('data', 'risk', '낮음')]);
    const result = engine.selectBranch(inst.id, 'within-sprint', [ev('data', 'time', '빠름')]);

    const validations = validateInstanceModelCoverage(result, CEO_REVIEW_FLOW);
    const totalUnanswered = validations.reduce((sum, v) => sum + v.unansweredCount, 0);

    // mentalModel 언급이 없으므로 미답변이 여러 개
    expect(totalUnanswered).toBeGreaterThan(0);

    // premise gate: munger-inversion 미답변
    const premiseCheck = validations.find((v) => v.gateId === 'premise');
    expect(premiseCheck!.allAnswered).toBe(false);
  });
});

// ─── 시나리오 7: 산출물 추적 — 커밋/파일/테스트 결과 ─────

describe('시나리오 7: 산출물 추적 — Build 서사에 실제 구현 흔적이 기록된다', () => {
  it('서사에 변경 파일, 커밋, 테스트 결과가 포함된다', () => {
    const { engine } = setupEngine();
    const inst = engine.startFlow('build', {
      project: 'qa-sdk',
      feature: 'event-catalog',
      marginalCostIsLow: true,
    });

    engine.autoSelect(inst.id); // full 자동 선택
    engine.selectBranch(inst.id, 'clean-as-you-go', [
      ev('rule', 'temporal-depth', '기술 부채 즉시 정리'),
    ]);
    const result = engine.selectBranch(inst.id, 'production-ready', [
      ev('data', 'ci', '전체 테스트 통과'),
    ]);

    const narrative = buildNarrative({
      instance: result,
      schema: BUILD_FLOW,
      context: {
        source: 'ceo-review-output',
        trigger: 'event-catalog 전략 계획 승인 → 구현 시작',
      },
      outcome: {
        artifactType: 'package',
        artifactRef: 'packages/event-catalog',
        filesChanged: [
          'packages/event-catalog/src/index.ts',
          'packages/event-catalog/src/auto-track.ts',
          'packages/event-catalog/src/prefix-mapping.ts',
          'packages/event-catalog/package.json',
          'packages/event-catalog/tsconfig.json',
        ],
        commits: ['abc1234', 'def5678'],
        testResult: {
          passed: 137,
          failed: 0,
          skipped: 0,
        },
      },
      reflection: {
        lesson: 'boil-the-lake가 맞았다 — AI로 전체 구현해도 2일밖에 안 걸림',
      },
    });

    // 산출물 추적 필드 검증
    expect(narrative.outcome.filesChanged).toHaveLength(5);
    expect(narrative.outcome.commits).toHaveLength(2);
    expect(narrative.outcome.testResult!.passed).toBe(137);
    expect(narrative.outcome.testResult!.failed).toBe(0);

    // 서사 요약에 패키지 경로 포함
    const summary = summarizeNarrative(narrative);
    expect(summary).toContain('packages/event-catalog');
  });
});

// ─── 시나리오 8: FQ 6차원 좌표가 제품 타당성 프로파일이 된다 ──

describe('시나리오 8: FQ 좌표 비교 — 두 제품의 타당성 프로파일 차이', () => {
  it('event-catalog(강) vs hypothetical-feature(약)의 FQ 좌표가 다르다', () => {
    const { engine } = setupEngine();

    // 강한 제품: 전부 최상위
    const strong = engine.startFlow('forcing-questions', { product: 'event-catalog' });
    engine.selectBranch(strong.id, 'strong');
    engine.selectBranch(strong.id, 'painful-workaround');
    engine.selectBranch(strong.id, 'named-person');
    engine.selectBranch(strong.id, 'defined');
    engine.selectBranch(strong.id, 'observed');
    const strongResult = engine.selectBranch(strong.id, 'more-essential');

    // 약한 제품: 전부 최하위
    const weak = engine.startFlow('forcing-questions', { product: 'hypothetical' });
    engine.selectBranch(weak.id, 'weak');
    engine.selectBranch(weak.id, 'no-alternative');
    engine.selectBranch(weak.id, 'unknown');
    engine.selectBranch(weak.id, 'platform-trap');
    engine.selectBranch(weak.id, 'not-done');
    const weakResult = engine.selectBranch(weak.id, 'declining');

    // 좌표가 다르다 (다른 프로파일)
    expect(strongResult.coordinateAddress).not.toBe(weakResult.coordinateAddress);

    // 비교: 전 gate에서 diverge
    const diff = diffInstances(strongResult, weakResult, FORCING_QUESTIONS_FLOW);
    expect(diff.divergenceCount).toBe(6); // 6차원 전부 다름
    expect(diff.matchCount).toBe(0);
  });
});
