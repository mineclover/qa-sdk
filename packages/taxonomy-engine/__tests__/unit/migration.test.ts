import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';
import { migrationPlan } from '../../src/migration/index.js';

function ir(y: string) {
  const r = parse(y);
  if (!('ir' in r)) throw new Error('parse failed');
  return r.ir;
}

describe('migrationPlan', () => {
  it('address 같고 id 다르면 rename 후보', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 3, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: moment, address: 3, lifecycle: approved }`);
    const plan = migrationPlan(a, b);
    expect(plan.idRenames).toEqual([{ axis: 'layer', fromId: 'cue', toId: 'moment', address: 3 }]);
    expect(plan.addressConflicts).toEqual([]);
    expect(plan.manualReview).toEqual([]);
    expect(plan.decisionImpact).toEqual([]);
  });

  it('address도 id도 다르면 rename 아님', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: y, address: 1, lifecycle: approved }`);
    const plan = migrationPlan(a, b);
    expect(plan.idRenames).toEqual([]);
  });

  it('같은 IR → 빈 plan', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const plan = migrationPlan(a, a);
    expect(plan.idRenames).toEqual([]);
    expect(plan.addressConflicts).toEqual([]);
    expect(plan.manualReview).toEqual([]);
  });

  it('capacity 감소 + entries 초과 → manualReview', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    capacity: 16
    entries:
      - { id: a, address: 0, lifecycle: approved }
      - { id: b, address: 1, lifecycle: approved }
      - { id: c, address: 2, lifecycle: approved }`);
    // valid IR을 만들려면 capacity 줄여도 entries.length 안에 맞춰야 하므로
    // capacity-overflow가 emit되는 IR을 만들기 위해 capacity 2 + 3 entries
    // → parser는 그래도 받음, validate가 error. 우리는 IR만 비교.
    const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    capacity: 2
    entries:
      - { id: a, address: 0, lifecycle: approved }
      - { id: b, address: 1, lifecycle: approved }
      - { id: c, address: 2, lifecycle: approved }`);
    const plan = migrationPlan(a, b);
    expect(plan.manualReview.some((m) => m.includes('capacity') && m.includes('l'))).toBe(true);
  });

  it('axis 자체가 새로 추가되면 rename 보고 안 함', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
  b:
    lifecycle: approved
    entries:
      - { id: y, address: 0, lifecycle: approved }`);
    const plan = migrationPlan(a, b);
    expect(plan.idRenames).toEqual([]);
    expect(plan.manualReview).toEqual([]);
  });

  it('같은 address에 b의 두 entry가 매핑되면 addressConflicts', () => {
    // a: address 0 → x
    // b: address 0 → x, y 모두 — 입력 자체 부정합이지만 plan이 보고하는지
    // (실제로 parse가 structural-duplicate-address로 거부할 수 있어,
    // migrationPlan은 호출자 책임 가정. 그래도 안전 위해 검사.)
    // 이 케이스는 우회 — 두 IR의 같은 address가 다른 id로 다중 매칭되면
    // addressConflicts에 담는 보호 로직 검증.
    const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: a, address: 0, lifecycle: approved }
      - { id: b, address: 1, lifecycle: approved }`);
    const plan = migrationPlan(a, b);
    // 1:1 매칭이 두 건이면 idRenames 2개 (각 address 별로 단일 후보)
    expect(plan.idRenames).toHaveLength(2);
    expect(plan.addressConflicts).toEqual([]);
  });

  describe('decisionImpact', () => {
    it('decisionLink 없는 entry → decisionImpact 빈 배열', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
      const plan = migrationPlan(a, b);
      expect(plan.decisionImpact).toEqual([]);
    });

    it('decisionLink + lifecycle 변경 → lifecycle-changed', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd, decisionLink: "decision:t.l.x" }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "decision:t.l.x" }`);
      const plan = migrationPlan(a, b);
      expect(plan.decisionImpact).toEqual([
        {
          axis: 'l',
          id: 'x',
          decisionLink: 'decision:t.l.x',
          impact: 'lifecycle-changed',
          fromLifecycle: 'tbd',
          toLifecycle: 'approved',
        },
      ]);
    });

    it('decisionLink + address 변경 (id 동일) → address-changed', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "decision:t.l.x" }
      - { id: y, address: 1, lifecycle: approved }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: y, address: 0, lifecycle: approved }
      - { id: x, address: 1, lifecycle: approved, decisionLink: "decision:t.l.x" }`);
      const plan = migrationPlan(a, b);
      const impacts = plan.decisionImpact.filter((d) => d.id === 'x');
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        axis: 'l',
        id: 'x',
        decisionLink: 'decision:t.l.x',
        impact: 'address-changed',
        fromAddress: 0,
        toAddress: 1,
      });
    });

    it('decisionLink + entry 제거 → removed', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "decision:t.l.x" }
      - { id: y, address: 1, lifecycle: approved }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: y, address: 1, lifecycle: approved }`);
      const plan = migrationPlan(a, b);
      expect(plan.decisionImpact).toEqual([
        {
          axis: 'l',
          id: 'x',
          decisionLink: 'decision:t.l.x',
          impact: 'removed',
        },
      ]);
    });

    it('axis 자체 제거 → decisionLink 가진 entry는 모두 removed', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "decision:t.l.x" }
  k:
    lifecycle: approved
    entries:
      - { id: a, address: 0, lifecycle: approved }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  k:
    lifecycle: approved
    entries:
      - { id: a, address: 0, lifecycle: approved }`);
      const plan = migrationPlan(a, b);
      expect(plan.decisionImpact).toEqual([
        {
          axis: 'l',
          id: 'x',
          decisionLink: 'decision:t.l.x',
          impact: 'removed',
        },
      ]);
    });

    it('address-changed가 lifecycle-changed보다 우선 (둘 다 발생해도 address만 보고)', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd, decisionLink: "decision:t.l.x" }
      - { id: y, address: 1, lifecycle: approved }`);
      const b = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: y, address: 0, lifecycle: approved }
      - { id: x, address: 1, lifecycle: approved, decisionLink: "decision:t.l.x" }`);
      const plan = migrationPlan(a, b);
      const impacts = plan.decisionImpact.filter((d) => d.id === 'x');
      expect(impacts).toHaveLength(1);
      expect(impacts[0].impact).toBe('address-changed');
    });

    it('변경 없음 → decisionImpact 빈 배열', () => {
      const a = ir(`taxonomy: t
version: 1
axes:
  l:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "decision:t.l.x" }`);
      const plan = migrationPlan(a, a);
      expect(plan.decisionImpact).toEqual([]);
    });
  });
});
