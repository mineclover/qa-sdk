/**
 * Cross-index 종단 탐사 벤치마크
 *
 * 하위 WeightedIndex의 압축값이 상위 WeightedIndex의 차원으로 편입될 때,
 * 최상위 → 최하위 전체 경로를 decode/encode하는 종단(end-to-end) 성능을 측정한다.
 *
 * 구조:
 *   L0 (leaf)  : format(3) × lang(4)           = 12
 *   L1 (mid)   : doc_meta(→L0, 12) × priority(5) = 60
 *   L2 (top)   : article(→L1, 60) × region(8)    = 480
 *   L3 (deep)  : catalog(→L2, 480) × season(4)   = 1920
 *
 * 종단 탐사:
 *   encode: (format, lang, priority, region, season) → L3 index
 *   decode: L3 index → (format, lang, priority, region, season)
 */

import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./math/weighted-index.js";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function bench(fn: () => void, iterations: number) {
  // warm-up
  for (let i = 0; i < Math.min(iterations, 1000); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;

  return {
    totalMs,
    opsPerSec: Math.round((iterations / totalMs) * 1000),
    avgNs: Math.round((totalMs / iterations) * 1_000_000),
  };
}

// ── 시나리오 1: 2레벨 (기본 cross-index) ──────────────────────────────────

describe("2레벨 cross-index", () => {
  // L0: format(3) × lang(4) = 12
  // L1: doc_meta(→L0, 12) × priority(5) = 60
  const L0 = new WeightedIndex([3, 4], ["format", "lang"]);
  const L1 = new WeightedIndex([L0.size, 5], ["doc_meta", "priority"]);

  function encodeE2E(format: number, lang: number, priority: number): number {
    return L1.encodeUnsafe([L0.encodeUnsafe([format, lang]) + 1, priority]);
  }

  function decodeE2E(idx: number): [number, number, number] {
    const [docMeta, priority] = L1.decodeUnsafe(idx);
    const [format, lang] = L0.decodeUnsafe(docMeta - 1);
    return [format, lang, priority];
  }

  it("정합성 검증", () => {
    for (let f = 1; f <= 3; f++) {
      for (let l = 1; l <= 4; l++) {
        for (let p = 1; p <= 5; p++) {
          const idx = encodeE2E(f, l, p);
          expect(decodeE2E(idx)).toEqual([f, l, p]);
        }
      }
    }
  });

  it("성능 측정", () => {
    const ITER = 500_000;
    const enc = bench(() => encodeE2E(2, 3, 4), ITER);
    const dec = bench(() => decodeE2E(30), ITER);

    console.log("\n=== 2레벨 cross-index (3×4 → 12×5 = 60) ===");
    console.log(`encode E2E: ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode E2E: ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
  });
});

// ── 시나리오 2: 3레벨 ─────────────────────────────────────────────────────

describe("3레벨 cross-index", () => {
  // L0: format(3) × lang(4) = 12
  // L1: doc_meta(→L0, 12) × priority(5) = 60
  // L2: article(→L1, 60) × region(8) = 480
  const L0 = new WeightedIndex([3, 4], ["format", "lang"]);
  const L1 = new WeightedIndex([L0.size, 5], ["doc_meta", "priority"]);
  const L2 = new WeightedIndex([L1.size, 8], ["article", "region"]);

  function encodeE2E(format: number, lang: number, priority: number, region: number): number {
    const l0 = L0.encodeUnsafe([format, lang]);
    const l1 = L1.encodeUnsafe([l0 + 1, priority]);
    return L2.encodeUnsafe([l1 + 1, region]);
  }

  function decodeE2E(idx: number): [number, number, number, number] {
    const [article, region] = L2.decodeUnsafe(idx);
    const [docMeta, priority] = L1.decodeUnsafe(article - 1);
    const [format, lang] = L0.decodeUnsafe(docMeta - 1);
    return [format, lang, priority, region];
  }

  it("정합성 검증 (샘플)", () => {
    const samples = [
      [1, 1, 1, 1], [3, 4, 5, 8], [2, 2, 3, 4], [1, 4, 2, 7],
    ];
    for (const [f, l, p, r] of samples) {
      expect(decodeE2E(encodeE2E(f, l, p, r))).toEqual([f, l, p, r]);
    }
  });

  it("성능 측정", () => {
    const ITER = 500_000;
    const enc = bench(() => encodeE2E(2, 3, 4, 5), ITER);
    const dec = bench(() => decodeE2E(200), ITER);

    console.log("\n=== 3레벨 cross-index (3×4 → 12×5 → 60×8 = 480) ===");
    console.log(`encode E2E: ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode E2E: ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
  });
});

// ── 시나리오 3: 4레벨 (deep nesting) ─────────────────────────────────────

describe("4레벨 cross-index", () => {
  // L0: format(3) × lang(4) = 12
  // L1: doc_meta(→L0, 12) × priority(5) = 60
  // L2: article(→L1, 60) × region(8) = 480
  // L3: catalog(→L2, 480) × season(4) = 1920
  const L0 = new WeightedIndex([3, 4], ["format", "lang"]);
  const L1 = new WeightedIndex([L0.size, 5], ["doc_meta", "priority"]);
  const L2 = new WeightedIndex([L1.size, 8], ["article", "region"]);
  const L3 = new WeightedIndex([L2.size, 4], ["catalog", "season"]);

  function encodeE2E(f: number, l: number, p: number, r: number, s: number): number {
    const l0 = L0.encodeUnsafe([f, l]);
    const l1 = L1.encodeUnsafe([l0 + 1, p]);
    const l2 = L2.encodeUnsafe([l1 + 1, r]);
    return L3.encodeUnsafe([l2 + 1, s]);
  }

  function decodeE2E(idx: number): [number, number, number, number, number] {
    const [catalog, season] = L3.decodeUnsafe(idx);
    const [article, region] = L2.decodeUnsafe(catalog - 1);
    const [docMeta, priority] = L1.decodeUnsafe(article - 1);
    const [format, lang] = L0.decodeUnsafe(docMeta - 1);
    return [format, lang, priority, region, season];
  }

  it("정합성 검증 (샘플)", () => {
    const samples = [
      [1, 1, 1, 1, 1], [3, 4, 5, 8, 4], [2, 3, 2, 5, 3],
    ];
    for (const [f, l, p, r, s] of samples) {
      expect(decodeE2E(encodeE2E(f, l, p, r, s))).toEqual([f, l, p, r, s]);
    }
  });

  it("전체 공간 순회 정합성", () => {
    const seen = new Set<number>();
    let count = 0;
    for (let f = 1; f <= 3; f++)
      for (let l = 1; l <= 4; l++)
        for (let p = 1; p <= 5; p++)
          for (let r = 1; r <= 8; r++)
            for (let s = 1; s <= 4; s++) {
              const idx = encodeE2E(f, l, p, r, s);
              seen.add(idx);
              count++;
            }
    // 전단사 검증: 모든 조합이 고유한 인덱스
    expect(seen.size).toBe(count);
    expect(count).toBe(L3.size);
  });

  it("성능 측정", () => {
    const ITER = 500_000;
    const enc = bench(() => encodeE2E(2, 3, 4, 5, 3), ITER);
    const dec = bench(() => decodeE2E(1000), ITER);

    console.log("\n=== 4레벨 cross-index (3×4 → 12×5 → 60×8 → 480×4 = 1,920) ===");
    console.log(`encode E2E: ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode E2E: ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
  });
});

// ── 시나리오 4: 실제 SaaS 권한 모델 (넓은 하위 인덱스) ───────────────────

describe("SaaS 권한 cross-index", () => {
  // L0: role(10) × action(20) × resource(50) = 10,000 (권한 조합)
  // L1: permission(→L0, 10000) × tenant(100) = 1,000,000
  const L0 = new WeightedIndex([10, 20, 50], ["role", "action", "resource"]);
  const L1 = new WeightedIndex([L0.size, 100], ["permission", "tenant"]);

  function encodeE2E(role: number, action: number, resource: number, tenant: number): number {
    const perm = L0.encodeUnsafe([role, action, resource]);
    return L1.encodeUnsafe([perm + 1, tenant]);
  }

  function decodeE2E(idx: number): [number, number, number, number] {
    const [perm, tenant] = L1.decodeUnsafe(idx);
    const [role, action, resource] = L0.decodeUnsafe(perm - 1);
    return [role, action, resource, tenant];
  }

  it("정합성 검증", () => {
    const cases = [
      [1, 1, 1, 1], [10, 20, 50, 100], [5, 10, 25, 50],
    ];
    for (const [r, a, res, t] of cases) {
      expect(decodeE2E(encodeE2E(r, a, res, t))).toEqual([r, a, res, t]);
    }
  });

  it("성능 측정", () => {
    const ITER = 500_000;
    const enc = bench(() => encodeE2E(5, 10, 25, 50), ITER);
    const dec = bench(() => decodeE2E(500_000), ITER);

    console.log("\n=== SaaS 권한 2레벨 (10×20×50 → 10,000×100 = 1,000,000) ===");
    console.log(`encode E2E: ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode E2E: ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
    console.log(`L1 size:    ${L1.size.toLocaleString()}`);
  });
});

// ── 시나리오 5: 대규모 다단 (현실적 최대치) ──────────────────────────────

describe("대규모 다단 cross-index", () => {
  // L0: category(20) × subcategory(50)        = 1,000
  // L1: product(→L0, 1000) × variant(10)      = 10,000
  // L2: item(→L1, 10000) × warehouse(100)     = 1,000,000
  // L3: inventory(→L2, 1000000) × channel(5)  = 5,000,000
  const L0 = new WeightedIndex([20, 50], ["category", "subcategory"]);
  const L1 = new WeightedIndex([L0.size, 10], ["product", "variant"]);
  const L2 = new WeightedIndex([L1.size, 100], ["item", "warehouse"]);
  const L3 = new WeightedIndex([L2.size, 5], ["inventory", "channel"]);

  function encodeE2E(
    cat: number, sub: number, variant: number,
    warehouse: number, channel: number,
  ): number {
    const l0 = L0.encodeUnsafe([cat, sub]);
    const l1 = L1.encodeUnsafe([l0 + 1, variant]);
    const l2 = L2.encodeUnsafe([l1 + 1, warehouse]);
    return L3.encodeUnsafe([l2 + 1, channel]);
  }

  function decodeE2E(idx: number): [number, number, number, number, number] {
    const [inv, channel] = L3.decodeUnsafe(idx);
    const [item, warehouse] = L2.decodeUnsafe(inv - 1);
    const [prod, variant] = L1.decodeUnsafe(item - 1);
    const [cat, sub] = L0.decodeUnsafe(prod - 1);
    return [cat, sub, variant, warehouse, channel];
  }

  // zero-alloc 버전
  const buf3 = [0, 0];
  const buf2 = [0, 0];
  const buf1 = [0, 0];
  const buf0 = [0, 0];

  function decodeE2EZeroAlloc(idx: number): void {
    L3.decodeToUnsafe(idx, buf3);
    L2.decodeToUnsafe(buf3[0] - 1, buf2);
    L1.decodeToUnsafe(buf2[0] - 1, buf1);
    L0.decodeToUnsafe(buf1[0] - 1, buf0);
  }

  it("정합성 검증", () => {
    const cases = [
      [1, 1, 1, 1, 1],
      [20, 50, 10, 100, 5],
      [10, 25, 5, 50, 3],
    ];
    for (const [c, s, v, w, ch] of cases) {
      expect(decodeE2E(encodeE2E(c, s, v, w, ch))).toEqual([c, s, v, w, ch]);
    }
  });

  it("zero-alloc decode 정합성", () => {
    const idx = encodeE2E(10, 25, 5, 50, 3);
    decodeE2EZeroAlloc(idx);
    expect([buf0[0], buf0[1], buf1[1], buf2[1], buf3[1]]).toEqual([10, 25, 5, 50, 3]);
  });

  it("성능 측정", () => {
    const testIdx = encodeE2E(10, 25, 5, 50, 3);
    const ITER = 500_000;

    const enc = bench(() => encodeE2E(10, 25, 5, 50, 3), ITER);
    const dec = bench(() => decodeE2E(testIdx), ITER);
    const decZA = bench(() => decodeE2EZeroAlloc(testIdx), ITER);

    console.log("\n=== 대규모 4레벨 (20×50 → 1K×10 → 10K×100 → 1M×5 = 5,000,000) ===");
    console.log(`encode E2E:      ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode E2E:      ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
    console.log(`decode zero-alloc: ${decZA.opsPerSec.toLocaleString()} ops/s (${decZA.avgNs}ns)`);
    console.log(`L3 size:         ${L3.size.toLocaleString()}`);
  });
});

// ── 시나리오 6: 레벨 수 스케일링 비교 ────────────────────────────────────

describe("레벨 수 스케일링 (동일 총 차원 수, flat vs nested)", () => {
  // 6개 차원: 각 5
  // flat: WeightedIndex([5,5,5,5,5,5]) = 15,625
  // nested 2레벨: L0=[5,5,5] → 125, L1=[125,5,5,5] → 15,625
  // nested 3레벨: L0=[5,5] → 25, L1=[25,5] → 125, L2=[125,5,5,5] → 15,625
  // nested 6레벨: L0=[5] → 5, L1=[5,5]→25 ... 각 레벨마다 1차원 추가

  const flat = new WeightedIndex([5, 5, 5, 5, 5, 5]);

  // nested 2레벨
  const n2_L0 = new WeightedIndex([5, 5, 5]);
  const n2_L1 = new WeightedIndex([n2_L0.size, 5, 5, 5]);

  // nested 3레벨
  const n3_L0 = new WeightedIndex([5, 5]);
  const n3_L1 = new WeightedIndex([n3_L0.size, 5]);
  const n3_L2 = new WeightedIndex([n3_L1.size, 5, 5, 5]);

  const coords = [3, 3, 3, 3, 3, 3]; // 중앙값

  it("flat vs nested 정합성 — 동일 공간 크기", () => {
    expect(flat.size).toBe(15625);
    expect(n2_L1.size).toBe(15625);
    expect(n3_L2.size).toBe(15625);
  });

  it("성능 비교", () => {
    const ITER = 500_000;

    // flat encode/decode
    const flatIdx = flat.encodeUnsafe(coords);
    const flatEnc = bench(() => flat.encodeUnsafe(coords), ITER);
    const flatDec = bench(() => flat.decodeUnsafe(flatIdx), ITER);

    // nested 2레벨
    function n2Encode() {
      const l0 = n2_L0.encodeUnsafe([coords[0], coords[1], coords[2]]);
      return n2_L1.encodeUnsafe([l0 + 1, coords[3], coords[4], coords[5]]);
    }
    const n2Idx = n2Encode();
    function n2Decode() {
      const [ref, d3, d4, d5] = n2_L1.decodeUnsafe(n2Idx);
      const [d0, d1, d2] = n2_L0.decodeUnsafe(ref - 1);
      return [d0, d1, d2, d3, d4, d5];
    }
    const n2Enc = bench(n2Encode, ITER);
    const n2Dec = bench(n2Decode, ITER);

    // nested 3레벨
    function n3Encode() {
      const l0 = n3_L0.encodeUnsafe([coords[0], coords[1]]);
      const l1 = n3_L1.encodeUnsafe([l0 + 1, coords[2]]);
      return n3_L2.encodeUnsafe([l1 + 1, coords[3], coords[4], coords[5]]);
    }
    const n3Idx = n3Encode();
    function n3Decode() {
      const [ref2, d3, d4, d5] = n3_L2.decodeUnsafe(n3Idx);
      const [ref1, d2] = n3_L1.decodeUnsafe(ref2 - 1);
      const [d0, d1] = n3_L0.decodeUnsafe(ref1 - 1);
      return [d0, d1, d2, d3, d4, d5];
    }
    const n3Enc = bench(n3Encode, ITER);
    const n3Dec = bench(n3Decode, ITER);

    // 정합성
    expect(n2Decode()).toEqual(coords);
    expect(n3Decode()).toEqual(coords);

    console.log("\n=== flat vs nested (6차원, 각 5, 총 15,625) ===");
    console.log("          encode ops/s     decode ops/s     encode ns    decode ns");
    console.log(`flat:     ${flatEnc.opsPerSec.toLocaleString().padStart(14)} ${flatDec.opsPerSec.toLocaleString().padStart(14)}     ${String(flatEnc.avgNs).padStart(6)}       ${String(flatDec.avgNs).padStart(6)}`);
    console.log(`2레벨:   ${n2Enc.opsPerSec.toLocaleString().padStart(14)} ${n2Dec.opsPerSec.toLocaleString().padStart(14)}     ${String(n2Enc.avgNs).padStart(6)}       ${String(n2Dec.avgNs).padStart(6)}`);
    console.log(`3레벨:   ${n3Enc.opsPerSec.toLocaleString().padStart(14)} ${n3Dec.opsPerSec.toLocaleString().padStart(14)}     ${String(n3Enc.avgNs).padStart(6)}       ${String(n3Dec.avgNs).padStart(6)}`);
  });
});

// ── 시나리오 7: 풀 스페이스 순회 (전체 열거 속도) ────────────────────────

describe("풀 스페이스 종단 순회", () => {
  // L0: 5×5 = 25
  // L1: 25×5 = 125
  // L2: 125×5 = 625
  // 전체 625개를 순회하며 종단 decode
  const L0 = new WeightedIndex([5, 5]);
  const L1 = new WeightedIndex([L0.size, 5]);
  const L2 = new WeightedIndex([L1.size, 5]);

  it("전체 순회 성능", () => {
    const buf2 = [0, 0];
    const buf1 = [0, 0];
    const buf0 = [0, 0];

    // warm-up
    for (let i = 0; i < L2.size; i++) {
      L2.decodeToUnsafe(i, buf2);
      L1.decodeToUnsafe(buf2[0] - 1, buf1);
      L0.decodeToUnsafe(buf1[0] - 1, buf0);
    }

    const ROUNDS = 1000;
    const start = performance.now();
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < L2.size; i++) {
        L2.decodeToUnsafe(i, buf2);
        L1.decodeToUnsafe(buf2[0] - 1, buf1);
        L0.decodeToUnsafe(buf1[0] - 1, buf0);
      }
    }
    const elapsed = performance.now() - start;
    const totalOps = ROUNDS * L2.size;
    const opsPerSec = Math.round((totalOps / elapsed) * 1000);

    console.log(`\n=== 풀 스페이스 순회 (3레벨, ${L2.size}개 전수 decode × ${ROUNDS}회) ===`);
    console.log(`총 ${totalOps.toLocaleString()} ops in ${elapsed.toFixed(1)}ms`);
    console.log(`${opsPerSec.toLocaleString()} ops/s`);

    // 정합성: 첫/마지막 검증
    L2.decodeToUnsafe(0, buf2);
    L1.decodeToUnsafe(buf2[0] - 1, buf1);
    L0.decodeToUnsafe(buf1[0] - 1, buf0);
    expect([buf0[0], buf0[1], buf1[1], buf2[1]]).toEqual([1, 1, 1, 1]);

    L2.decodeToUnsafe(L2.size - 1, buf2);
    L1.decodeToUnsafe(buf2[0] - 1, buf1);
    L0.decodeToUnsafe(buf1[0] - 1, buf0);
    expect([buf0[0], buf0[1], buf1[1], buf2[1]]).toEqual([5, 5, 5, 5]);
  });
});
