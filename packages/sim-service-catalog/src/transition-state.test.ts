import { describe, it, expect } from 'vitest';
import { buildServicePrefix } from 'sim-identifier-grammar';
import { transitionState } from './transition-state.js';
import type { CatalogPrefixDefinition, TransitionLog } from './types.js';

function makeCatalog(): CatalogPrefixDefinition {
  return {
    prefix: buildServicePrefix({ namespace: 'sim', category: 'svc', name: 'approval' }),
    versionAxis: { kind: 'version', capacity: 64 },
    refEntries: [
      { version: 'v1', state: 'retired' },
      { version: 'v2', state: 'retired' },
      { version: 'v3', state: 'stable' },
      { version: 'v4-candidate', state: 'candidate' },
    ],
  };
}

describe('transitionState (spec 02 §2.3 + §5)', () => {
  it('candidate → stable: 옛 stable 자동 retired + log 기록', () => {
    const r = transitionState(makeCatalog(), {
      from: { version: 'v4-candidate', state: 'candidate' },
      to: { version: 'v4', state: 'stable' },
    });
    expect(r.catalog.refEntries.find((e) => e.state === 'stable')).toEqual({
      version: 'v4',
      state: 'stable',
    });
    expect(
      r.catalog.refEntries.filter((e) => e.state === 'retired').map((e) => e.version),
    ).toContain('v3');
    expect(r.catalog.refEntries.find((e) => e.state === 'candidate')).toBeUndefined();
    expect(r.log.from.version).toBe('v4-candidate');
    expect(r.log.to.version).toBe('v4');
  });

  it('candidate → retired: 단순 롤백, stable 보존', () => {
    const r = transitionState(makeCatalog(), {
      from: { version: 'v4-candidate', state: 'candidate' },
      to: { version: 'v4-candidate', state: 'retired' },
    });
    expect(r.catalog.refEntries.find((e) => e.state === 'candidate')).toBeUndefined();
    expect(r.catalog.refEntries.find((e) => e.state === 'stable')?.version).toBe('v3');
  });

  it.each([
    ['retired', 'stable'],
    ['retired', 'candidate'],
    ['stable', 'candidate'],
  ] as const)('illegal transition %s → %s → reject', (from, to) => {
    const fromVer = from === 'stable' ? 'v3' : 'v1';
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: fromVer, state: from },
        to: { version: fromVer, state: to },
      }),
    ).toThrow(/illegal transition/);
  });

  it('from entry가 catalog에 없으면 throw', () => {
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: 'v99-candidate', state: 'candidate' },
        to: { version: 'v99', state: 'stable' },
      }),
    ).toThrow(/from entry not found/);
  });

  it('audit hook은 성공 전이에만 호출됨 (실패 전이는 기록 안 함)', () => {
    const recorded: TransitionLog[] = [];
    transitionState(makeCatalog(), {
      from: { version: 'v4-candidate', state: 'candidate' },
      to: { version: 'v4', state: 'stable' },
      onTransition: (log) => recorded.push(log),
    });
    expect(recorded).toHaveLength(1);
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: 'v1', state: 'retired' },
        to: { version: 'v1', state: 'stable' },
        onTransition: (log) => recorded.push(log),
      }),
    ).toThrow();
    expect(recorded).toHaveLength(1);
  });
});
