// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import {
  sliceDepth,
  sliceContains,
  resolveIntents,
  computeConsumption,
  diagnoseConsumption,
  type SliceIntent,
  type DimSlice,
} from "./address-intent.js";

// ─── 슬라이스 ───────────────────────────────────────────

describe("sliceDepth", () => {
  it("빈 슬라이스는 깊이 0", () => {
    expect(sliceDepth({})).toBe(0);
  });

  it("차원 1개 고정 = 깊이 1", () => {
    expect(sliceDepth({ page: "checkout" })).toBe(1);
  });

  it("차원 3개 고정 = 깊이 3", () => {
    expect(sliceDepth({ page: "checkout", locale: "ko", userType: "member" })).toBe(3);
  });
});

describe("sliceContains", () => {
  it("빈 슬라이스는 모든 슬라이스를 포함한다", () => {
    expect(sliceContains({}, { page: "checkout" })).toBe(true);
    expect(sliceContains({}, { page: "checkout", locale: "ko" })).toBe(true);
  });

  it("같은 차원 값이면 포함", () => {
    expect(sliceContains({ page: "checkout" }, { page: "checkout", locale: "ko" })).toBe(true);
  });

  it("다른 차원 값이면 비포함", () => {
    expect(sliceContains({ page: "checkout" }, { page: "home" })).toBe(false);
  });

  it("넓은 범위가 좁은 범위를 포함, 역은 불가", () => {
    const broad = { page: "checkout" };
    const narrow = { page: "checkout", locale: "ko" };
    expect(sliceContains(broad, narrow)).toBe(true);
    expect(sliceContains(narrow, broad)).toBe(false);
  });
});

// ─── 의도 해석 ──────────────────────────────────────────

describe("resolveIntents", () => {
  const intents: SliceIntent[] = [
    { prefixId: "page_view", slice: {}, intent: "사용자 화면 관측 전체" },
    { prefixId: "page_view", slice: { page: "checkout" }, intent: "결제 흐름 전환율 관측" },
    { prefixId: "page_view", slice: { page: "checkout", locale: "ko" }, intent: "한국어 결제 UX 품질" },
    { prefixId: "page_view", slice: { page: "home" }, intent: "메인 화면 이탈률 관측" },
  ];

  it("주소가 넓은→좁은 순으로 의도 체인을 반환한다", () => {
    const address: DimSlice = { page: "checkout", locale: "ko", userType: "member", svc_ref: "shop" };
    const resolved = resolveIntents(address, intents);

    expect(resolved.length).toBe(3);
    // 넓은 순: {} → {page:checkout} → {page:checkout, locale:ko}
    expect(resolved[0].intent).toBe("사용자 화면 관측 전체");
    expect(resolved[1].intent).toBe("결제 흐름 전환율 관측");
    expect(resolved[2].intent).toBe("한국어 결제 UX 품질");
  });

  it("home 주소는 checkout 의도에 매칭되지 않는다", () => {
    const address: DimSlice = { page: "home", locale: "ko", userType: "guest", svc_ref: "shop" };
    const resolved = resolveIntents(address, intents);

    expect(resolved.length).toBe(2);
    expect(resolved[0].intent).toBe("사용자 화면 관측 전체");
    expect(resolved[1].intent).toBe("메인 화면 이탈률 관측");
  });

  it("의도가 없는 차원 조합은 빈 슬라이스만 매칭", () => {
    const address: DimSlice = { page: "settings", locale: "en", userType: "admin", svc_ref: "shop" };
    const resolved = resolveIntents(address, intents);

    expect(resolved.length).toBe(1);
    expect(resolved[0].slice).toEqual({});
  });
});

// ─── 소비율 ─────────────────────────────────────────────

describe("computeConsumption", () => {
  it("소비율을 올바르게 계산한다", () => {
    const consumption = computeConsumption(
      "page_view", "v2",
      32768,  // totalSpace
      500,    // observedAddresses
      [
        { axisId: "page", totalEntries: 20, observedEntries: 8 },
        { axisId: "locale", totalEntries: 10, observedEntries: 3 },
        { axisId: "userType", totalEntries: 8, observedEntries: 4 },
      ],
    );

    expect(consumption.prefixId).toBe("page_view");
    expect(consumption.consumptionRate).toBeCloseTo(500 / 32768);
    expect(consumption.byDimension["page"].rate).toBeCloseTo(8 / 20);
    expect(consumption.byDimension["locale"].rate).toBeCloseTo(3 / 10);
    expect(consumption.byDimension["userType"].rate).toBeCloseTo(4 / 8);
  });

  it("totalSpace 0이면 consumptionRate 0", () => {
    const consumption = computeConsumption("empty", "v1", 0, 0, []);
    expect(consumption.consumptionRate).toBe(0);
  });
});

// ─── 진단 ───────────────────────────────────────────────

describe("diagnoseConsumption", () => {
  it("소비율 < 1%면 underused", () => {
    const consumption = computeConsumption("wide", "v1", 1000000, 50, [
      { axisId: "dim1", totalEntries: 100, observedEntries: 5 },
    ]);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("underused");
  });

  it("소비율 1~70%면 healthy", () => {
    const consumption = computeConsumption("normal", "v1", 1000, 300, [
      { axisId: "dim1", totalEntries: 10, observedEntries: 5 },
    ]);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("healthy");
  });

  it("소비율 70~90%면 crowded", () => {
    const consumption = computeConsumption("busy", "v1", 1000, 800, [
      { axisId: "dim1", totalEntries: 10, observedEntries: 8 },
    ]);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("crowded");
  });

  it("소비율 > 90%면 critical", () => {
    const consumption = computeConsumption("full", "v1", 1000, 950, [
      { axisId: "dim1", totalEntries: 10, observedEntries: 10 },
    ]);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("critical");
  });

  it("특정 차원만 90% 초과해도 critical", () => {
    const consumption = computeConsumption("dimfull", "v1", 100000, 500, [
      { axisId: "dim1", totalEntries: 10, observedEntries: 3 },
      { axisId: "dim2", totalEntries: 8, observedEntries: 8 },  // 100%
    ]);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("critical");
    expect(diag.flaggedDims).toContain("dim2");
  });

  it("관측 0건이면 healthy (아직 데이터 없음)", () => {
    const consumption = computeConsumption("new", "v1", 1000, 0, []);
    const diag = diagnoseConsumption(consumption);
    expect(diag.severity).toBe("healthy");
  });
});
