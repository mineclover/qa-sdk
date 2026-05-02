// @def.boundary sim-auth-api
// spec §9 Stage 3 — BitmapVersionService monotonic counter unit tests.
import { describe, it, expect, beforeEach } from "vitest";
import { parseVersionTag } from "sim-identifier-grammar";
import { BitmapVersionService } from "./bitmap-version.service.js";

describe("BitmapVersionService (spec §9 Stage 3)", () => {
  let svc: BitmapVersionService;
  beforeEach(() => {
    svc = new BitmapVersionService();
  });

  it("초기 sim.bitmap stable=v1", () => {
    expect(parseVersionTag(svc.getCurrent("sim.bitmap"))).toEqual({
      axis: "version",
      value: 1,
      state: "stable",
    });
  });

  it("연속 bump → monotonic v1→v2→v3, retired 누적, bumpedAt ISO", () => {
    // 2회 bump → retired는 ["v1","v2"], 마지막 bump 결과는 v2→v3.
    // (plan defect: 원본은 bump 3회 + retired ["v1","v2"]로 모순 → 의도(monotonic counter)에 맞춰 정정.)
    const r1 = svc.bump("sim.bitmap");
    const r2 = svc.bump("sim.bitmap");
    expect(r1).toMatchObject({ oldVersion: "v1", newVersion: "v2" });
    expect(r2).toMatchObject({ oldVersion: "v2", newVersion: "v3" });
    expect(() => new Date(r2.bumpedAt).toISOString()).not.toThrow();
    expect(svc.listRetired("sim.bitmap")).toEqual(["v1", "v2"]);
  });

  it("새 prefix lazy 초기화 + 다른 prefix 격리", () => {
    expect(svc.getCurrent("sim.role-bitmap")).toBe("v1");
    svc.bump("sim.role-bitmap");
    expect(svc.getCurrent("sim.bitmap")).toBe("v1");
  });

  it("nowImpl 주입 → 결정론적 bumpedAt", () => {
    const det = new BitmapVersionService({
      nowImpl: () => new Date("2026-05-02T00:00:00.000Z"),
    });
    expect(det.bump("sim.bitmap").bumpedAt).toBe("2026-05-02T00:00:00.000Z");
  });
});
