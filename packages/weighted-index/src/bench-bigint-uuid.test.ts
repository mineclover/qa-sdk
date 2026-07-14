// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * BigInt / UUID 벤치마크
 *
 * 목적: layout-fit BigInt 모드 및 UUID 직렬화 계층의 성능을 측정하여
 *       Number 모드 대비 오버헤드를 정량화한다.
 *
 * 측정 항목:
 *   1. BigInt mixed-radix encode/decode — simEncodeBig vs simEncode
 *   2. BigInt UUID pack — simPackUUIDBig vs simPackUUID
 *   3. BigInt 레이아웃 계산 — clampShape, dimMaxBig, computeLayoutViewModel
 *   4. UUID 문자열 변환 — toUUID/fromUUID, toStructuredUUID/fromStructuredUUID
 *   5. UUID 필드 pack/unpack — packUUID/unpackUUID, planLayout
 *   6. 포맷 유틸 — formatHex/parseHex, hexBoundary
 */

import { describe, it, expect } from 'vitest';
import {
  simEncode,
  simDecode,
  simEncodeBig,
  simDecodeBig,
  simPackUUID,
  simPackUUIDBig,
  clampShape,
  dimMaxForBudget,
  dimMaxBig,
  dimMaxApprox,
  computeLayoutViewModel,
  analyzeLayoutSim,
  utilizationBig,
  maxProductBig,
  autoBalancedShape,
  productExcluding,
} from './math/layout-fit.js';
import { toUUID, fromUUID, toStructuredUUID, fromStructuredUUID } from './obfuscate/uuid.js';
import { createUUIDLayout, packUUID, unpackUUID, planLayout } from './protocol/uuid-layout.js';
import {
  formatHex,
  parseHex,
  hexBoundary,
  hexCeil,
  hexFloor,
  PACK_FORMATS,
} from './protocol/pack-format.js';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function bench(fn: () => void, iterations: number) {
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

function fmtOps(n: number): string {
  return n.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
//  §1. BigInt mixed-radix encode/decode
// ═══════════════════════════════════════════════════════════════════════════

describe('§1 BigInt encode/decode — Number 대비 성능', () => {
  const cases = [
    { label: '3D (10×20×50)', shape: [10, 20, 50], coords: [5, 10, 25] },
    { label: '4D (16×16×16×16)', shape: [16, 16, 16, 16], coords: [8, 8, 8, 8] },
    { label: '6D (5×5×5×5×5×5)', shape: [5, 5, 5, 5, 5, 5], coords: [3, 3, 3, 3, 3, 3] },
    {
      label: '8D (10×8×6×5×4×3×3×2)',
      shape: [10, 8, 6, 5, 4, 3, 3, 2],
      coords: [5, 4, 3, 3, 2, 2, 2, 1],
    },
  ];

  const ITER = 200_000;

  const results: Array<{
    label: string;
    numEncOps: string;
    bigEncOps: string;
    encRatio: string;
    numDecOps: string;
    bigDecOps: string;
    decRatio: string;
  }> = [];

  it.each(cases)('$label', ({ label, shape, coords }) => {
    const bigShape = shape.map(BigInt);
    const bigCoords = coords.map(BigInt);
    const numIdx = simEncode(shape, coords);
    const bigIdx = simEncodeBig(bigShape, bigCoords);

    // 정합성
    expect(Number(bigIdx)).toBe(numIdx);
    const decNum = simDecode(shape, numIdx);
    const decBig = simDecodeBig(bigShape, bigIdx);
    expect(decBig.map(Number)).toEqual(decNum);

    const numEnc = bench(() => simEncode(shape, coords), ITER);
    const bigEnc = bench(() => simEncodeBig(bigShape, bigCoords), ITER);
    const numDec = bench(() => simDecode(shape, numIdx), ITER);
    const bigDec = bench(() => simDecodeBig(bigShape, bigIdx), ITER);

    results.push({
      label,
      numEncOps: fmtOps(numEnc.opsPerSec),
      bigEncOps: fmtOps(bigEnc.opsPerSec),
      encRatio: (numEnc.opsPerSec / bigEnc.opsPerSec).toFixed(1) + 'x',
      numDecOps: fmtOps(numDec.opsPerSec),
      bigDecOps: fmtOps(bigDec.opsPerSec),
      decRatio: (numDec.opsPerSec / bigDec.opsPerSec).toFixed(1) + 'x',
    });
  });

  it('결과 테이블', () => {
    console.log('\n=== §1 BigInt encode/decode vs Number ===');
    console.table(results);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §2. BigInt UUID pack — simPackUUIDBig vs simPackUUID
// ═══════════════════════════════════════════════════════════════════════════

describe('§2 BigInt UUID pack — Number 대비 성능', () => {
  const ITER = 200_000;
  // prefix=2chars, version=1char, shard=0, index=29chars budget
  const pChars = 2,
    pVal = 0xab;
  const vChars = 1,
    vVal = 3;
  const sChars = 0,
    sVal = 0;
  const numIdx = 123456789;
  const bigIdx = BigInt(numIdx);

  it('정합성 — 동일 입력 시 동일 UUID', () => {
    const uuidNum = simPackUUID(pChars, pVal, vChars, vVal, sChars, sVal, numIdx);
    const uuidBig = simPackUUIDBig(pChars, pVal, vChars, vVal, sChars, sVal, bigIdx);
    expect(uuidBig).toBe(uuidNum);
  });

  it('성능 비교', () => {
    const numPack = bench(
      () => simPackUUID(pChars, pVal, vChars, vVal, sChars, sVal, numIdx),
      ITER,
    );
    const bigPack = bench(
      () => simPackUUIDBig(pChars, pVal, vChars, vVal, sChars, sVal, bigIdx),
      ITER,
    );

    console.log('\n=== §2 UUID pack: Number vs BigInt ===');
    console.log(`Number simPackUUID:    ${fmtOps(numPack.opsPerSec)} ops/s (${numPack.avgNs}ns)`);
    console.log(`BigInt simPackUUIDBig: ${fmtOps(bigPack.opsPerSec)} ops/s (${bigPack.avgNs}ns)`);
    console.log(`비율: Number가 ${(numPack.opsPerSec / bigPack.opsPerSec).toFixed(1)}x 빠름`);
  });

  it('BigInt 대용량 인덱스 — MAX_SAFE_INTEGER 초과', () => {
    const hugeIdx = 16n ** 29n - 1n; // 29 hex chars 최대값
    const uuid = simPackUUIDBig(pChars, pVal, vChars, vVal, sChars, sVal, hugeIdx);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const hugePack = bench(
      () => simPackUUIDBig(pChars, pVal, vChars, vVal, sChars, sVal, hugeIdx),
      ITER,
    );
    console.log(`BigInt huge (16^29-1): ${fmtOps(hugePack.opsPerSec)} ops/s (${hugePack.avgNs}ns)`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §3. BigInt 레이아웃 계산 — clampShape / dimMax / ViewModel
// ═══════════════════════════════════════════════════════════════════════════

describe('§3 BigInt 레이아웃 계산', () => {
  const ITER = 100_000;

  describe('§3a clampShape — bigint vs number 모드', () => {
    const cases = [
      { label: 'budget=13 (Number 안전)', budget: 13, shape: [100, 100, 100] },
      { label: 'budget=20 (BigInt 필요)', budget: 20, shape: [10000, 10000, 10000] },
      { label: 'budget=29 (UUID 전체)', budget: 29, shape: [100000, 100000, 100000] },
    ];

    const results: Array<{
      label: string;
      numOps: string;
      bigOps: string;
      ratio: string;
    }> = [];

    it.each(cases)('$label', ({ label, budget, shape }) => {
      const numClamp = bench(() => clampShape(shape, budget, 'number'), ITER);
      const bigClamp = bench(() => clampShape(shape, budget, 'bigint'), ITER);

      // 정합성: clamp된 shape의 곱이 유효 범위 내
      const clamped = clampShape(shape, budget, 'bigint');
      const product = clamped.reduce((a, b) => a * b, 1);
      expect(product).toBeLessThanOrEqual(Number(16n ** BigInt(budget)));

      results.push({
        label,
        numOps: fmtOps(numClamp.opsPerSec),
        bigOps: fmtOps(bigClamp.opsPerSec),
        ratio: (numClamp.opsPerSec / bigClamp.opsPerSec).toFixed(1) + 'x',
      });
    });

    it('결과 테이블', () => {
      console.log('\n=== §3a clampShape: Number vs BigInt 모드 ===');
      console.table(results);
    });
  });

  describe('§3b dimMax 변형 비교', () => {
    const cases = [
      { label: 'budget=10, others=100', budget: 10, others: 100 },
      { label: 'budget=20, others=1000', budget: 20, others: 1000 },
      { label: 'budget=29, others=1e6', budget: 29, others: 1_000_000 },
    ];

    const results: Array<{
      label: string;
      forBudgetOps: string;
      bigOps: string;
      approxOps: string;
    }> = [];

    it.each(cases)('$label', ({ label, budget, others }) => {
      const fBudget = bench(() => dimMaxForBudget(budget, others), ITER);
      const fBig = bench(() => dimMaxBig(budget, others), ITER);
      const fApprox = bench(() => dimMaxApprox(budget, others), ITER);

      results.push({
        label,
        forBudgetOps: fmtOps(fBudget.opsPerSec),
        bigOps: fmtOps(fBig.opsPerSec),
        approxOps: fmtOps(fApprox.opsPerSec),
      });
    });

    it('결과 테이블', () => {
      console.log('\n=== §3b dimMax 변형: forBudget(Number) / Big / Approx ===');
      console.table(results);
    });
  });

  describe('§3c computeLayoutViewModel — bigint vs number 모드', () => {
    const cfg = { prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 };
    const analysis = analyzeLayoutSim(cfg);
    const shape = autoBalancedShape(4, analysis.indexBudget);

    it('성능 비교', () => {
      const numVM = bench(() => computeLayoutViewModel(analysis, shape, 'number'), ITER);
      const bigVM = bench(() => computeLayoutViewModel(analysis, shape, 'bigint'), ITER);

      // 정합성
      const vm = computeLayoutViewModel(analysis, shape, 'bigint');
      expect(vm.mode).toBe('bigint');
      expect(vm.isCapped).toBe(false);

      console.log('\n=== §3c computeLayoutViewModel (4D, budget=29) ===');
      console.log(`Number 모드: ${fmtOps(numVM.opsPerSec)} ops/s (${numVM.avgNs}ns)`);
      console.log(`BigInt 모드: ${fmtOps(bigVM.opsPerSec)} ops/s (${bigVM.avgNs}ns)`);
      console.log(`비율: Number가 ${(numVM.opsPerSec / bigVM.opsPerSec).toFixed(1)}x 빠름`);
    });
  });

  describe('§3d utilizationBig / maxProductBig', () => {
    it('성능 측정', () => {
      const product = 1e30;
      const budget = 29;

      const utilB = bench(() => utilizationBig(product, budget), ITER);
      const maxPB = bench(() => maxProductBig(budget), ITER);

      console.log('\n=== §3d BigInt 유틸리티 (budget=29) ===');
      console.log(`utilizationBig: ${fmtOps(utilB.opsPerSec)} ops/s (${utilB.avgNs}ns)`);
      console.log(`maxProductBig:  ${fmtOps(maxPB.opsPerSec)} ops/s (${maxPB.avgNs}ns)`);

      // 정합성
      expect(maxProductBig(29)).toBe(16n ** 29n);
      const util = utilizationBig(product, budget);
      expect(util).toBeGreaterThan(0);
      expect(util).toBeLessThan(100);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §4. UUID 직렬화 — toUUID/fromUUID, toStructuredUUID/fromStructuredUUID
// ═══════════════════════════════════════════════════════════════════════════

describe('§4 UUID 문자열 변환', () => {
  const ITER = 200_000;

  describe('§4a toUUID / fromUUID 라운드트립', () => {
    const cases = [
      { label: '8bit (id=200)', id: 200, bitWidth: 8 },
      { label: '16bit (id=50000)', id: 50000, bitWidth: 16 },
      { label: '24bit (id=1e7)', id: 10_000_000, bitWidth: 24 },
      { label: '30bit (id=1e9)', id: 1_000_000_000, bitWidth: 30 },
    ];

    const results: Array<{
      label: string;
      toOps: string;
      fromOps: string;
      roundtripOps: string;
    }> = [];

    it.each(cases)('$label', ({ label, id, bitWidth }) => {
      // 정합성
      expect(fromUUID(toUUID(id, bitWidth), bitWidth)).toBe(id);

      const toB = bench(() => toUUID(id, bitWidth), ITER);
      const fromB = bench(() => fromUUID(toUUID(id, bitWidth), bitWidth), ITER);
      const rtB = bench(() => {
        const uuid = toUUID(id, bitWidth);
        fromUUID(uuid, bitWidth);
      }, ITER);

      results.push({
        label,
        toOps: fmtOps(toB.opsPerSec),
        fromOps: fmtOps(fromB.opsPerSec),
        roundtripOps: fmtOps(rtB.opsPerSec),
      });
    });

    it('결과 테이블', () => {
      console.log('\n=== §4a toUUID / fromUUID ===');
      console.table(results);
    });
  });

  describe('§4b toStructuredUUID / fromStructuredUUID', () => {
    const cases = [
      {
        label: '3필드 (4+8+10=22bit)',
        fields: [
          { value: 2, bitWidth: 4 },
          { value: 7, bitWidth: 8 },
          { value: 42, bitWidth: 10 },
        ],
        bitWidths: [4, 8, 10],
        expected: [2, 7, 42],
      },
      {
        label: '4필드 (8+8+16+16=48bit)',
        fields: [
          { value: 0xab, bitWidth: 8 },
          { value: 3, bitWidth: 8 },
          { value: 1000, bitWidth: 16 },
          { value: 50000, bitWidth: 16 },
        ],
        bitWidths: [8, 8, 16, 16],
        expected: [0xab, 3, 1000, 50000],
      },
      {
        label: '6필드 (4+4+8+8+16+24=64bit)',
        fields: [
          { value: 15, bitWidth: 4 },
          { value: 7, bitWidth: 4 },
          { value: 200, bitWidth: 8 },
          { value: 100, bitWidth: 8 },
          { value: 60000, bitWidth: 16 },
          { value: 1000000, bitWidth: 24 },
        ],
        bitWidths: [4, 4, 8, 8, 16, 24],
        expected: [15, 7, 200, 100, 60000, 1000000],
      },
    ];

    const results: Array<{
      label: string;
      encodeOps: string;
      decodeOps: string;
      roundtripOps: string;
    }> = [];

    it.each(cases)('$label', ({ label, fields, bitWidths, expected }) => {
      const token = toStructuredUUID(fields);
      const decoded = fromStructuredUUID(token, bitWidths);
      expect(decoded).toEqual(expected);

      const encB = bench(() => toStructuredUUID(fields), ITER);
      const decB = bench(() => fromStructuredUUID(token, bitWidths), ITER);
      const rtB = bench(() => {
        const t = toStructuredUUID(fields);
        fromStructuredUUID(t, bitWidths);
      }, ITER);

      results.push({
        label,
        encodeOps: fmtOps(encB.opsPerSec),
        decodeOps: fmtOps(decB.opsPerSec),
        roundtripOps: fmtOps(rtB.opsPerSec),
      });
    });

    it('결과 테이블', () => {
      console.log('\n=== §4b toStructuredUUID / fromStructuredUUID ===');
      console.table(results);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §5. UUID 레이아웃 — packUUID/unpackUUID, planLayout
// ═══════════════════════════════════════════════════════════════════════════

describe('§5 UUID 필드 pack/unpack', () => {
  const ITER = 200_000;

  describe('§5a packUUID / unpackUUID 라운드트립', () => {
    const layout = createUUIDLayout({
      left: [
        { name: 'prefix', chars: 4 },
        { name: 'version', chars: 2 },
      ],
      right: [
        { name: 'shard', chars: 2 },
        { name: 'index', chars: 6 },
      ],
    });
    const values = { prefix: 0xabcd, version: 1, shard: 5, index: 123456 };

    it('정합성', () => {
      const uuid = packUUID(layout, values);
      const unpacked = unpackUUID(layout, uuid);
      expect(unpacked).toEqual(values);
    });

    it('성능 측정', () => {
      const uuid = packUUID(layout, values);
      const packB = bench(() => packUUID(layout, values), ITER);
      const unpackB = bench(() => unpackUUID(layout, uuid), ITER);
      const rtB = bench(() => {
        const u = packUUID(layout, values);
        unpackUUID(layout, u);
      }, ITER);

      console.log('\n=== §5a packUUID / unpackUUID (4필드: prefix+version+shard+index) ===');
      console.log(`pack:      ${fmtOps(packB.opsPerSec)} ops/s (${packB.avgNs}ns)`);
      console.log(`unpack:    ${fmtOps(unpackB.opsPerSec)} ops/s (${unpackB.avgNs}ns)`);
      console.log(`roundtrip: ${fmtOps(rtB.opsPerSec)} ops/s (${rtB.avgNs}ns)`);
    });
  });

  describe('§5b planLayout — 스키마 생성 성능', () => {
    it('성능 측정', () => {
      const planB = bench(
        () =>
          planLayout({
            left: [
              { name: 'prefix', chars: 4 },
              { name: 'version', maxValue: 15 },
            ],
            right: [{ name: 'index', maxValue: 999999 }],
          }),
        ITER,
      );

      console.log('\n=== §5b planLayout (left: prefix+version, right: index) ===');
      console.log(`planLayout: ${fmtOps(planB.opsPerSec)} ops/s (${planB.avgNs}ns)`);

      // 정합성
      const plan = planLayout({
        left: [
          { name: 'prefix', chars: 4 },
          { name: 'version', maxValue: 15 },
        ],
        right: [{ name: 'index', maxValue: 999999 }],
      });
      expect(plan.fitsUUID).toBe(true);
      expect(plan.layout).toBeDefined();
    });
  });

  describe('§5c createUUIDLayout — 구성 생성 성능', () => {
    it('성능 측정', () => {
      const createB = bench(
        () =>
          createUUIDLayout({
            left: [
              { name: 'prefix', chars: 4 },
              { name: 'version', chars: 2 },
            ],
            right: [
              { name: 'shard', chars: 2 },
              { name: 'index', chars: 6 },
            ],
          }),
        ITER,
      );

      console.log('\n=== §5c createUUIDLayout (4슬롯) ===');
      console.log(`create: ${fmtOps(createB.opsPerSec)} ops/s (${createB.avgNs}ns)`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §6. 포맷 유틸 — formatHex/parseHex, hexBoundary/hexCeil/hexFloor
// ═══════════════════════════════════════════════════════════════════════════

describe('§6 포맷 유틸리티', () => {
  const ITER = 200_000;

  describe('§6a formatHex / parseHex (UUID 포맷)', () => {
    const rawHex = 'abcd0100000000000000000000000042';
    const formatted = 'abcd0100-0000-0000-0000-000000000042';

    it('정합성', () => {
      expect(formatHex(PACK_FORMATS.uuid, rawHex)).toBe(formatted);
      expect(parseHex(formatted)).toBe(rawHex);
    });

    it('성능 측정', () => {
      const fmtB = bench(() => formatHex(PACK_FORMATS.uuid, rawHex), ITER);
      const parseB = bench(() => parseHex(formatted), ITER);

      console.log('\n=== §6a formatHex / parseHex (UUID) ===');
      console.log(`formatHex: ${fmtOps(fmtB.opsPerSec)} ops/s (${fmtB.avgNs}ns)`);
      console.log(`parseHex:  ${fmtOps(parseB.opsPerSec)} ops/s (${parseB.avgNs}ns)`);
    });
  });

  describe('§6b hexBoundary / hexCeil / hexFloor', () => {
    const values = [16, 255, 1000, 4096, 65535, 1_000_000];

    const results: Array<{
      value: number;
      boundaryOps: string;
      ceilOps: string;
      floorOps: string;
    }> = [];

    it.each(values)('value=%d', (value) => {
      // 정합성
      const hb = hexBoundary(value);
      expect(hb.value).toBe(value);
      expect(hexCeil(value)).toBeGreaterThanOrEqual(value);
      expect(hexFloor(value)).toBeLessThanOrEqual(value);

      const boundB = bench(() => hexBoundary(value), ITER);
      const ceilB = bench(() => hexCeil(value), ITER);
      const floorB = bench(() => hexFloor(value), ITER);

      results.push({
        value,
        boundaryOps: fmtOps(boundB.opsPerSec),
        ceilOps: fmtOps(ceilB.opsPerSec),
        floorOps: fmtOps(floorB.opsPerSec),
      });
    });

    it('결과 테이블', () => {
      console.log('\n=== §6b hexBoundary / hexCeil / hexFloor ===');
      console.table(results);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §7. 종합 시나리오 — BigInt UUID 패킹 E2E
// ═══════════════════════════════════════════════════════════════════════════

describe('§7 종합: BigInt 기반 UUID 인덱싱 E2E', () => {
  // 시나리오: 4D shape → BigInt encode → UUID pack → parse → decode
  const shape = [100, 200, 50, 80] as const;
  const bigShape = shape.map(BigInt);
  const coords = [42, 100, 25, 40];
  const bigCoords = coords.map(BigInt);
  const ITER = 100_000;

  it('Number E2E: encode → packUUID → unpackUUID → decode', () => {
    const layout = createUUIDLayout({
      left: [{ name: 'prefix', chars: 2 }],
      right: [{ name: 'index', chars: 8 }],
    });

    const e2e = bench(() => {
      const idx = simEncode([...shape], coords);
      const uuid = packUUID(layout, { prefix: 0xab, index: idx });
      const unpacked = unpackUUID(layout, uuid);
      simDecode([...shape], unpacked.index);
    }, ITER);

    // 정합성
    const idx = simEncode([...shape], coords);
    const uuid = packUUID(layout, { prefix: 0xab, index: idx });
    const unpacked = unpackUUID(layout, uuid);
    expect(simDecode([...shape], unpacked.index)).toEqual(coords);

    console.log('\n=== §7 종합 E2E (4D: 100×200×50×80) ===');
    console.log(`Number E2E: ${fmtOps(e2e.opsPerSec)} ops/s (${e2e.avgNs}ns)`);
  });

  it('BigInt E2E: encodeBig → packUUIDBig → parse → decodeBig', () => {
    const e2e = bench(() => {
      const idx = simEncodeBig(bigShape, bigCoords);
      const uuid = simPackUUIDBig(2, 0xab, 0, 0, 0, 0, idx);
      // parse back: strip dashes, extract index hex
      const hex = uuid.replace(/-/g, '');
      const idxBack = BigInt('0x' + hex.slice(2));
      simDecodeBig(bigShape, idxBack);
    }, ITER);

    // 정합성
    const idx = simEncodeBig(bigShape, bigCoords);
    const uuid = simPackUUIDBig(2, 0xab, 0, 0, 0, 0, idx);
    const hex = uuid.replace(/-/g, '');
    const idxBack = BigInt('0x' + hex.slice(2));
    expect(simDecodeBig(bigShape, idxBack).map(Number)).toEqual(coords);

    console.log(`BigInt E2E: ${fmtOps(e2e.opsPerSec)} ops/s (${e2e.avgNs}ns)`);
  });

  it('BigInt E2E — MAX_SAFE_INTEGER 초과 인덱스', () => {
    // 대규모 shape: Number로 표현 불가능한 공간
    const hugeShape = [100000n, 100000n, 100000n, 100000n]; // 10^20 > 2^53
    const hugeCoords = [50000n, 50000n, 50000n, 50000n];

    const idx = simEncodeBig(hugeShape, hugeCoords);
    expect(idx > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);

    const e2e = bench(() => {
      const i = simEncodeBig(hugeShape, hugeCoords);
      const uuid = simPackUUIDBig(2, 0xab, 0, 0, 0, 0, i);
      const hex = uuid.replace(/-/g, '');
      const iBack = BigInt('0x' + hex.slice(2));
      simDecodeBig(hugeShape, iBack);
    }, ITER);

    // 정합성
    const uuid = simPackUUIDBig(2, 0xab, 0, 0, 0, 0, idx);
    const hex = uuid.replace(/-/g, '');
    const idxBack = BigInt('0x' + hex.slice(2));
    expect(simDecodeBig(hugeShape, idxBack)).toEqual(hugeCoords);

    console.log(`BigInt huge E2E (10K^4 > 2^53): ${fmtOps(e2e.opsPerSec)} ops/s (${e2e.avgNs}ns)`);
  });
});
