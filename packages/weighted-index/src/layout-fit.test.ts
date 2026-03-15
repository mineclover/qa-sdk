/**
 * layout-fit.test.ts — 레이아웃 시뮬레이터 수학 검증.
 *
 * 모든 UI 표시 값의 정합성을 순수 함수 레벨에서 증명한다.
 * UI(layout.ts)는 이 테스트가 증명한 computeLayoutViewModel()의 출력을 그대로 렌더링만 한다.
 */

import { describe, it, expect } from "vitest";
import {
  analyzeLayoutSim,
  computeLayoutViewModel,
  dimMaxForBudget,
  dimMaxBig,
  dimMaxApprox,
  productExcluding,
  shapeProduct,
  shapeProductUncapped,
  autoBalancedShape,
  clampShape,
  simDecode,
  simDecodeBig,
  simEncode,
  simEncodeBig,
  simPackUUID,
  simPackUUIDBig,
  fieldMaxVal,
  logScalePercent,
  valToSlider,
  sliderToVal,
  varintByteSize,
  formatLargeNumber,
  maxProductBig,
  utilizationBig,
  type LayoutSimAnalysis,
  type LayoutViewMode,
} from "./layout-fit.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

const CFG_STANDARD = { prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 };
const CFG_SMALL    = { prefixChars: 0, versionChars: 0, shardChars: 0, numDims: 3 };
const CFG_TIGHT    = { prefixChars: 8, versionChars: 4, shardChars: 7, numDims: 2 };
const CFG_BOUNDARY = { prefixChars: 19, versionChars: 0, shardChars: 0, numDims: 3 }; // budget=13
const CFG_ZERO     = { prefixChars: 16, versionChars: 16, shardChars: 0, numDims: 2 }; // budget=0

const ANALYSIS_STD = analyzeLayoutSim(CFG_STANDARD);   // budget=29
const ANALYSIS_SMALL = analyzeLayoutSim(CFG_SMALL);     // budget=32
const ANALYSIS_TIGHT = analyzeLayoutSim(CFG_TIGHT);     // budget=13
const ANALYSIS_BOUNDARY = analyzeLayoutSim(CFG_BOUNDARY); // budget=13
const ANALYSIS_ZERO = analyzeLayoutSim(CFG_ZERO);       // budget=0

// ── §1. analyzeLayoutSim ────────────────────────────────────────────────────

describe("[analyzeLayoutSim] UUID 예산 분석", () => {
  it("budget = 32 - usedChars", () => {
    expect(ANALYSIS_STD.indexBudget).toBe(29);
    expect(ANALYSIS_STD.usedChars).toBe(3);
    expect(ANALYSIS_STD.indexBits).toBe(116);
  });

  it("budget=0이면 valid=false, maxProductSafe=0", () => {
    expect(ANALYSIS_ZERO.indexBudget).toBe(0);
    expect(ANALYSIS_ZERO.valid).toBe(false);
    expect(ANALYSIS_ZERO.maxProductSafe).toBe(0);
  });

  it("budget ≤ 13이면 maxProductSafe가 정확한 값", () => {
    expect(ANALYSIS_BOUNDARY.indexBudget).toBe(13);
    expect(ANALYSIS_BOUNDARY.maxProductSafe).toBe(16 ** 13);
    expect(ANALYSIS_BOUNDARY.maxProductSafe).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it("budget > 13이면 maxProductSafe = MAX_SAFE_INTEGER", () => {
    expect(ANALYSIS_STD.indexBudget).toBe(29);
    expect(ANALYSIS_STD.maxProductSafe).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("budget=32 (prefix/ver/shard 없음)", () => {
    expect(ANALYSIS_SMALL.indexBudget).toBe(32);
    expect(ANALYSIS_SMALL.indexBits).toBe(128);
    expect(ANALYSIS_SMALL.maxProductSafe).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("uniformMax = floor(16^(budget/numDims))", () => {
    const expected = Math.floor(Math.pow(16, 29 / 4));
    expect(ANALYSIS_STD.uniformMax).toBe(expected);
  });

  it("totalChars는 항상 32", () => {
    expect(ANALYSIS_STD.totalChars).toBe(32);
    expect(ANALYSIS_ZERO.totalChars).toBe(32);
  });
});

// ── §2. dimMaxForBudget ─────────────────────────────────────────────────────

describe("[dimMaxForBudget] 차원별 최대값 (Number 캡)", () => {
  it("budget ≤ 13: 정확한 나눗셈", () => {
    // budget=13, others=1000 → 16^13 / 1000
    const result = dimMaxForBudget(13, 1000);
    expect(result).toBe(Math.floor(16 ** 13 / 1000));
  });

  it("budget > 13: MAX_SAFE_INTEGER / others", () => {
    const result = dimMaxForBudget(29, 1000);
    expect(result).toBe(Math.floor(Number.MAX_SAFE_INTEGER / 1000));
  });

  it("result * others ≤ MAX_SAFE_INTEGER (안전 보장)", () => {
    const others = 1000;
    const result = dimMaxForBudget(29, others);
    expect(result * others).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it("others=1이면 result = min(16^budget, MAX_SAFE_INTEGER)", () => {
    expect(dimMaxForBudget(10, 1)).toBe(16 ** 10);
    expect(dimMaxForBudget(29, 1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("others >= MAX_SAFE_INTEGER이면 1 반환", () => {
    expect(dimMaxForBudget(29, Number.MAX_SAFE_INTEGER)).toBe(1);
    expect(dimMaxForBudget(29, Number.MAX_SAFE_INTEGER + 1)).toBe(1);
  });

  it("budget=0 또는 others=0이면 0 반환", () => {
    expect(dimMaxForBudget(0, 100)).toBe(0);
    expect(dimMaxForBudget(10, 0)).toBe(0);
  });
});

// ── §3. dimMaxBig ───────────────────────────────────────────────────────────

describe("[dimMaxBig] 차원별 최대값 (BigInt 정확)", () => {
  it("budget ≤ 13: dimMaxForBudget과 같은 수치", () => {
    // 작은 others로 결과가 < 1,000,000이 되도록
    const numResult = dimMaxForBudget(3, 1); // 16^3 = 4096
    const bigResult = dimMaxBig(3, 1);
    expect(bigResult).toBe(numResult.toLocaleString());

    // 큰 값은 formatBigInt가 과학 표기법 → 수치만 비교
    const numResult2 = dimMaxForBudget(13, 100);
    const exact = 16n ** 13n / 100n;
    expect(numResult2).toBe(Number(exact));
  });

  it("budget > 13: MAX_SAFE_INTEGER보다 큰 값 반환", () => {
    // budget=29, others=1 → 16^29 ≈ 8.5×10^34
    const result = dimMaxBig(29, 1);
    // "X.XX × 10^34" 형태
    expect(result).toMatch(/× 10\^34/);
  });

  it("budget=0이면 '0'", () => {
    expect(dimMaxBig(0, 100)).toBe("0");
  });
});

// ── §4. dimMaxApprox vs dimMaxBig ───────────────────────────────────────────

describe("[dimMaxApprox] float 근사 vs BigInt 정확", () => {
  it("budget ≤ 13: 정확한 값과 일치", () => {
    expect(dimMaxApprox(13, 100)).toBe(dimMaxForBudget(13, 100));
  });

  it("budget > 13: BigInt 값과 상대 오차 < 1%", () => {
    // budget=29, others=1000
    const approx = dimMaxApprox(29, 1000);
    const exact = 16n ** 29n / 1000n;
    const exactFloat = Number(exact);
    const relError = Math.abs(approx - exactFloat) / exactFloat;
    expect(relError).toBeLessThan(0.01);
  });

  it("항상 양수 (budget > 0, others > 0)", () => {
    expect(dimMaxApprox(1, 1)).toBeGreaterThan(0);
    expect(dimMaxApprox(29, 1000)).toBeGreaterThan(0);
    expect(dimMaxApprox(32, 1e10)).toBeGreaterThan(0);
  });
});

// ── §5. Product 함수 ────────────────────────────────────────────────────────

describe("[shapeProduct / shapeProductUncapped] 곱 계산", () => {
  it("작은 값에서 일치", () => {
    expect(shapeProduct([10, 20, 30])).toBe(6000);
    expect(shapeProductUncapped([10, 20, 30])).toBe(6000);
  });

  it("shapeProduct는 MAX_SAFE_INTEGER에서 캡", () => {
    // 큰 shape: 10^5 × 10^5 × 10^5 × 10^5 = 10^20 > MAX_SAFE_INTEGER
    const big = [100000, 100000, 100000, 100000];
    expect(shapeProduct(big)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("shapeProductUncapped는 캡 없이 float 반환", () => {
    const big = [100000, 100000, 100000, 100000];
    expect(shapeProductUncapped(big)).toBe(1e20);
  });

  it("productExcluding은 지정 인덱스 제외", () => {
    expect(productExcluding([3, 5, 7], 0)).toBe(35);
    expect(productExcluding([3, 5, 7], 1)).toBe(21);
    expect(productExcluding([3, 5, 7], 2)).toBe(15);
  });

  it("productExcluding도 MAX_SAFE_INTEGER 캡", () => {
    const big = [1e10, 1e10, 2];
    // 1e10 * 2 = 2e10, OK
    expect(productExcluding(big, 0)).toBe(2e10);
    // 1e10 * 1e10 = 1e20 > MAX_SAFE_INTEGER → 캡
    expect(productExcluding(big, 2)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ── §6. utilizationBig ──────────────────────────────────────────────────────

describe("[utilizationBig] UUID 실제 용량 대비 활용률", () => {
  it("budget ≤ 13, product == 16^budget → 100%", () => {
    expect(utilizationBig(16 ** 10, 10)).toBeCloseTo(100, 1);
  });

  it("budget > 13, product == MAX_SAFE_INTEGER → 매우 작은 %", () => {
    const pct = utilizationBig(Number.MAX_SAFE_INTEGER, 29);
    expect(pct).toBeLessThan(0.001); // 10^15 / 10^34 ≈ 10^-17%
  });

  it("product=0 → 0%", () => {
    expect(utilizationBig(0, 10)).toBe(0);
  });

  it("budget=0 → 0%", () => {
    expect(utilizationBig(100, 0)).toBe(0);
  });
});

// ── §7. simEncode / simDecode 라운드트립 ────────────────────────────────────

describe("[simEncode/simDecode] 좌표 라운드트립", () => {
  const shapes = [
    [3, 4, 2],
    [10, 10, 10, 10],
    [2, 2, 2, 2, 2],
    [100, 50],
  ];

  for (const shape of shapes) {
    const product = shapeProduct(shape);
    const label = `shape=[${shape}]`;

    it(`${label}: index 0 → 모두 1`, () => {
      const coords = simDecode(shape, 0);
      expect(coords.every(c => c === 1)).toBe(true);
    });

    it(`${label}: index ${product - 1} → shape 값`, () => {
      const coords = simDecode(shape, product - 1);
      expect(coords).toEqual(shape);
    });

    it(`${label}: 전수 라운드트립`, () => {
      const max = Math.min(product, 10000); // 큰 공간은 샘플링
      for (let idx = 0; idx < max; idx++) {
        const coords = simDecode(shape, idx);
        const back = simEncode(shape, coords);
        expect(back).toBe(idx);
      }
    });
  }

  it("단사(injective): 모든 좌표가 유일한 인덱스", () => {
    const shape = [3, 4, 2];
    const seen = new Set<number>();
    const product = shapeProduct(shape);
    for (let i = 0; i < product; i++) {
      const coords = simDecode(shape, i);
      const idx = simEncode(shape, coords);
      expect(seen.has(idx)).toBe(false);
      seen.add(idx);
    }
    expect(seen.size).toBe(product);
  });
});

// ── §8. simPackUUID ─────────────────────────────────────────────────────────

describe("[simPackUUID] UUID 패킹", () => {
  it("UUID 형식 (8-4-4-4-12)", () => {
    const uuid = simPackUUID(2, 0xAB, 1, 1, 0, 0, 0);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("prefix가 올바른 위치에 배치", () => {
    const uuid = simPackUUID(2, 0xFF, 0, 0, 0, 0, 0);
    expect(uuid.startsWith("ff")).toBe(true);
  });

  it("index=0이면 뒤쪽이 모두 0", () => {
    const uuid = simPackUUID(2, 0xAB, 1, 1, 0, 0, 0);
    // 뒤 29자리가 모두 0
    const raw = uuid.replace(/-/g, "");
    expect(raw.slice(3)).toBe("0".repeat(29));
  });
});

// ── §9. computeLayoutViewModel — 모드별 정합성 ─────────────────────────────

describe("[computeLayoutViewModel] Number 모드 정합성", () => {
  const shape = [1000, 10, 10, 10];

  it("effectiveMax = min(16^budget, MAX_SAFE_INTEGER)", () => {
    // budget=29 > 13 → MAX_SAFE_INTEGER
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    expect(vm.effectiveMax).toBe(Number.MAX_SAFE_INTEGER);
    expect(vm.isCapped).toBe(true);
  });

  it("budget ≤ 13이면 effectiveMax = 16^budget, isCapped=false", () => {
    const vm = computeLayoutViewModel(ANALYSIS_BOUNDARY, [10, 10, 10], "number");
    expect(vm.effectiveMax).toBe(16 ** 13);
    expect(vm.isCapped).toBe(false);
  });

  it("dims[i].sliderMax × productOfOthers ≤ effectiveMax", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    for (let i = 0; i < shape.length; i++) {
      const others = productExcluding(shape, i);
      expect(vm.dims[i].sliderMax * others).toBeLessThanOrEqual(vm.effectiveMax);
    }
  });

  it("sliderMax까지 올리면 utilization ≈ 100%", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, [1, 1, 1, 1], "number");
    // dim0을 sliderMax까지 올린 shape
    const maxShape = [vm.dims[0].sliderMax, 1, 1, 1];
    const vm2 = computeLayoutViewModel(ANALYSIS_STD, maxShape, "number");
    // product ≈ sliderMax ≈ effectiveMax
    expect(vm2.utilization).toBeGreaterThan(99);
  });

  it("utilization = product / effectiveMax × 100", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    const expected = vm.product / vm.effectiveMax * 100;
    expect(vm.utilization).toBeCloseTo(expected, 5);
  });

  it("isCapped일 때 capacityNote 존재", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    expect(vm.capacityNote).not.toBeNull();
    expect(vm.capacityNote).toContain("실제 포맷 용량");
  });

  it("isCapped=false이면 capacityNote=null", () => {
    const vm = computeLayoutViewModel(ANALYSIS_BOUNDARY, [10, 10, 10], "number");
    expect(vm.capacityNote).toBeNull();
  });
});

describe("[computeLayoutViewModel] BigInt 모드 정합성", () => {
  const shape = [1000, 10, 10, 10];

  it("effectiveMax > MAX_SAFE_INTEGER (budget > 13)", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    expect(vm.effectiveMax).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(vm.isCapped).toBe(false);
  });

  it("utilization = utilizationBig 결과와 일치", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    const expected = utilizationBig(shapeProductUncapped(shape), 29);
    expect(vm.utilization).toBeCloseTo(expected, 5);
  });

  it("capacityNote는 항상 null", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    expect(vm.capacityNote).toBeNull();
  });

  it("dims[i].displayMax는 BigInt 정확 값", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    const bigMax = dimMaxBig(29, productExcluding(shape, 0));
    expect(vm.dims[0].displayMax).toBe(bigMax);
  });
});

describe("[computeLayoutViewModel] 모드 간 비교", () => {
  const shape = [1000, 10, 10, 10];

  it("BigInt effectiveMax ≥ Number effectiveMax", () => {
    const vmN = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    const vmB = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    expect(vmB.effectiveMax).toBeGreaterThanOrEqual(vmN.effectiveMax);
  });

  it("동일 shape → BigInt utilization ≤ Number utilization (분모가 더 크니까)", () => {
    const vmN = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    const vmB = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    expect(vmB.utilization).toBeLessThanOrEqual(vmN.utilization);
  });

  it("budget ≤ 13이면 두 모드의 utilization이 동일", () => {
    const s = [10, 10, 10];
    const vmN = computeLayoutViewModel(ANALYSIS_BOUNDARY, s, "number");
    const vmB = computeLayoutViewModel(ANALYSIS_BOUNDARY, s, "bigint");
    expect(vmN.utilization).toBeCloseTo(vmB.utilization, 3);
  });

  it("product는 모드 관계없이 동일한 shape면 같은 값 (budget ≤ 13)", () => {
    const s = [10, 10, 10];
    const vmN = computeLayoutViewModel(ANALYSIS_BOUNDARY, s, "number");
    const vmB = computeLayoutViewModel(ANALYSIS_BOUNDARY, s, "bigint");
    expect(vmN.product).toBe(vmB.product);
  });
});

// ── §10. 엣지 케이스 ────────────────────────────────────────────────────────

describe("[computeLayoutViewModel] 엣지 케이스", () => {
  it("budget=0: effectiveMax=0, utilization=0", () => {
    const vm = computeLayoutViewModel(ANALYSIS_ZERO, [1, 1], "number");
    expect(vm.effectiveMax).toBe(0);
    expect(vm.utilization).toBe(0);
    expect(vm.overflow).toBe(false);
  });

  it("shape 모두 1: product=1, utilization > 0", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, [1, 1, 1, 1], "number");
    expect(vm.product).toBe(1);
    expect(vm.utilization).toBeGreaterThan(0);
    expect(vm.overflow).toBe(false);
  });

  it("1차원: dimMax = effectiveMax", () => {
    const a = analyzeLayoutSim({ prefixChars: 0, versionChars: 0, shardChars: 0, numDims: 1 });
    const vm = computeLayoutViewModel(a, [100], "number");
    // 1차원이면 others=1이므로 dimMax = effectiveMax
    expect(vm.dims[0].sliderMax).toBe(vm.effectiveMax);
  });

  it("budget=13 경계: Number/BigInt 결과가 동일", () => {
    const shape = [100, 100, 100];
    const vmN = computeLayoutViewModel(ANALYSIS_BOUNDARY, shape, "number");
    const vmB = computeLayoutViewModel(ANALYSIS_BOUNDARY, shape, "bigint");
    // budget=13은 Number로 정확 표현 가능 → 두 모드 effectiveMax 동일
    expect(vmN.effectiveMax).toBe(vmB.effectiveMax);
  });

  it("Number 갭: budget > 13이면 numberGapBits = indexBits - 53", () => {
    // budget=29 → indexBits=116, numberReachBits=53, numberGapBits=63
    const vm = computeLayoutViewModel(ANALYSIS_STD, [10, 10, 10, 10], "number");
    expect(vm.numberReachBits).toBe(53);
    expect(vm.numberGapBits).toBe(116 - 53);
    expect(vm.numberReachBits + vm.numberGapBits).toBe(vm.indexBits);
  });

  it("Number 갭: budget ≤ 13이면 갭 없음", () => {
    const vm = computeLayoutViewModel(ANALYSIS_BOUNDARY, [10, 10, 10], "number");
    expect(vm.numberGapBits).toBe(0);
    expect(vm.numberReachBits).toBe(ANALYSIS_BOUNDARY.indexBits); // 52
  });

  it("BigInt 모드에서는 항상 갭 없음", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, [10, 10, 10, 10], "bigint");
    expect(vm.numberGapBits).toBe(0);
    expect(vm.numberReachBits).toBe(vm.indexBits);
  });

  it("indexType 자동 결정: budget > 13 → bigint", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, [10, 10, 10, 10], "number");
    expect(vm.indexType).toBe("bigint"); // budget=29 > 13
  });

  it("indexType 자동 결정: budget ≤ 13 → number", () => {
    const vm = computeLayoutViewModel(ANALYSIS_BOUNDARY, [10, 10, 10], "number");
    expect(vm.indexType).toBe("number"); // budget=13
  });

  it("indexFillRatio: product / effectiveMax (0~1)", () => {
    const vm = computeLayoutViewModel(ANALYSIS_STD, [10, 10, 10, 10], "number");
    expect(vm.indexFillRatio).toBeGreaterThan(0);
    expect(vm.indexFillRatio).toBeLessThanOrEqual(1);
    expect(vm.indexFillRatio).toBeCloseTo(vm.product / vm.effectiveMax, 10);
  });

  it("indexFillRatio: sliderMax까지 올리면 ≈ 1.0", () => {
    const vm1 = computeLayoutViewModel(ANALYSIS_STD, [1, 1, 1, 1], "number");
    const maxShape = [vm1.dims[0].sliderMax, 1, 1, 1];
    const vm2 = computeLayoutViewModel(ANALYSIS_STD, maxShape, "number");
    expect(vm2.indexFillRatio).toBeGreaterThan(0.99);
  });
});

// ── §11. 포맷별 analyzeLayoutSim ────────────────────────────────────────────

describe("[analyzeLayoutSim] 포맷별 분석", () => {
  it("formatChars 미지정 시 UUID (32ch)", () => {
    const a = analyzeLayoutSim({ prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 });
    expect(a.totalChars).toBe(32);
    expect(a.indexBudget).toBe(29);
  });

  it("formatChars=16 (int64): budget = 16 - usedChars", () => {
    const a = analyzeLayoutSim({ formatChars: 16, prefixChars: 3, versionChars: 0, shardChars: 0, numDims: 3 });
    expect(a.totalChars).toBe(16);
    expect(a.indexBudget).toBe(13);
    expect(a.indexBits).toBe(52);
    // budget=13 ≤ SAFE_POW16_LIMIT → maxProductSafe 정확
    expect(a.maxProductSafe).toBe(16 ** 13);
  });

  it("int64 budget=13 → Number로 완전 커버, indexType=number", () => {
    const a = analyzeLayoutSim({ formatChars: 16, prefixChars: 3, versionChars: 0, shardChars: 0, numDims: 3 });
    const vm = computeLayoutViewModel(a, [100, 100, 100], "number");
    expect(vm.indexType).toBe("number");
    expect(vm.isCapped).toBe(false);
    expect(vm.numberGapBits).toBe(0);
  });

  it("int64 budget=16 → BigInt 필요, indexType=bigint", () => {
    const a = analyzeLayoutSim({ formatChars: 16, prefixChars: 0, versionChars: 0, shardChars: 0, numDims: 2 });
    expect(a.indexBudget).toBe(16);
    const vm = computeLayoutViewModel(a, [100, 100], "number");
    expect(vm.indexType).toBe("bigint");
    expect(vm.isCapped).toBe(true);
  });

  it("formatChars=24 (objectId): budget = 24 - 3 = 21 → BigInt", () => {
    const a = analyzeLayoutSim({ formatChars: 24, prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 });
    expect(a.totalChars).toBe(24);
    expect(a.indexBudget).toBe(21);
    const vm = computeLayoutViewModel(a, [10, 10, 10, 10], "number");
    expect(vm.indexType).toBe("bigint");
  });
});

// ── §12. 유저 보고 시나리오 재현 ────────────────────────────────────────────
//
// 유저 보고: prefix=2, ver=1, dims=4, shape=[9.01×10^12, 10, 10, 10]
// Number 모드에서 utilization이 100%로 나와야 하는데 UUID 용량 기준이면 < 0.01%.
// 정합성 모델에서는 Number 모드 = MAX_SAFE_INTEGER 기준이므로 ≈100% 가 올바른 표시.

describe("[computeLayoutViewModel] 유저 보고 시나리오", () => {
  it("Number 모드: dim0=9.01e12, 나머지=10 → utilization ≈ 100%", () => {
    const dim0Max = dimMaxForBudget(29, 1000); // floor(MAX_SAFE_INTEGER / 1000)
    const shape = [dim0Max, 10, 10, 10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");

    // effectiveMax = MAX_SAFE_INTEGER
    expect(vm.effectiveMax).toBe(Number.MAX_SAFE_INTEGER);
    // product ≈ dim0Max * 1000 ≈ MAX_SAFE_INTEGER
    expect(vm.utilization).toBeGreaterThan(99);
    // dimMax 표시가 슬라이더 조작 범위와 일치
    expect(vm.dims[0].sliderMax).toBe(dim0Max);
    // isCapped=true → 실제 UUID 용량 안내
    expect(vm.isCapped).toBe(true);
    expect(vm.capacityNote).not.toBeNull();
  });

  it("BigInt 모드: 동일 shape → utilization < 0.01%", () => {
    const dim0Max = dimMaxForBudget(29, 1000);
    const shape = [dim0Max, 10, 10, 10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");

    // BigInt 모드에서는 UUID 전체 용량 기준 → 극히 작은 활용률
    expect(vm.utilization).toBeLessThan(0.01);
    // effectiveMax는 UUID 전체 용량
    expect(vm.effectiveMax).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    // dimMax는 UUID 전체 용량 기준으로 훨씬 큰 값
    expect(vm.dims[0].sliderMax).toBeGreaterThan(dim0Max);
  });
});

// ── §13. clampShape — 상호 제약 clamp 및 오버플로우 방지 ────────────────────

describe("[clampShape] 상호 제약 clamp", () => {
  it("정상 shape는 변경 없음", () => {
    const shape = [10, 10, 10, 10];
    const result = clampShape(shape, 29, "number");
    expect(result).toEqual(shape);
  });

  it("한 dim이 다른 dim에 의해 제한됨", () => {
    // Number 모드 budget=29: effectiveMax = MAX_SAFE_INTEGER ≈ 9e15
    // dim0=1e10, dim1=1e10 → others for dim2 = 1e20 > MAX_SAFE_INTEGER → dim2 clamp to 1
    const shape = [1e10, 1e10, 1e10, 1e10];
    const result = clampShape(shape, 29, "number");
    const product = result.reduce((p, s) => p * s, 1);
    expect(product).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it("BigInt 모드에서도 effectiveMax 초과 방지", () => {
    // budget=29: 16^29 ≈ 8.5e34
    // 모든 dim을 1e18로 설정하면 product = 1e72 >> 16^29
    const shape = [1e18, 1e18, 1e18, 1e18];
    const result = clampShape(shape, 29, "bigint");
    const product = result.reduce((p, s) => p * s, 1);
    // clamp 후 product가 effectiveMax 이하
    const effectiveMax = Math.exp(29 * Math.LN2 * 4);
    expect(product).toBeLessThanOrEqual(effectiveMax * 1.01); // float 오차 허용
  });

  it("clamp 후 모든 dim ≥ 1", () => {
    const shape = [1e15, 1e15, 1e15];
    const result = clampShape(shape, 13, "number");
    expect(result.every(v => v >= 1)).toBe(true);
  });

  it("이미 유효한 shape는 변경 없음 (BigInt)", () => {
    const shape = [100, 100, 100, 100];
    const result = clampShape(shape, 29, "bigint");
    expect(result).toEqual(shape);
  });
});

describe("[computeLayoutViewModel] 오버플로우 방지 — clampShape 적용", () => {
  it("초과 shape → clamp 후 utilization ≤ 100%", () => {
    // 모든 dim을 MAX로 동시에 설정하는 시나리오
    const shape = [9.22e18, 9.22e18, 10, 10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    expect(vm.utilization).toBeLessThanOrEqual(100);
    expect(vm.overflow).toBe(false);
  });

  it("clamp된 shape의 dim.value가 viewModel에 반영", () => {
    const shape = [1e18, 1e18, 1e18, 1e18];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    // 최소 하나의 dim이 원래 값보다 작아야 함
    const anyReduced = vm.dims.some((d, i) => d.value < shape[i]);
    expect(anyReduced).toBe(true);
    expect(vm.utilization).toBeLessThanOrEqual(100);
  });

  it("Number 모드에서도 오버플로우 방지", () => {
    const shape = [1e10, 1e10, 1e10, 1e10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "number");
    expect(vm.utilization).toBeLessThanOrEqual(100);
    expect(vm.product).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

// ── §13b. dimMax 재계산 — 다른 dim 변경 시 sliderMax 반영 ───────────────────

describe("[computeLayoutViewModel] dimMax 재계산", () => {
  it("BigInt: dim0이 크면 dim1의 sliderMax가 줄어듦", () => {
    const small = [10, 10, 10, 10];
    const big =   [1e18, 10, 10, 10];

    const vmSmall = computeLayoutViewModel(ANALYSIS_STD, small, "bigint");
    const vmBig   = computeLayoutViewModel(ANALYSIS_STD, big, "bigint");

    // dim0이 10 → 1e18로 커지면, dim1의 sliderMax는 줄어야
    expect(vmBig.dims[1].sliderMax).toBeLessThan(vmSmall.dims[1].sliderMax);
  });

  it("BigInt: dim0=1e18일 때 dim1의 sliderMax가 1e18보다 작아야", () => {
    const shape = [1e18, 10, 10, 10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    // others = 1e18 * 10 * 10 = 1e20
    // dimMax = 16^29 / 1e20 ≈ 8.4e14
    expect(vm.dims[1].sliderMax).toBeLessThan(1e18);
    expect(vm.dims[1].sliderMax).toBeLessThan(1e16); // 실제로 ~8e14
  });

  it("Number: dim0이 크면 dim1의 sliderMax가 줄어듦", () => {
    const small = [10, 10, 10, 10];
    const big   = [1e10, 10, 10, 10];

    const vmSmall = computeLayoutViewModel(ANALYSIS_STD, small, "number");
    const vmBig   = computeLayoutViewModel(ANALYSIS_STD, big, "number");

    expect(vmBig.dims[1].sliderMax).toBeLessThan(vmSmall.dims[1].sliderMax);
  });

  it("대칭: 모든 dim의 sliderMax × 나머지곱 ≤ effectiveMax", () => {
    const shape = [1e12, 100, 50, 10];
    const vm = computeLayoutViewModel(ANALYSIS_STD, shape, "bigint");
    for (let i = 0; i < shape.length; i++) {
      const otherProduct = vm.dims.reduce(
        (p, d, j) => j === i ? p : p * d.value, 1
      );
      expect(vm.dims[i].sliderMax * otherProduct).toBeLessThanOrEqual(vm.effectiveMax * 1.01);
    }
  });
});

// ── §14. BigInt encode/decode/pack ──────────────────────────────────────────

describe("[simDecodeBig/simEncodeBig] BigInt 라운드트립", () => {
  const shapes: bigint[][] = [
    [3n, 4n, 2n],
    [10n, 10n, 10n, 10n],
    [100000n, 100000n, 100000n, 100000n], // 10^20 — Number 범위 초과
  ];

  for (const shape of shapes) {
    const product = shape.reduce((p, s) => p * s, 1n);
    const label = `shape=[${shape}]`;

    it(`${label}: index 0n → 모두 1n`, () => {
      const coords = simDecodeBig(shape, 0n);
      expect(coords.every(c => c === 1n)).toBe(true);
    });

    it(`${label}: 마지막 인덱스 → shape 값`, () => {
      const coords = simDecodeBig(shape, product - 1n);
      expect(coords).toEqual(shape);
    });

    it(`${label}: 라운드트립 (최대 10000건 샘플)`, () => {
      const max = product < 10000n ? Number(product) : 10000;
      for (let i = 0; i < max; i++) {
        const idx = BigInt(i);
        const coords = simDecodeBig(shape, idx);
        expect(simEncodeBig(shape, coords)).toBe(idx);
      }
    });
  }

  it("Number 범위 초과 인덱스 라운드트립", () => {
    const shape = [100000n, 100000n, 100000n, 100000n];
    // MAX_SAFE_INTEGER + 12345
    const idx = BigInt(Number.MAX_SAFE_INTEGER) + 12345n;
    const coords = simDecodeBig(shape, idx);
    expect(simEncodeBig(shape, coords)).toBe(idx);
  });

  it("Number simDecode와 일치 (Number 범위 내)", () => {
    const numShape = [10, 20, 30];
    const bigShape = numShape.map(BigInt);
    for (let i = 0; i < 100; i++) {
      const numCoords = simDecode(numShape, i);
      const bigCoords = simDecodeBig(bigShape, BigInt(i));
      expect(bigCoords.map(Number)).toEqual(numCoords);
    }
  });
});

describe("[simPackUUIDBig] BigInt UUID 패킹", () => {
  it("Number simPackUUID와 일치 (Number 범위 내)", () => {
    for (let idx = 0; idx < 100; idx++) {
      const numUuid = simPackUUID(2, 0xAB, 1, 1, 0, 0, idx);
      const bigUuid = simPackUUIDBig(2, 0xAB, 1, 1, 0, 0, BigInt(idx));
      expect(bigUuid).toBe(numUuid);
    }
  });

  it("Number 범위 초과 인덱스 → hex에서 복원 가능", () => {
    const idx = 16n ** 29n - 1n;
    const uuid = simPackUUIDBig(2, 0xAB, 1, 1, 0, 0, idx);
    const raw = uuid.replace(/-/g, "");
    expect(raw.slice(3)).toBe("f".repeat(29));
  });

  it("UUID 형식 유지", () => {
    const uuid = simPackUUIDBig(2, 0xAB, 1, 1, 0, 0, 999999999999999999n);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ── §15. 추출된 유틸 함수 ───────────────────────────────────────────────────

describe("[fieldMaxVal] hex 필드 최대값", () => {
  it("chars=0 → 0", () => expect(fieldMaxVal(0)).toBe(0));
  it("chars=1 → 15", () => expect(fieldMaxVal(1)).toBe(15));
  it("chars=2 → 255", () => expect(fieldMaxVal(2)).toBe(255));
  it("chars=8 → 16^8-1", () => expect(fieldMaxVal(8)).toBe(16 ** 8 - 1));
});

describe("[logScalePercent] 로그 스케일 비율", () => {
  it("val=1 → 0%", () => expect(logScalePercent(1, 100)).toBe(0));
  it("val=max → 100%", () => expect(logScalePercent(100, 100)).toBe(100));
  it("max≤1 → 0%", () => expect(logScalePercent(5, 1)).toBe(0));
  it("sqrt(max) → ≈50%", () => {
    expect(logScalePercent(Math.sqrt(10000), 10000)).toBeCloseTo(50, 5);
  });
});

describe("[valToSlider / sliderToVal] 로그 스케일 라운드트립", () => {
  it("val=1 → position=0", () => expect(valToSlider(1, 1000)).toBe(0));
  it("val=dmax → position=resolution", () => expect(valToSlider(1000, 1000)).toBe(1000));
  it("라운드트립 근사", () => {
    for (const v of [1, 10, 100, 500, 999]) {
      const pos = valToSlider(v, 1000);
      const back = sliderToVal(pos, 1000);
      expect(Math.abs(back - v)).toBeLessThanOrEqual(Math.max(1, v * 0.05));
    }
  });
  it("custom resolution", () => {
    expect(valToSlider(100, 100, 500)).toBe(500);
    expect(sliderToVal(500, 100, 500)).toBe(100);
  });
});

describe("[varintByteSize] protobuf varint 크기", () => {
  it("0 → 1B", () => expect(varintByteSize(0)).toBe(1));
  it("127 → 1B", () => expect(varintByteSize(127)).toBe(1));
  it("128 → 2B", () => expect(varintByteSize(128)).toBe(2));
  it("16383 → 2B", () => expect(varintByteSize(16383)).toBe(2));
  it("16384 → 3B", () => expect(varintByteSize(16384)).toBe(3));
});
