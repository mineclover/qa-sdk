// @def.doc definition-state-model

import { describe, it, expect } from 'vitest';
import {
  createInstance,
  transition,
  availableTransitions,
  computeDistribution,
  DOC_LIFECYCLE_MACHINE,
  SPEC_IMPL_MACHINE,
  CONVENTION_MACHINE,
  SYNC_MACHINE,
} from './state-model.js';

describe('StateMachine 엔진', () => {
  it('초기 상태에서 인스턴스를 생성한다', () => {
    const inst = createInstance(DOC_LIFECYCLE_MACHINE, 'gate-api');
    expect(inst.current).toBe('draft');
    expect(inst.history).toHaveLength(0);
  });

  it('유효한 전이를 실행한다', () => {
    let inst = createInstance(DOC_LIFECYCLE_MACHINE, 'gate-api');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'review');
    expect(inst.current).toBe('review');
    expect(inst.history).toHaveLength(1);
    expect(inst.history[0]!.label).toBe('검토 요청');
  });

  it('무효한 전이는 에러를 던진다', () => {
    const inst = createInstance(DOC_LIFECYCLE_MACHINE, 'gate-api');
    expect(() => transition(DOC_LIFECYCLE_MACHINE, inst, 'deprecated')).toThrow('전이 불가');
  });

  it('전체 lifecycle 경로를 따른다', () => {
    let inst = createInstance(DOC_LIFECYCLE_MACHINE, 'old-spec');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'review');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'approved');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'deprecated');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'archived');
    expect(inst.current).toBe('archived');
    expect(inst.history).toHaveLength(4);
  });

  it('반려 후 재검토가 가능하다', () => {
    let inst = createInstance(DOC_LIFECYCLE_MACHINE, 'draft-spec');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'review');
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'draft'); // 반려
    inst = transition(DOC_LIFECYCLE_MACHINE, inst, 'review'); // 재검토
    expect(inst.current).toBe('review');
    expect(inst.history).toHaveLength(3);
  });
});

describe('availableTransitions', () => {
  it('현재 상태에서 가능한 전이를 반환한다', () => {
    const transitions = availableTransitions(DOC_LIFECYCLE_MACHINE, 'review');
    expect(transitions.map((t) => t.to)).toEqual(expect.arrayContaining(['approved', 'draft']));
  });

  it('terminal 상태에서는 전이가 없다', () => {
    const transitions = availableTransitions(DOC_LIFECYCLE_MACHINE, 'archived');
    expect(transitions).toHaveLength(0);
  });
});

describe('computeDistribution', () => {
  it('상태 분포를 계산한다', () => {
    const instances = [
      createInstance(DOC_LIFECYCLE_MACHINE, 'a'),
      { ...createInstance(DOC_LIFECYCLE_MACHINE, 'b'), current: 'approved' as const },
      { ...createInstance(DOC_LIFECYCLE_MACHINE, 'c'), current: 'approved' as const },
      { ...createInstance(DOC_LIFECYCLE_MACHINE, 'd'), current: 'deprecated' as const },
    ];
    const dist = computeDistribution('doc-lifecycle', instances);
    expect(dist.total).toBe(4);
    expect(dist.distribution['draft']).toBe(1);
    expect(dist.distribution['approved']).toBe(2);
    expect(dist.distribution['deprecated']).toBe(1);
  });
});

describe('사전 정의 머신', () => {
  it('spec-impl: designed → implementing → implemented → verified → source-referenced', () => {
    let inst = createInstance(SPEC_IMPL_MACHINE, 'tracker-types');
    inst = transition(SPEC_IMPL_MACHINE, inst, 'implementing');
    inst = transition(SPEC_IMPL_MACHINE, inst, 'implemented');
    inst = transition(SPEC_IMPL_MACHINE, inst, 'verified');
    inst = transition(SPEC_IMPL_MACHINE, inst, 'source-referenced');
    expect(inst.current).toBe('source-referenced');
  });

  it('convention: unverified → partial → compliant → violated (회귀)', () => {
    let inst = createInstance(CONVENTION_MACHINE, 'error-handling');
    inst = transition(CONVENTION_MACHINE, inst, 'partial');
    inst = transition(CONVENTION_MACHINE, inst, 'compliant');
    inst = transition(CONVENTION_MACHINE, inst, 'violated'); // 회귀
    inst = transition(CONVENTION_MACHINE, inst, 'compliant'); // 수정
    expect(inst.current).toBe('compliant');
    expect(inst.history).toHaveLength(4);
  });

  it('sync: out-of-sync → syncing → synced → drift → syncing → synced', () => {
    let inst = createInstance(SYNC_MACHINE, 'definition-db');
    inst = transition(SYNC_MACHINE, inst, 'syncing');
    inst = transition(SYNC_MACHINE, inst, 'synced');
    inst = transition(SYNC_MACHINE, inst, 'drift-detected');
    inst = transition(SYNC_MACHINE, inst, 'syncing');
    inst = transition(SYNC_MACHINE, inst, 'synced');
    expect(inst.current).toBe('synced');
  });
});
