// @def.boundary sim-canary-controller
// InMemorySimServiceCatalog mutation 검증 — seedCandidate, promoteCandidate.

import { describe, expect, it } from 'vitest';
import { InMemorySimServiceCatalog } from './catalog.provider.js';
import type { CatalogPrefixDefinition } from 'sim-service-catalog';

function makeFixture(): Record<string, CatalogPrefixDefinition> {
  return {
    'sim.svc.approval': {
      prefix: 'sim.svc.approval',
      versionAxis: { kind: 'version', capacity: 16 },
      refEntries: [
        { version: 'v1', state: 'retired' },
        { version: 'v2', state: 'retired' },
        { version: 'v3', state: 'stable' },
      ],
    },
  };
}

describe('InMemorySimServiceCatalog', () => {
  it('초기 상태 — v3=stable, v4 부재 (시나리오 9 setup 가정)', async () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    const t = await c.getCurrentTopology('sim.svc.approval');
    expect(t.stable.value).toBe(3);
    expect(t.candidate).toBeNull();
  });

  it('seedCandidate(4) → candidate v4 등록', async () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    c.seedCandidate('sim.svc.approval', 4);
    const t = await c.getCurrentTopology('sim.svc.approval');
    expect(t.candidate?.value).toBe(4);
    expect(c.hasCandidate('sim.svc.approval')).toBe(true);
  });

  it('seedCandidate 중복 호출 → throw (candidate ≤ 1 invariant)', () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    c.seedCandidate('sim.svc.approval', 4);
    expect(() => c.seedCandidate('sim.svc.approval', 5)).toThrow(/already has candidate/);
  });

  it('promoteCandidate → candidate→stable, 옛 stable→retired', async () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    c.seedCandidate('sim.svc.approval', 4);
    c.promoteCandidate('sim.svc.approval');
    const t = await c.getCurrentTopology('sim.svc.approval');
    expect(t.stable.value).toBe(4);
    expect(t.candidate).toBeNull();
    expect(t.retired.some((r) => r.value === 3)).toBe(true);
  });

  it('promoteCandidate without candidate → throw (idempotent caller 책임)', () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    expect(() => c.promoteCandidate('sim.svc.approval')).toThrow(/no candidate/);
  });

  it('unknown prefix → throw with allowed list', async () => {
    const c = new InMemorySimServiceCatalog(makeFixture());
    await expect(c.getCurrentTopology('sim.svc.unknown')).rejects.toThrow(
      /allowed: sim.svc.approval/,
    );
  });
});
