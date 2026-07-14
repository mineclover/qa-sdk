// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it, vi } from 'vitest';
import { DisjointUnionIndex } from 'weighted-index';

import { MarginalDensityReadModelAdapter } from './density.read-model.js';
import {
  KeyObservationQueryPort,
  type KeyObservationRow,
} from '../../application/ports/key-observation.query.port.js';
import {
  PrefixCatalogQueryPort,
  type PrefixDescriptor,
} from '../../application/ports/prefix-catalog.query.port.js';
import {
  PrefixNotFoundException,
  PrefixVersionMismatchException,
} from '../../domain/density.exceptions.js';

const USER_LABELS = ['login', 'logout', 'refresh', 'rotate'] as const;
const DEPT_LABELS = ['assign', 'manage', 'budget'] as const;

const mockUnion = new DisjointUnionIndex([
  { kind: 'user_action', shape: [USER_LABELS.length], labels: ['action'] },
  { kind: 'dept_action', shape: [DEPT_LABELS.length], labels: ['action'] },
]);

const fixedPrefix: PrefixDescriptor = {
  id: 'sim.bitmap',
  version: 'uv1',
  union: mockUnion,
  axes: [
    { name: 'user_action', labels: USER_LABELS },
    { name: 'dept_action', labels: DEPT_LABELS },
  ],
  coordsOneBased: true,
};

class StubObservations extends KeyObservationQueryPort {
  constructor(private readonly rows: KeyObservationRow[]) {
    super();
  }
  async listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]> {
    return this.rows.filter((r) => r.prefix_id === args.prefix_id && r.version === args.version);
  }
}

class StubCatalog extends PrefixCatalogQueryPort {
  constructor(private readonly desc: PrefixDescriptor | null) {
    super();
  }
  async resolve(): Promise<PrefixDescriptor | null> {
    return this.desc;
  }
}

function makeAdapter(rows: KeyObservationRow[], desc: PrefixDescriptor | null = fixedPrefix) {
  return new MarginalDensityReadModelAdapter(new StubObservations(rows), new StubCatalog(desc), {
    underutilizedBelow: 0.1,
    saturatedAbove: 0.9,
  });
}

describe('MarginalDensityReadModelAdapter', () => {
  it('axis별 distinct entry 카운트 + density 계산', async () => {
    const userLogin = mockUnion.encode('user_action', [1]);
    const userLogout = mockUnion.encode('user_action', [2]);
    const deptBudget = mockUnion.encode('dept_action', [3]);
    const adapter = makeAdapter([
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: userLogin, count: 100 },
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: userLogout, count: 50 },
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: deptBudget, count: 10 },
    ]);
    const result = await adapter.compute({
      catalog: 'sim',
      prefix: 'sim.bitmap',
      version: 'uv1',
    });
    expect(result.prefix).toBe('sim.bitmap');
    expect(result.axes).toHaveLength(2);

    const ua = result.axes.find((a) => a.axisName === 'user_action')!;
    expect(ua.shapeCapacity).toBe(4);
    expect(ua.observedDistinct).toBe(2);
    expect(ua.marginalDensity).toBeCloseTo(0.5, 5);
    expect([...ua.unobservedEntries].sort()).toEqual(['refresh', 'rotate']);

    const da = result.axes.find((a) => a.axisName === 'dept_action')!;
    expect(da.observedDistinct).toBe(1);
    expect(da.marginalDensity).toBeCloseTo(1 / 3, 5);
  });

  it('§5 §3.4 threshold — underutilized / saturated 분류', async () => {
    const da1 = mockUnion.encode('dept_action', [1]);
    const da2 = mockUnion.encode('dept_action', [2]);
    const da3 = mockUnion.encode('dept_action', [3]);
    const adapter = makeAdapter([
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: da1, count: 1 },
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: da2, count: 1 },
      { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: da3, count: 1 },
    ]);
    const result = await adapter.compute({
      catalog: 'sim',
      prefix: 'sim.bitmap',
      version: 'uv1',
    });
    expect(result.underutilizedAxes).toEqual(['user_action']);
    expect(result.saturatedAxes).toEqual(['dept_action']);
  });

  it('미존재 prefix → PrefixNotFoundException', async () => {
    const adapter = makeAdapter([], null);
    await expect(
      adapter.compute({ catalog: 'sim', prefix: 'missing', version: 'uv1' }),
    ).rejects.toBeInstanceOf(PrefixNotFoundException);
  });

  it('version mismatch → PrefixVersionMismatchException', async () => {
    const adapter = makeAdapter([]);
    await expect(
      adapter.compute({ catalog: 'sim', prefix: 'sim.bitmap', version: 'uv2' }),
    ).rejects.toBeInstanceOf(PrefixVersionMismatchException);
  });

  it('관측 0건 — 모든 axis density 0, 모두 underutilized', async () => {
    const adapter = makeAdapter([]);
    const result = await adapter.compute({
      catalog: 'sim',
      prefix: 'sim.bitmap',
      version: 'uv1',
    });
    for (const a of result.axes) {
      expect(a.observedDistinct).toBe(0);
      expect(a.marginalDensity).toBe(0);
    }
    expect([...result.underutilizedAxes].sort()).toEqual(['dept_action', 'user_action']);
  });

  it('invalid packed_key (decode 실패) — silent skip + warn', async () => {
    const warnSpy = vi.fn();
    const logger = { info: vi.fn(), warn: warnSpy, error: vi.fn() };
    const adapter = new MarginalDensityReadModelAdapter(
      new StubObservations([
        { prefix_id: 'sim.bitmap', version: 'uv1', packed_key: 999_999_999, count: 1 },
      ]),
      new StubCatalog(fixedPrefix),
      { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
      logger,
    );
    const result = await adapter.compute({
      catalog: 'sim',
      prefix: 'sim.bitmap',
      version: 'uv1',
    });
    expect(result.axes.every((a) => a.observedDistinct === 0)).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
