/**
 * format-adapter.test.ts — WeightedIndex 순수 수학 + 외부 포맷 어댑터 검증
 *
 * WeightedIndex는 shape만 알면 동작하며 직렬화 포맷을 모른다.
 * 포맷 적합성은 외부 유틸(어댑터)이 shape/size를 읽어 사후 판단한다.
 * 이 테스트는 그 분리가 실제로 동작하는지 검증한다.
 */
import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./weighted-index.js";
import { WeightedIndexBig } from "./weighted-index-big.js";
import { shapeProduct, maxProductBig } from "./layout-fit.js";
import { charsForMax } from "./uuid-layout.js";
import { calcWeightsBig } from "./calc-big.js";

// ── 어댑터: WeightedIndex 외부에서 포맷 호환성을 판단하는 순수 함수들 ────────

/** shape product를 BigInt로 정확히 계산 (Number 오버플로 없음) */
function computeProductBig(shape: readonly number[]): bigint {
  let p = 1n;
  for (const s of shape) p *= BigInt(s);
  return p;
}

/** Number.MAX_SAFE_INTEGER 이내인지 */
function fitsJSNumber(shape: readonly number[]): boolean {
  return computeProductBig(shape) <= BigInt(Number.MAX_SAFE_INTEGER);
}

/** 주어진 hex chars 예산에 맞는지 (UUID index field 등) */
function fitsHexBudget(shape: readonly number[], hexChars: number): boolean {
  const maxVal = (1n << BigInt(hexChars * 4)) - 1n;
  return computeProductBig(shape) - 1n <= maxVal;
}

/** 64-bit 정수에 맞는지 */
function fits64Bit(shape: readonly number[]): boolean {
  return computeProductBig(shape) <= 0xFFFF_FFFF_FFFF_FFFFn;
}

/** 포맷 호환성 리포트 */
interface FormatReport {
  product: bigint;
  fitsJSNumber: boolean;
  hexCharsNeeded: number | null; // null if product > Number.MAX_SAFE_INTEGER
  fitsUUID24: boolean;
  fits64Bit: boolean;
}

function analyzeFormat(shape: readonly number[]): FormatReport {
  const product = computeProductBig(shape);
  const jsNumber = product <= BigInt(Number.MAX_SAFE_INTEGER);
  return {
    product,
    fitsJSNumber: jsNumber,
    hexCharsNeeded: jsNumber ? charsForMax(Number(product) - 1) : null,
    fitsUUID24: fitsHexBudget(shape, 24),
    fits64Bit: product <= 0xFFFF_FFFF_FFFF_FFFFn,
  };
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe("WeightedIndex 순수 수학 + 외부 포맷 어댑터", () => {
  describe("WeightedIndex는 포맷을 모른다", () => {
    it("shape만으로 생성되고 encode/decode한다 — 직렬화 포맷 무관", () => {
      const wi = new WeightedIndex([10, 20, 30]);
      // 순수 수학: 좌표 → 정수 → 좌표 왕복
      const addr = wi.encode([3, 7, 15]);
      const coords = wi.decode(addr);
      expect(coords).toEqual([3, 7, 15]);
      // wi에는 포맷 관련 메서드/필드가 없다
      expect("hexChars" in wi).toBe(false);
      expect("format" in wi).toBe(false);
      expect("numberType" in wi).toBe(false);
    });

    it("WeightedIndexBig도 동일하게 순수 수학이다", () => {
      const wi = new WeightedIndexBig([10n, 20n, 30n]);
      const addr = wi.encode([3n, 7n, 15n]);
      const coords = wi.decode(addr);
      expect(coords).toEqual([3n, 7n, 15n]);
      expect("hexChars" in wi).toBe(false);
      expect("numberType" in wi).toBe(false);
    });
  });

  describe("어댑터가 사후에 포맷 적합성을 판단한다", () => {
    it("작은 shape — 모든 포맷에 적합", () => {
      const shape = [3, 4, 5]; // product = 60
      const wi = new WeightedIndex(shape);
      expect(wi.size).toBe(60);

      // 어댑터: 외부에서 shape을 읽어 판단
      const report = analyzeFormat(shape);
      expect(report.product).toBe(60n);
      expect(report.fitsJSNumber).toBe(true);
      expect(report.hexCharsNeeded).toBe(2); // 0x3b = 59
      expect(report.fitsUUID24).toBe(true);
      expect(report.fits64Bit).toBe(true);
    });

    it("중간 shape — Number OK, UUID OK", () => {
      const shape = [1000, 1000, 1000]; // product = 10^9
      const wi = new WeightedIndex(shape);
      expect(wi.size).toBe(1_000_000_000);

      const report = analyzeFormat(shape);
      expect(report.fitsJSNumber).toBe(true);
      expect(report.hexCharsNeeded).toBe(8); // 0x3B9AC9FF
      expect(report.fitsUUID24).toBe(true);
      expect(report.fits64Bit).toBe(true);
    });

    it("대형 shape — Number 초과, UUID는 가능", () => {
      // 6개 dim × 1000 = 10^18 > 2^53
      const shape = [1000, 1000, 1000, 1000, 1000, 1000];

      // Number 기반 WeightedIndex는 ShapeError 발생
      expect(() => new WeightedIndex(shape)).toThrow();

      // 어댑터가 사전에 감지 가능
      const report = analyzeFormat(shape);
      expect(report.product).toBe(1_000_000_000_000_000_000n);
      expect(report.fitsJSNumber).toBe(false);
      expect(report.hexCharsNeeded).toBeNull(); // Number 초과이므로 계산 불가
      expect(report.fitsUUID24).toBe(true); // 16^24 >> 10^18
      expect(report.fits64Bit).toBe(true); // 10^18 < 2^64

      // BigInt 경로로 전환하면 동작
      const wiBig = new WeightedIndexBig(shape.map(BigInt));
      expect(wiBig.size).toBe(1_000_000_000_000_000_000n);
      const addr = wiBig.encode([500n, 500n, 500n, 500n, 500n, 500n]);
      expect(wiBig.decode(addr)).toEqual([500n, 500n, 500n, 500n, 500n, 500n]);
    });

    it("초대형 shape — 64-bit 초과, UUID도 불가능", () => {
      // 10개 dim × 1000 = 10^30 > 2^64 > 16^24
      const shape = Array.from({ length: 10 }, () => 1000);

      const report = analyzeFormat(shape);
      expect(report.product).toBe(10n ** 30n);
      expect(report.fitsJSNumber).toBe(false);
      expect(report.fitsUUID24).toBe(false); // 10^30 > 16^24 ≈ 10^28
      expect(report.fits64Bit).toBe(false); // 10^30 > 2^64 ≈ 1.8 × 10^19

      // BigInt 수학은 여전히 동작 — 포맷만 못 쓸 뿐
      const wiBig = new WeightedIndexBig(shape.map(BigInt));
      expect(wiBig.size).toBe(10n ** 30n);
      const addr = wiBig.encode(shape.map(() => 1n));
      expect(wiBig.decode(addr)).toEqual(shape.map(() => 1n));
    });
  });

  describe("실시간 감지: encode 결과로 포맷 호환성 확인", () => {
    it("encode 결과를 사후 검사하여 포맷 안전성 확인", () => {
      const wi = new WeightedIndex([100, 100, 100]); // product = 10^6

      // 최대 좌표의 주소
      const maxAddr = wi.encode([100, 100, 100]);
      expect(maxAddr).toBe(999_999);

      // 사후 감지: 이 주소가 특정 hex 예산에 맞는가?
      const hexNeeded = charsForMax(maxAddr);
      expect(hexNeeded).toBe(5); // 0xF423F

      // 3 hex chars 예산이면 부족 (max 4095)
      expect(maxAddr <= 16 ** 3 - 1).toBe(false);
      // 6 hex chars 예산이면 충분 (max 16,777,215)
      expect(maxAddr <= 16 ** 6 - 1).toBe(true);
    });

    it("BigInt encode 결과도 사후 검사 가능", () => {
      const shape = [1000, 1000, 1000, 1000, 1000, 1000].map(BigInt);
      const wi = new WeightedIndexBig(shape);

      const addr = wi.encode([999n, 999n, 999n, 999n, 999n, 999n]);

      // 사후 감지: 64-bit에 맞는가?
      expect(addr <= 0xFFFF_FFFF_FFFF_FFFFn).toBe(true);
      // UUID 24 hex chars에 맞는가?
      expect(addr < 16n ** 24n).toBe(true);
    });
  });

  describe("어댑터 경로 선택: shape → 최적 엔진 자동 결정", () => {
    /**
     * 핵심 시나리오: shape만 보고 어떤 엔진(Number/BigInt)과
     * 어떤 포맷(int64/UUID/custom)을 쓸지 자동 결정.
     * WeightedIndex 자체는 이 판단에 관여하지 않는다.
     */
    function selectEngine(shape: number[]) {
      const product = computeProductBig(shape);
      const jsNumber = product <= BigInt(Number.MAX_SAFE_INTEGER);
      return {
        engine: jsNumber ? "number" : "bigint" as const,
        create: jsNumber
          ? () => new WeightedIndex(shape)
          : () => new WeightedIndexBig(shape.map(BigInt)),
        formats: {
          int64: product <= 0xFFFF_FFFF_FFFF_FFFFn,
          uuid24: product - 1n < 16n ** 24n,
        },
      };
    }

    it("작은 shape → Number 엔진 + 모든 포맷", () => {
      const sel = selectEngine([10, 20, 30]);
      expect(sel.engine).toBe("number");
      expect(sel.formats.int64).toBe(true);
      expect(sel.formats.uuid24).toBe(true);

      const wi = sel.create();
      expect(wi).toBeInstanceOf(WeightedIndex);
    });

    it("대형 shape → BigInt 엔진 + 제한된 포맷", () => {
      const sel = selectEngine([1000, 1000, 1000, 1000, 1000, 1000]);
      expect(sel.engine).toBe("bigint");
      expect(sel.formats.int64).toBe(true);
      expect(sel.formats.uuid24).toBe(true);

      const wi = sel.create();
      expect(wi).toBeInstanceOf(WeightedIndexBig);
    });

    it("초대형 shape → BigInt 엔진 + 포맷 불가", () => {
      const sel = selectEngine(Array.from({ length: 10 }, () => 1000));
      expect(sel.engine).toBe("bigint");
      expect(sel.formats.int64).toBe(false);
      expect(sel.formats.uuid24).toBe(false);

      const wi = sel.create();
      expect(wi).toBeInstanceOf(WeightedIndexBig);
    });
  });

  describe("기존 유틸과의 일관성", () => {
    it("shapeProduct는 Number 범위 내에서 동일한 결과", () => {
      const shape = [10, 20, 30];
      expect(shapeProduct(shape)).toBe(6000);
      expect(computeProductBig(shape)).toBe(6000n);
    });

    it("shapeProduct는 초과 시 MAX_SAFE_INTEGER로 캡", () => {
      const shape = [1000, 1000, 1000, 1000, 1000, 1000];
      // Number 기반은 캡
      expect(shapeProduct(shape)).toBe(Number.MAX_SAFE_INTEGER);
      // BigInt는 정확
      expect(computeProductBig(shape)).toBe(1_000_000_000_000_000_000n);
    });

    it("maxProductBig와 fitsHexBudget이 일관된다", () => {
      // 13 hex chars = 16^13 - 1 ≈ 4.5 × 10^15 < 2^53
      const budget13 = maxProductBig(13);
      expect(budget13).toBe(16n ** 13n);

      // shape product < budget이면 hex 13자로 충분
      const shape = [100, 100, 100]; // 10^6
      expect(fitsHexBudget(shape, 13)).toBe(true);

      // shape product > budget이면 부족
      const bigShape = [1000, 1000, 1000, 1000, 1000]; // 10^15
      expect(fitsHexBudget(bigShape, 13)).toBe(true); // 10^15 < 16^13 ≈ 4.5e15
      expect(fitsHexBudget([...bigShape, 10], 13)).toBe(false); // 10^16 > 16^13
    });
  });
});
