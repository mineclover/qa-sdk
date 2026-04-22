// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it, vi } from "vitest";
import { DisjointUnionIndex } from "weighted-index";
import {
  DENSITY_OPTIONS,
  MarginalDensityService,
  type KeyObservationRow,
  type MarginalDensityServiceOptions,
  type PrefixDescriptor,
} from "./density.service.js";

const USER_LABELS = ["login", "logout", "refresh", "rotate"] as const;
const DEPT_LABELS = ["assign", "manage", "budget"] as const;

const mockUnion = new DisjointUnionIndex([
  { kind: "user_action", shape: [USER_LABELS.length], labels: ["action"] },
  { kind: "dept_action", shape: [DEPT_LABELS.length], labels: ["action"] },
]);

const fixedPrefix: PrefixDescriptor = {
  id: "sim.bitmap",
  version: "uv1",
  union: mockUnion,
  axes: [
    { name: "user_action", labels: USER_LABELS },
    { name: "dept_action", labels: DEPT_LABELS },
  ],
  coordsOneBased: true,
};

function makeStore(rows: KeyObservationRow[]) {
  return {
    listObservations: vi.fn(
      async (args: { prefix_id: string; version: string }) =>
        rows.filter(
          (r) => r.prefix_id === args.prefix_id && r.version === args.version,
        ),
    ),
  };
}

function makeService(opts: Partial<MarginalDensityServiceOptions> = {}) {
  const options: MarginalDensityServiceOptions = {
    keyObservationStore: opts.keyObservationStore ?? makeStore([]),
    prefixCatalog:
      opts.prefixCatalog ?? {
        resolve: vi.fn(async () => fixedPrefix),
      },
    thresholds: opts.thresholds ?? {
      underutilizedBelow: 0.1,
      saturatedAbove: 0.9,
    },
    logger: opts.logger,
  };
  // @Inject 우회: 생성자에 options 직접 주입.
  return new MarginalDensityService(options);
}

describe("MarginalDensityService", () => {
  it("axis별 distinct entry 카운트 + density 계산", async () => {
    // user_action의 login/logout 2개 관측 (4 capacity → density 0.5)
    // dept_action의 budget 1개 관측 (3 capacity → density 0.333)
    const userLoginAddr = mockUnion.encode("user_action", [1]);
    const userLogoutAddr = mockUnion.encode("user_action", [2]);
    const deptBudgetAddr = mockUnion.encode("dept_action", [3]);
    const store = makeStore([
      {
        prefix_id: "sim.bitmap",
        version: "uv1",
        packed_key: userLoginAddr,
        count: 100,
      },
      {
        prefix_id: "sim.bitmap",
        version: "uv1",
        packed_key: userLogoutAddr,
        count: 50,
      },
      {
        prefix_id: "sim.bitmap",
        version: "uv1",
        packed_key: deptBudgetAddr,
        count: 10,
      },
    ]);
    const svc = makeService({ keyObservationStore: store });
    const result = await svc.compute({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.version).toBe("uv1");
    expect(result.axes).toHaveLength(2);

    const ua = result.axes.find((a) => a.axisName === "user_action")!;
    expect(ua.shapeCapacity).toBe(4);
    expect(ua.observedDistinct).toBe(2);
    expect(ua.marginalDensity).toBeCloseTo(0.5, 5);
    expect(ua.unobservedEntries.sort()).toEqual(["refresh", "rotate"]);

    const da = result.axes.find((a) => a.axisName === "dept_action")!;
    expect(da.shapeCapacity).toBe(3);
    expect(da.observedDistinct).toBe(1);
    expect(da.marginalDensity).toBeCloseTo(1 / 3, 5);
    expect(da.unobservedEntries.sort()).toEqual(["assign", "manage"]);
  });

  it("§5 §3.4 threshold — underutilized (< 0.1) / saturated (> 0.9)", async () => {
    // user_action: 0개 관측 (density 0 → underutilized)
    // dept_action: 3개 관측 (density 1.0 → saturated)
    const da1 = mockUnion.encode("dept_action", [1]);
    const da2 = mockUnion.encode("dept_action", [2]);
    const da3 = mockUnion.encode("dept_action", [3]);
    const store = makeStore([
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da1, count: 1 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da2, count: 1 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da3, count: 1 },
    ]);
    const svc = makeService({ keyObservationStore: store });
    const result = await svc.compute({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
    expect(result.underutilizedAxes).toEqual(["user_action"]);
    expect(result.saturatedAxes).toEqual(["dept_action"]);
  });

  it("미존재 prefix → throw", async () => {
    const svc = makeService({
      prefixCatalog: { resolve: vi.fn(async () => null) },
    });
    await expect(
      svc.compute({ catalog: "sim", prefix: "missing", version: "uv1" }),
    ).rejects.toThrow(/prefix.*not.*found/i);
  });

  it("관측 0건 — 모든 axis density 0, 모든 axis underutilized", async () => {
    const svc = makeService();
    const result = await svc.compute({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
    for (const a of result.axes) {
      expect(a.observedDistinct).toBe(0);
      expect(a.marginalDensity).toBe(0);
    }
    expect(result.underutilizedAxes.sort()).toEqual([
      "dept_action",
      "user_action",
    ]);
    expect(result.saturatedAxes).toEqual([]);
  });

  it("invalid packed_key (decode 실패) — silent skip + warn (graceful)", async () => {
    const store = makeStore([
      {
        prefix_id: "sim.bitmap",
        version: "uv1",
        packed_key: 999_999_999,
        count: 1,
      },
    ]);
    const warnSpy = vi.fn();
    const svc = makeService({
      keyObservationStore: store,
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    const result = await svc.compute({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
    expect(result.axes.every((a) => a.observedDistinct === 0)).toBe(true);
    // skip 자체는 valid — silent fallback이 아닌 명시적 warn.
    expect(warnSpy).toHaveBeenCalled();
  });

  it("version mismatch → throw", async () => {
    const svc = makeService();
    await expect(
      svc.compute({ catalog: "sim", prefix: "sim.bitmap", version: "uv2" }),
    ).rejects.toThrow(/version mismatch/i);
  });

  // DENSITY_OPTIONS symbol이 @Inject 경로에서도 동작하도록 reference 검증.
  it("DENSITY_OPTIONS symbol export", () => {
    expect(typeof DENSITY_OPTIONS).toBe("symbol");
  });
});
