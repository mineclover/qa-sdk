/**
 * 의사결정 모니터 테스트
 *
 * FlowEngine + DecisionMonitor로 실시간 모니터링을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import { FlowEngine } from './engine.js';
import { DecisionMonitor } from './monitor.js';
import type { DecisionAlert } from './monitor.js';
import type { Evidence, FlowSchema } from './types.js';

// ─── fixture ─────────────────────────────────────────────

const TEST_SCHEMA: FlowSchema = {
  id: 'test-decision',
  name: '테스트 결정',
  description: '모니터링 테스트용',
  version: 'v1',
  gates: [
    {
      id: 'scope',
      name: '범위',
      phase: 'evaluate',
      weight: 'core',
      branches: [
        { id: 'small', label: '작은' },
        { id: 'medium', label: '보통' },
        { id: 'large', label: '큰' },
      ],
    },
    {
      id: 'approach',
      name: '접근',
      phase: 'decide',
      branches: [
        { id: 'conservative', label: '보수적' },
        { id: 'aggressive', label: '적극적' },
      ],
    },
  ],
};

function ev(confidence: number): Evidence[] {
  return [{ kind: 'data', source: 'test', content: '테스트', weight: confidence }];
}

function setupWithMonitor(config?: ConstructorParameters<typeof DecisionMonitor>[0]) {
  const engine = new FlowEngine();
  engine.registerSchema(TEST_SCHEMA);
  const monitor = new DecisionMonitor(config);
  engine.addListener(monitor);
  return { engine, monitor };
}

// ─── 메트릭 수집 ─────────────────────────────────────────

describe('메트릭 수집', () => {
  it('시작/완료/선택 수를 정확히 추적한다', () => {
    const { engine, monitor } = setupWithMonitor();

    const i1 = engine.startFlow('test-decision');
    engine.selectBranch(i1.id, 'small', ev(0.8));
    engine.selectBranch(i1.id, 'conservative', ev(0.9));

    const i2 = engine.startFlow('test-decision');
    engine.selectBranch(i2.id, 'medium', ev(0.7));
    engine.selectBranch(i2.id, 'aggressive', ev(0.6));

    const m = monitor.getMetrics('test-decision')!;
    expect(m.totalStarted).toBe(2);
    expect(m.totalCompleted).toBe(2);
    expect(m.totalSelections).toBe(4);
  });

  it('평균 confidence를 계산한다', () => {
    const { engine, monitor } = setupWithMonitor();

    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'small', ev(0.8));
    engine.selectBranch(inst.id, 'conservative', ev(0.6));

    const avg = monitor.averageConfidence('test-decision')!;
    expect(avg).toBeCloseTo(0.7, 1); // (0.8 + 0.6) / 2
  });

  it('코어 gate 선택 분포를 추적한다', () => {
    const { engine, monitor } = setupWithMonitor();

    // small 3회, medium 1회
    for (let i = 0; i < 3; i++) {
      const inst = engine.startFlow('test-decision');
      engine.selectBranch(inst.id, 'small', ev(0.8));
      engine.selectBranch(inst.id, 'conservative', ev(0.9));
    }
    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'medium', ev(0.7));
    engine.selectBranch(inst.id, 'conservative', ev(0.8));

    const m = monitor.getMetrics('test-decision')!;
    const scopeDist = m.coreDistribution.get('scope')!;
    expect(scopeDist.get('small')).toBe(3);
    expect(scopeDist.get('medium')).toBe(1);
  });

  it('도달한 고유 좌표 수를 추적한다', () => {
    const { engine, monitor } = setupWithMonitor();

    // 같은 경로 2회 → 고유 1개
    for (let i = 0; i < 2; i++) {
      const inst = engine.startFlow('test-decision');
      engine.selectBranch(inst.id, 'small', ev(0.8));
      engine.selectBranch(inst.id, 'conservative', ev(0.9));
    }
    // 다른 경로 1회 → 고유 2개
    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'large', ev(0.7));
    engine.selectBranch(inst.id, 'aggressive', ev(0.6));

    expect(monitor.uniqueAddressCount('test-decision')).toBe(2);
  });
});

// ─── 자동화 비율 ─────────────────────────────────────────

describe('자동화 비율', () => {
  it('자동 선택 비율을 추적한다', () => {
    const { engine, monitor } = setupWithMonitor();

    // 정책 등록: scope에서 context.standard=true이면 small 자동 선택
    engine.registerPolicy({
      id: 'auto-small',
      name: '소규모 자동 선택',
      flowId: 'test-decision',
      priority: 100,
      conditions: [{ field: 'context.standard', op: 'eq', value: true }],
      action: { gateId: 'scope', branchId: 'small', confidence: 0.95 },
      rationale: '표준 패턴',
    });

    // 자동 선택 1회 + 수동 1회
    const i1 = engine.startFlow('test-decision', { standard: true });
    engine.autoSelect(i1.id); // scope 자동
    engine.selectBranch(i1.id, 'conservative', ev(0.8)); // approach 수동

    const rate = monitor.automationRate('test-decision')!;
    // autoSelections=1, totalSelections=2 (autoSelect가 selectBranch를 호출하므로 onGateSelected도 2번)
    // 하지만 onAutoSelected는 autoSelect 시에만 1번
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });
});

// ─── 알림 시스템 ─────────────────────────────────────────

describe('알림 시스템', () => {
  it('낮은 confidence에서 경고가 발행된다', () => {
    const collectedAlerts: DecisionAlert[] = [];
    const { engine, monitor } = setupWithMonitor({
      lowConfidenceThreshold: 0.5,
      onAlert: (alert) => collectedAlerts.push(alert),
    });

    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'small', ev(0.2)); // 0.2 < 0.5 → 경고
    engine.selectBranch(inst.id, 'conservative', ev(0.8)); // 0.8 >= 0.5 → 정상

    const lowConfAlerts = monitor.getAlertsByType('low-confidence');
    expect(lowConfAlerts.length).toBe(1);
    expect(lowConfAlerts[0].severity).toBe('warning');
    expect(lowConfAlerts[0].data?.gateId).toBe('scope');
    expect(lowConfAlerts[0].data?.confidence).toBe(0.2);

    // onAlert 콜백도 호출됨
    expect(collectedAlerts.length).toBe(1);
  });

  it('새 결정 영역 도달 시 info 알림이 발행된다', () => {
    const { engine, monitor } = setupWithMonitor();

    // 4회 같은 경로 (3회 이후부터 new-territory 추적)
    for (let i = 0; i < 4; i++) {
      const inst = engine.startFlow('test-decision');
      engine.selectBranch(inst.id, 'small', ev(0.8));
      engine.selectBranch(inst.id, 'conservative', ev(0.9));
    }

    // 새 영역 도달
    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'large', ev(0.7));
    engine.selectBranch(inst.id, 'aggressive', ev(0.6));

    const newTerritoryAlerts = monitor.getAlertsByType('new-territory');
    expect(newTerritoryAlerts.length).toBe(1);
    expect(newTerritoryAlerts[0].severity).toBe('info');
    expect(newTerritoryAlerts[0].message).toContain('새 영역');
  });

  it('코어 gate에서 드문 경로 선택 시 info 알림', () => {
    const { engine, monitor } = setupWithMonitor();

    // small 6회 → 지배적 경로 형성
    for (let i = 0; i < 6; i++) {
      const inst = engine.startFlow('test-decision');
      engine.selectBranch(inst.id, 'small', ev(0.8));
      engine.selectBranch(inst.id, 'conservative', ev(0.9));
    }

    // large 1회 → 드문 경로
    const inst = engine.startFlow('test-decision');
    engine.selectBranch(inst.id, 'large', ev(0.7));
    engine.selectBranch(inst.id, 'aggressive', ev(0.6));

    const rareAlerts = monitor.getAlertsByType('rare-core-path');
    expect(rareAlerts.length).toBe(1);
    expect(rareAlerts[0].data?.gateId).toBe('scope');
    expect(rareAlerts[0].data?.branchId).toBe('large');
  });
});

// ─── 리스너 해제 ─────────────────────────────────────────

describe('리스너 해제', () => {
  it('해제 후에는 이벤트가 수집되지 않는다', () => {
    const engine = new FlowEngine();
    engine.registerSchema(TEST_SCHEMA);
    const monitor = new DecisionMonitor();
    const remove = engine.addListener(monitor);

    const i1 = engine.startFlow('test-decision');
    engine.selectBranch(i1.id, 'small', ev(0.8));
    engine.selectBranch(i1.id, 'conservative', ev(0.9));

    remove(); // 해제

    const i2 = engine.startFlow('test-decision');
    engine.selectBranch(i2.id, 'medium', ev(0.7));
    engine.selectBranch(i2.id, 'aggressive', ev(0.6));

    // 해제 후 이벤트는 수집 안 됨
    expect(monitor.getMetrics('test-decision')!.totalStarted).toBe(1);
    expect(monitor.getMetrics('test-decision')!.totalCompleted).toBe(1);
  });
});
