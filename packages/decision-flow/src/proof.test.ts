/**
 * 의사결정 좌표계 증명
 *
 * 이 테스트는 시스템의 핵심 주장을 실제 데이터로 증명한다.
 * 각 describe 블록이 하나의 "서사 → 증명 → 결론" 단위.
 */

import { describe, it, expect } from 'vitest';
import { FlowSchemaBuilder } from './schema.js';
import { FlowEngine } from './engine.js';
import { MemoryInstanceStore } from './instance-store.js';
import { buildCoordinateSpace, encodeSelections, decodePath } from './coordinate.js';
import { detectPatterns, generatePolicyCandidates } from './policy-learning.js';
import { diffInstances, gateDistribution } from './comparison.js';
import { analyzeGateStructure, identifyCoreGates } from './core-analysis.js';
import { checkOrthogonality, extractPhaseEvidencePairs } from './orthogonality.js';
import {
  buildNarrative,
  extractPivotPoints,
  summarizeNarrative,
  findNarrativeDivergence,
} from './narrative.js';
import { AXIS_META } from './vocabulary.js';
import type { Evidence, FlowSchema } from './types.js';

// ─── 공통 fixture ────────────────────────────────────────

/** 소프트웨어 설계 의사결정 플로우 — 실제 반복 패턴을 모델링 */
const DESIGN_DECISION_SCHEMA: FlowSchema = {
  id: 'component-design',
  name: '컴포넌트 설계 결정',
  description: '새 컴포넌트를 추가할 때 반복되는 의사결정',
  version: 'v1',
  gates: [
    {
      id: 'scope',
      name: '범위 결정',
      phase: 'evaluate',
      weight: 'core',
      affects: [
        { gateId: 'architecture', kind: 'constrains' },
        { gateId: 'testing', kind: 'constrains' },
      ],
      branches: [
        { id: 'new', label: '신규 생성' },
        { id: 'extend', label: '기존 확장' },
        { id: 'replace', label: '교체' },
      ],
    },
    {
      id: 'architecture',
      name: '아키텍처 선택',
      phase: 'decide',
      weight: 'structural',
      affects: [{ gateId: 'testing', kind: 'enables' }],
      branches: [
        { id: 'standalone', label: '독립 모듈' },
        { id: 'integrated', label: '기존 통합' },
        { id: 'layered', label: '계층 분리' },
      ],
    },
    {
      id: 'testing',
      name: '테스트 전략',
      phase: 'plan',
      weight: 'tactical',
      branches: [
        { id: 'unit', label: '단위 테스트' },
        { id: 'integration', label: '통합 테스트' },
        { id: 'e2e', label: 'E2E 테스트' },
      ],
    },
  ],
};

function dataEvidence(content: string, weight = 0.8): Evidence {
  return { kind: 'data', source: 'analysis', content, weight };
}

function ruleEvidence(content: string, weight = 0.9): Evidence {
  return { kind: 'rule', source: 'convention', content, weight };
}

function precedentEvidence(content: string, weight = 0.7): Evidence {
  return { kind: 'precedent', source: 'history', content, weight };
}

function intuitionEvidence(content: string, weight = 0.5): Evidence {
  return { kind: 'intuition', source: 'experience', content, weight };
}

// ─── 서사 1: 축은 결정의 구조를 압축한다 ─────────────────

describe('서사 1: 차원 축소 — 3개 축이 27가지 결정 경로를 1D 주소로 압축한다', () => {
  it('3×3×3 = 27 경로가 하나의 정수 주소 공간을 형성한다', () => {
    const space = buildCoordinateSpace(DESIGN_DECISION_SCHEMA);

    expect(space.shape).toEqual([3, 3, 3]);
    expect(space.totalPaths).toBe(27);
    expect(space.labels).toEqual(['scope', 'architecture', 'testing']);
  });

  it('같은 선택은 항상 같은 주소를 낸다 (결정론적 인코딩)', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    // 동일 결정을 두 번 실행
    const run = () => {
      const inst = engine.startFlow('component-design');
      engine.selectBranch(inst.id, 'new', [dataEvidence('신규 요구사항')]);
      engine.selectBranch(inst.id, 'standalone', [ruleEvidence('독립성 원칙')]);
      return engine.selectBranch(inst.id, 'unit', [dataEvidence('빠른 피드백')]);
    };

    const a = run();
    const b = run();
    expect(a.coordinateAddress).toBe(b.coordinateAddress);
    expect(a.coordinateAddress).toBeDefined();
  });

  it('다른 선택은 다른 주소를 낸다 (식별력)', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const runWith = (scope: string, arch: string, test: string) => {
      const inst = engine.startFlow('component-design');
      engine.selectBranch(inst.id, scope);
      engine.selectBranch(inst.id, arch);
      return engine.selectBranch(inst.id, test);
    };

    const pathA = runWith('new', 'standalone', 'unit');
    const pathB = runWith('extend', 'integrated', 'integration');
    const pathC = runWith('replace', 'layered', 'e2e');

    expect(pathA.coordinateAddress).not.toBe(pathB.coordinateAddress);
    expect(pathB.coordinateAddress).not.toBe(pathC.coordinateAddress);
    expect(pathA.coordinateAddress).not.toBe(pathC.coordinateAddress);
  });

  it('주소에서 원래 결정을 복원할 수 있다 (라운드트립)', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const inst = engine.startFlow('component-design');
    engine.selectBranch(inst.id, 'extend');
    engine.selectBranch(inst.id, 'layered');
    const result = engine.selectBranch(inst.id, 'integration');

    const decoded = decodePath(DESIGN_DECISION_SCHEMA, result.coordinateAddress!);
    expect(decoded.selections).toEqual({
      scope: 'extend',
      architecture: 'layered',
      testing: 'integration',
    });
  });
});

// ─── 서사 2: 반복 결정에서 패턴이 드러난다 ─────────────────

describe('서사 2: 패턴 감지 — 같은 맥락의 반복 결정이 자동 정책 후보가 된다', () => {
  it('infra 팀이 5회 연속 같은 결정을 하면 패턴으로 감지된다', () => {
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    // infra 팀: 항상 extend → integrated → integration (5회)
    for (let i = 0; i < 5; i++) {
      const inst = engine.startFlow('component-design', { team: 'infra' });
      engine.selectBranch(inst.id, 'extend', [ruleEvidence('기존 인프라 확장')]);
      engine.selectBranch(inst.id, 'integrated', [ruleEvidence('통합 필수')]);
      engine.selectBranch(inst.id, 'integration', [dataEvidence('통합 테스트')]);
    }

    // frontend 팀: 다양한 결정 (패턴 없음)
    const frontendChoices = [
      ['new', 'standalone', 'unit'],
      ['new', 'layered', 'e2e'],
      ['extend', 'standalone', 'unit'],
    ];
    for (const [s, a, t] of frontendChoices) {
      const inst = engine.startFlow('component-design', { team: 'frontend' });
      engine.selectBranch(inst.id, s);
      engine.selectBranch(inst.id, a);
      engine.selectBranch(inst.id, t);
    }

    const patterns = detectPatterns(store, 'component-design', {
      contextKeys: ['team'],
      minFrequency: 5,
    });

    // infra 팀의 반복 패턴만 감지
    expect(patterns.length).toBe(1);
    expect(patterns[0].contextKey).toBe('team');
    expect(patterns[0].contextValue).toBe('infra');
    expect(patterns[0].frequency).toBe(5);
    expect(patterns[0].averageConfidence).toBeGreaterThan(0.7);
  });

  it('감지된 패턴에서 정책 후보가 자동 생성된다', () => {
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    for (let i = 0; i < 6; i++) {
      const inst = engine.startFlow('component-design', { team: 'infra' });
      engine.selectBranch(inst.id, 'extend', [ruleEvidence('확장')]);
      engine.selectBranch(inst.id, 'integrated', [ruleEvidence('통합')]);
      engine.selectBranch(inst.id, 'integration', [dataEvidence('테스트')]);
    }

    const patterns = detectPatterns(store, 'component-design', {
      contextKeys: ['team'],
    });
    const candidates = generatePolicyCandidates(patterns, {
      minFrequency: 5,
      minAverageConfidence: 0.7,
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].status).toBe('candidate');
    expect(candidates[0].rationale).toContain('6회 반복');
  });
});

// ─── 서사 3: 두 결정의 차이를 축으로 설명한다 ─────────────

describe('서사 3: 벡터 차이 — 어느 축에서 갈렸는지 식별한다', () => {
  it('scope 축에서 갈린 두 결정의 divergence point를 정확히 찾는다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    // A: new → standalone → unit (데이터 근거)
    const instA = engine.startFlow('component-design');
    engine.selectBranch(instA.id, 'new', [dataEvidence('신규 요구')]);
    engine.selectBranch(instA.id, 'standalone', [dataEvidence('독립 배포')]);
    const resultA = engine.selectBranch(instA.id, 'unit', [dataEvidence('빠른 피드백')]);

    // B: extend → standalone → unit (선례 근거)
    const instB = engine.startFlow('component-design');
    engine.selectBranch(instB.id, 'extend', [precedentEvidence('기존 패턴 따름')]);
    engine.selectBranch(instB.id, 'standalone', [precedentEvidence('검증된 구조')]);
    const resultB = engine.selectBranch(instB.id, 'unit', [precedentEvidence('기존 관례')]);

    const diff = diffInstances(resultA, resultB, DESIGN_DECISION_SCHEMA);

    // scope에서 갈림
    expect(diff.divergencePoint).toBeDefined();
    expect(diff.divergencePoint!.gateId).toBe('scope');
    expect(diff.divergencePoint!.branchA).toBe('new');
    expect(diff.divergencePoint!.branchB).toBe('extend');

    // scope는 core gate이므로 강조
    expect(diff.divergencePoint!.emphasis).toBe('core');
    expect(diff.coreDivergences.length).toBe(1);

    // 근거 유형이 다르다 (data vs precedent)
    expect(diff.divergencePoint!.evidenceDiff.hasDifference).toBe(true);
  });

  it('같은 결정은 divergence가 0이다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const run = () => {
      const inst = engine.startFlow('component-design');
      engine.selectBranch(inst.id, 'new', [dataEvidence('같은 이유')]);
      engine.selectBranch(inst.id, 'standalone', [dataEvidence('같은 이유')]);
      return engine.selectBranch(inst.id, 'unit', [dataEvidence('같은 이유')]);
    };

    const diff = diffInstances(run(), run(), DESIGN_DECISION_SCHEMA);
    expect(diff.divergenceCount).toBe(0);
    expect(diff.matchCount).toBe(3);
  });
});

// ─── 서사 4: 코어 gate가 구조적 영향을 결정한다 ──────────

describe('서사 4: 코어 식별 — scope가 코어인 이유를 구조적으로 증명한다', () => {
  it('scope가 코어 gate로 식별되고 coreScore가 가장 높다', () => {
    const profiles = analyzeGateStructure(DESIGN_DECISION_SCHEMA);
    const coreGates = identifyCoreGates(profiles);

    const scopeProfile = profiles.find((p) => p.gateId === 'scope')!;
    const testProfile = profiles.find((p) => p.gateId === 'testing')!;

    // scope: core weight + 2 direct impacts → 가장 높은 coreScore
    expect(scopeProfile.weight).toBe('core');
    expect(scopeProfile.directImpact).toBe(2);
    expect(scopeProfile.coreScore).toBeGreaterThanOrEqual(testProfile.coreScore);

    // 코어 gate 목록에 scope가 포함
    const coreGateIds = coreGates.map((g) => g.gateId);
    expect(coreGateIds).toContain('scope');

    // testing은 tactical → 코어가 아님
    expect(coreGateIds).not.toContain('testing');
  });
});

// ─── 서사 5: 축 간 직교성이 실제 데이터에서도 유지된다 ─────

describe('서사 5: 직교성 검증 — 축이 서로 독립적임을 데이터로 확인한다', () => {
  it('다양한 phase에서 다양한 evidence를 사용하면 직교성이 유지된다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const instances = [];
    const evidenceTypes = [dataEvidence, ruleEvidence, precedentEvidence, intuitionEvidence];
    const scopes = ['new', 'extend', 'replace'];
    const archs = ['standalone', 'integrated', 'layered'];
    const tests = ['unit', 'integration', 'e2e'];

    // 다양한 조합으로 30건 생성
    for (let i = 0; i < 30; i++) {
      const inst = engine.startFlow('component-design');
      const ev = evidenceTypes[i % evidenceTypes.length];
      engine.selectBranch(inst.id, scopes[i % 3], [ev('이유 ' + i)]);
      engine.selectBranch(inst.id, archs[(i + 1) % 3], [ev('이유 ' + i)]);
      instances.push(engine.selectBranch(inst.id, tests[(i + 2) % 3], [ev('이유 ' + i)]));
    }

    // gate → phase 매핑
    const gatePhases = new Map<string, string>();
    for (const gate of DESIGN_DECISION_SCHEMA.gates) {
      gatePhases.set(gate.id, gate.phase);
    }

    const pairs = extractPhaseEvidencePairs(instances, gatePhases);
    const result = checkOrthogonality('cognitive_phase', 'evidence_kind', pairs);

    // 다양한 조합이므로 직교성 유지
    expect(result.isOrthogonal).toBe(true);
    expect(result.cramersV).toBeLessThan(0.3);
    expect(result.warning).toBeUndefined();
    expect(result.sampleSize).toBeGreaterThan(30);
  });

  it('특정 phase에서 항상 같은 evidence를 쓰면 직교성이 깨진다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const instances = [];
    // evaluate(scope) → 항상 data, decide(arch) → 항상 rule, plan(test) → 항상 precedent
    for (let i = 0; i < 20; i++) {
      const inst = engine.startFlow('component-design');
      engine.selectBranch(inst.id, ['new', 'extend', 'replace'][i % 3], [
        dataEvidence('분석 결과'),
      ]);
      engine.selectBranch(inst.id, ['standalone', 'integrated', 'layered'][i % 3], [
        ruleEvidence('규칙'),
      ]);
      instances.push(
        engine.selectBranch(inst.id, ['unit', 'integration', 'e2e'][i % 3], [
          precedentEvidence('선례'),
        ]),
      );
    }

    const gatePhases = new Map<string, string>();
    for (const gate of DESIGN_DECISION_SCHEMA.gates) {
      gatePhases.set(gate.id, gate.phase);
    }

    const pairs = extractPhaseEvidencePairs(instances, gatePhases);
    const result = checkOrthogonality('cognitive_phase', 'evidence_kind', pairs);

    // phase마다 evidence가 고정 → 직교성 위반
    expect(result.cramersV).toBeGreaterThan(0.7);
    expect(result.isOrthogonal).toBe(false);
    expect(result.warning).toBeDefined();
  });
});

// ─── 서사 6: 축 메타데이터가 설계 근거를 보존한다 ─────────

describe('서사 6: 사전 설계 — 왜 이 축인가의 근거가 코드에 살아있다', () => {
  it('11개 축 전부에 설명력 메타데이터가 있다', () => {
    const axisIds = [
      'cognitive_phase',
      'flow_type',
      'evidence_kind',
      'mental_model',
      'escalation_type',
      'decision_outcome',
      'scope_mode',
      'reversibility',
      'magnitude',
      'confidence_band',
      'forcing_question',
    ];

    for (const id of axisIds) {
      const meta = AXIS_META[id];
      expect(meta, `${id}의 메타데이터가 없다`).toBeDefined();
      expect(meta.role).toMatch(/^(primary|secondary|contextual)$/);
      expect(meta.explains.length).toBeGreaterThan(0);
      expect(meta.designRationale.length).toBeGreaterThan(0);
      expect(meta.orthogonalTo.length).toBeGreaterThan(0);
    }
  });

  it('Primary 축이 3개, Secondary가 4개, Contextual이 4개다', () => {
    const roles = Object.values(AXIS_META).map((m) => m.role);

    expect(roles.filter((r) => r === 'primary').length).toBe(3);
    expect(roles.filter((r) => r === 'secondary').length).toBe(4);
    expect(roles.filter((r) => r === 'contextual').length).toBe(4);
  });

  it('직교 선언이 대칭이다 (A→B이면 B→A)', () => {
    for (const [axisId, meta] of Object.entries(AXIS_META)) {
      for (const otherAxisId of meta.orthogonalTo) {
        const otherMeta = AXIS_META[otherAxisId];
        expect(
          otherMeta?.orthogonalTo.includes(axisId),
          `${axisId} → ${otherAxisId} 직교 선언이 있지만, 역방향 ${otherAxisId} → ${axisId}가 없다`,
        ).toBe(true);
      }
    }
  });
});

// ─── 서사 7: 결정이 모여 서사가 된다 ──────────────────────

describe('서사 7: 서사 구조 — 개별 결정이 모여 결정 공간에 도달하고 서사로 기록된다', () => {
  it('배경 → 여정 → 도달 → 산출 — 서사의 완전한 구조', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const inst = engine.startFlow('component-design', { team: 'platform' });
    engine.selectBranch(inst.id, 'new', [dataEvidence('성능 요구사항 불충족')]);
    engine.selectBranch(inst.id, 'layered', [ruleEvidence('관심사 분리 원칙')]);
    const result = engine.selectBranch(inst.id, 'integration', [dataEvidence('API 경계 검증')]);

    const narrative = buildNarrative({
      instance: result,
      schema: DESIGN_DECISION_SCHEMA,
      context: {
        source: 'performance-alert',
        trigger: '기존 모듈의 응답 시간이 SLA를 초과',
      },
      outcome: {
        artifactType: 'module',
        artifactRef: 'packages/new-component',
      },
    });

    // 배경: 왜 필요했는가
    expect(narrative.context.trigger).toContain('SLA');

    // 여정: 3개의 gate를 거쳤다
    expect(narrative.journey.length).toBe(3);
    expect(narrative.journey[0].gateId).toBe('scope');
    expect(narrative.journey[0].choice).toBe('new');
    expect(narrative.journey[0].isCore).toBe(true);
    expect(narrative.journey[0].reason).toContain('성능 요구사항');

    // 도달: 결정 공간의 한 점
    expect(narrative.destination.address).toBeDefined();
    expect(narrative.destination.selections.scope).toBe('new');
    expect(narrative.destination.coreSelections.scope).toBe('new');

    // 산출: 무엇이 만들어졌는가
    expect(narrative.outcome.artifactType).toBe('module');
  });

  it('코어 전환점만 추출하면 서사의 핵심이 보인다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const inst = engine.startFlow('component-design');
    engine.selectBranch(inst.id, 'replace', [dataEvidence('레거시 교체')]);
    engine.selectBranch(inst.id, 'standalone', [ruleEvidence('독립 배포')]);
    const result = engine.selectBranch(inst.id, 'e2e', [dataEvidence('전체 검증')]);

    const narrative = buildNarrative({
      instance: result,
      schema: DESIGN_DECISION_SCHEMA,
      context: { source: 'tech-debt', trigger: '레거시 모듈 교체 결정' },
      outcome: { artifactType: 'module', artifactRef: 'packages/replacement' },
    });

    // 코어 전환점 = scope만 (weight: "core")
    const pivots = extractPivotPoints(narrative);
    expect(pivots.length).toBe(1);
    expect(pivots[0].choice).toBe('replace');

    // 한 줄 요약
    const summary = summarizeNarrative(narrative);
    expect(summary).toContain('레거시 모듈 교체');
    expect(summary).toContain('범위 결정=replace');
    expect(summary).toContain('packages/replacement');
  });

  it('두 서사의 분기점 — 같은 출발, 다른 도달', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    // 서사 A: new → layered → integration
    const instA = engine.startFlow('component-design');
    engine.selectBranch(instA.id, 'new', [dataEvidence('신규 성능 요구')]);
    engine.selectBranch(instA.id, 'layered', [ruleEvidence('분리 원칙')]);
    const resultA = engine.selectBranch(instA.id, 'integration', [dataEvidence('API 검증')]);

    // 서사 B: extend → layered → integration (scope에서 갈림)
    const instB = engine.startFlow('component-design');
    engine.selectBranch(instB.id, 'extend', [precedentEvidence('기존 패턴 유지')]);
    engine.selectBranch(instB.id, 'layered', [ruleEvidence('분리 원칙')]);
    const resultB = engine.selectBranch(instB.id, 'integration', [dataEvidence('API 검증')]);

    const narA = buildNarrative({
      instance: resultA,
      schema: DESIGN_DECISION_SCHEMA,
      context: { source: 'perf', trigger: '성능 SLA 초과' },
      outcome: { artifactType: 'module', artifactRef: 'new-mod' },
    });
    const narB = buildNarrative({
      instance: resultB,
      schema: DESIGN_DECISION_SCHEMA,
      context: { source: 'perf', trigger: '성능 SLA 초과' },
      outcome: { artifactType: 'extension', artifactRef: 'ext-mod' },
    });

    const divergence = findNarrativeDivergence(narA, narB);

    // 분기점: scope에서 갈림
    expect(divergence).not.toBeNull();
    expect(divergence!.gateId).toBe('scope');
    expect(divergence!.choiceA).toBe('new');
    expect(divergence!.choiceB).toBe('extend');
    expect(divergence!.isCore).toBe(true);

    // 이유가 다르다
    expect(divergence!.reasonA).toContain('신규 성능 요구');
    expect(divergence!.reasonB).toContain('기존 패턴 유지');
  });

  it('회고는 나중에 추가할 수 있다 — 서사는 계속 쌓인다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(DESIGN_DECISION_SCHEMA);

    const inst = engine.startFlow('component-design');
    engine.selectBranch(inst.id, 'new', [dataEvidence('요구')]);
    engine.selectBranch(inst.id, 'standalone', [ruleEvidence('원칙')]);
    const result = engine.selectBranch(inst.id, 'unit', [dataEvidence('피드백')]);

    // 처음에는 회고 없이 기록
    const narrative = buildNarrative({
      instance: result,
      schema: DESIGN_DECISION_SCHEMA,
      context: { source: 'feature', trigger: '신규 기능 요청' },
      outcome: { artifactType: 'module', artifactRef: 'new-feature' },
    });
    expect(narrative.reflection).toBeUndefined();

    // 나중에 회고 추가 (새 서사 생성 — 기존 서사는 불변)
    const narrativeWithReflection = buildNarrative({
      instance: result,
      schema: DESIGN_DECISION_SCHEMA,
      context: { source: 'feature', trigger: '신규 기능 요청' },
      outcome: { artifactType: 'module', artifactRef: 'new-feature' },
      reflection: {
        patternFound: '신규 기능은 항상 standalone + unit으로 시작하는 경향',
        lesson: 'standalone이 맞지만, 나중에 통합 필요성이 높으므로 인터페이스를 먼저 정의할 것',
        openQuestions: ['standalone에서 integrated로 전환하는 비용은?'],
      },
    });

    expect(narrativeWithReflection.reflection).toBeDefined();
    expect(narrativeWithReflection.reflection!.patternFound).toContain('standalone');
    expect(narrativeWithReflection.reflection!.openQuestions).toHaveLength(1);
  });
});
