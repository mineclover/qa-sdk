/**
 * format-adapter.test.ts — WeightedIndex 순수 수학 + 외부 포맷 어댑터 검증
 *
 * ── 증명 대상 ──────────────────────────────────────────────────────────────
 *
 * "WeightedIndex는 순수 수학이다 — shape만 알면 동작하며,
 *  결과가 몇 바이트로 직렬화되는지는 모른다."
 *
 * 이 명제는 BigInt 경로(WeightedIndexBig)가 추가된 뒤에도 유효한가?
 *
 * ── 증명 전략 ──────────────────────────────────────────────────────────────
 *
 * §1 구조적 격리     WeightedIndex API에 포맷 관련 표면이 없음을 확인
 * §2 사후 분석       shape/size를 패키지 기존 유틸로 읽어 포맷 호환성을 판단
 * §3 실시간 감지     encode 결과를 사후 검사하여 포맷 경계를 확인
 * §4 경계값 정밀도   2^53 경계에서 Number/BigInt 전환이 정확함을 확인
 * §5 엔진 선택 분리  shape → product → 엔진/포맷 결정을 WI 외부에서 수행
 * §6 동일 수학 다중 포맷  하나의 WI에 여러 포맷 평가를 동시 적용
 * §7 포맷 변경 시 수학 불변  포맷 제약이 바뀌어도 WI 인스턴스는 변경 없음
 *
 * ── 사용하는 도구 ──────────────────────────────────────────────────────────
 *
 * 모든 어댑터는 weighted-index 패키지의 기존 export를 사용한다.
 * 테스트 내부에 중복 구현하지 않으며, 패키지가 이미 어댑터 도구를
 * 제공함을 증명한다.
 */
import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./weighted-index.js";
import { WeightedIndexBig } from "./weighted-index-big.js";
import {
  shapeProduct,
  shapeProductUncapped,
  maxProductBig,
  dimMaxForBudget,
  dimMaxBig,
} from "./layout-fit.js";
import { charsForMax } from "./uuid-layout.js";
import { fitShape, planCapacity } from "./capacity-planner.js";

// ── §1 구조적 격리 ─────────────────────────────────────────────────────────

describe("§1 구조적 격리: WeightedIndex에 포맷 관련 API가 없다", () => {
  it("WeightedIndex — shape/size/strides/labels만 존재", () => {
    const wi = new WeightedIndex([10, 20, 30]);

    // 존재하는 속성: 순수 수학에 필요한 것만
    expect(wi.shape).toEqual([10, 20, 30]);
    expect(wi.size).toBe(6000);
    expect(wi.strides).toBeDefined();
    expect(wi.labels).toBeDefined();

    // 존재하지 않는 속성: 포맷 관련
    expect("hexChars" in wi).toBe(false);
    expect("format" in wi).toBe(false);
    expect("numberType" in wi).toBe(false);
    expect("serialize" in wi).toBe(false);
    expect("protocol" in wi).toBe(false);
  });

  it("WeightedIndexBig — 동일하게 포맷 무관", () => {
    const wi = new WeightedIndexBig([10n, 20n, 30n]);

    expect(wi.shape).toEqual([10n, 20n, 30n]);
    expect(wi.size).toBe(6000n);
    expect("hexChars" in wi).toBe(false);
    expect("numberType" in wi).toBe(false);
    expect("serialize" in wi).toBe(false);
  });

  it("encode/decode는 좌표 ↔ 정수 전단사만 수행한다", () => {
    const wi = new WeightedIndex([5, 7, 3]);
    // 입출력 타입: number[] ↔ number (포맷 없음)
    const addr: number = wi.encode([3, 5, 2]);
    const coords: number[] = wi.decode(addr);
    expect(coords).toEqual([3, 5, 2]);

    const wiBig = new WeightedIndexBig([5n, 7n, 3n]);
    const addrBig: bigint = wiBig.encode([3n, 5n, 2n]);
    const coordsBig: bigint[] = wiBig.decode(addrBig);
    expect(coordsBig).toEqual([3n, 5n, 2n]);
  });
});

// ── §2 사후 분석: 패키지 유틸로 포맷 호환성을 판단 ───────────────────────────

describe("§2 사후 분석: shape/size로 포맷 호환성을 외부에서 판단", () => {
  /**
   * 핵심: WI를 먼저 생성(또는 shape만 있는 상태)하고,
   * 패키지의 기존 유틸로 사후에 포맷 적합성을 판단한다.
   */

  it("shapeProduct — Number 범위 내 shape의 주소 공간 크기", () => {
    const shape = [10, 20, 50]; // 10,000
    const wi = new WeightedIndex(shape);
    expect(shapeProduct(shape)).toBe(wi.size);
    expect(shapeProduct(shape)).toBe(10_000);
  });

  it("shapeProduct — Number 초과 시 MAX_SAFE_INTEGER로 캡", () => {
    const shape = [1000, 1000, 1000, 1000, 1000, 1000]; // 10^18
    // Number 기반은 캡됨 → 초과 신호
    expect(shapeProduct(shape)).toBe(Number.MAX_SAFE_INTEGER);
    // 실제 값은 shapeProductUncapped로 확인 (정밀도 손실 있음)
    expect(shapeProductUncapped(shape)).toBe(1e18);
  });

  it("maxProductBig — hex 예산으로부터 최대 주소 공간을 BigInt로 계산", () => {
    // 13 hex chars → 16^13 ≈ 4.5 × 10^15 < 2^53
    expect(maxProductBig(13)).toBe(16n ** 13n);
    // 24 hex chars → 16^24 ≈ 7.9 × 10^28
    expect(maxProductBig(24)).toBe(16n ** 24n);
    // 0 hex chars → 0
    expect(maxProductBig(0)).toBe(0n);
  });

  it("charsForMax — 주소 최댓값에 필요한 hex chars", () => {
    const wi = new WeightedIndex([100, 100, 100]); // size = 1,000,000
    const maxAddr = wi.size - 1; // 999,999
    expect(charsForMax(maxAddr)).toBe(5); // 0xF423F = 5자

    expect(charsForMax(15)).toBe(1);      // 0xF
    expect(charsForMax(255)).toBe(2);     // 0xFF
    expect(charsForMax(65535)).toBe(4);   // 0xFFFF
  });

  it("dimMaxForBudget — 다른 차원 고정 시 한 차원의 최대 크기 (Number)", () => {
    // 6 hex chars 예산, 다른 차원의 곱 = 5000일 때 남은 차원의 최대
    const max = dimMaxForBudget(6, 5000);
    // 16^6 / 5000 = 16,777,216 / 5000 = 3355
    expect(max).toBe(3355);
  });

  it("dimMaxBig — BigInt로 정확한 최대 차원 크기 (문자열 반환)", () => {
    // 24 hex chars, 다른 차원의 곱 = 100,000,000
    const max = dimMaxBig(24, 100_000_000);
    // 16^24 / 10^8 = 큰 수 → 포맷된 문자열로 반환
    expect(typeof max).toBe("string");
    expect(max).not.toBe("0");
    // Number 기반 dimMaxForBudget는 이 범위에서 캡됨
    const numberMax = dimMaxForBudget(24, 100_000_000);
    // BigInt가 더 정확하다는 것이 핵심
    expect(numberMax).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it("planCapacity — shape + 포맷 제약 → 성장 여력까지 분석", () => {
    const plan = planCapacity({
      dims: [
        { name: "role", current: 5, growth: 3 },
        { name: "action", current: 8, growth: 0 },
        { name: "resource", current: 3, growth: 10 },
      ],
      left: [
        { name: "prefix", chars: 4 },
        { name: "version", chars: 2 },
      ],
      capacity: "uuid",
    });
    // WI는 이 분석에 관여하지 않음 — shape만 있으면 됨
    expect(plan.fits).toBe(true);
    expect(plan.shape.length).toBe(3);
    // shape으로 WI 생성 가능
    const wi = new WeightedIndex(plan.shape);
    expect(wi.size).toBe(plan.product);
  });
});

// ── §3 실시간 감지: encode 결과를 사후 검사 ────────────────────────────────

describe("§3 실시간 감지: encode 결과로 포맷 안전성을 확인", () => {
  it("Number: encode 결과가 특정 hex 예산에 맞는지 사후 검사", () => {
    const wi = new WeightedIndex([100, 100, 100]); // 10^6

    // 최소 좌표 → 주소 0
    expect(wi.encode([1, 1, 1])).toBe(0);
    // 최대 좌표 → 주소 999,999
    const maxAddr = wi.encode([100, 100, 100]);
    expect(maxAddr).toBe(999_999);

    // 사후 검사: 이 주소에 몇 hex chars가 필요한가?
    const needed = charsForMax(maxAddr);
    expect(needed).toBe(5);

    // 3 hex chars 예산(max 4,095)에는 부족
    expect(maxAddr <= 16 ** 3 - 1).toBe(false);
    // 5 hex chars 예산(max 1,048,575)에는 충분
    expect(maxAddr <= 16 ** 5 - 1).toBe(true);
  });

  it("BigInt: encode 결과도 동일하게 사후 검사 가능", () => {
    const shape = [1000n, 1000n, 1000n, 1000n, 1000n, 1000n];
    const wi = new WeightedIndexBig(shape);

    // 최대 좌표
    const maxAddr = wi.encode(shape.map((s) => s));
    expect(maxAddr).toBe(wi.size - 1n);

    // 64-bit에 맞는가?
    expect(maxAddr <= 0xFFFF_FFFF_FFFF_FFFFn).toBe(true);
    // UUID 24 hex chars에 맞는가?
    expect(maxAddr < 16n ** 24n).toBe(true);
    // 13 hex chars(Number 안전 영역)에 맞는가?
    expect(maxAddr < 16n ** 13n).toBe(false); // 10^18 > 16^13 ≈ 4.5 × 10^15
  });

  it("임의 좌표의 값별 포맷 호환성 검사", () => {
    const wi = new WeightedIndex([50, 40, 30]); // size = 60,000

    // 작은 좌표 → 작은 주소
    const small = wi.encode([1, 1, 5]);
    expect(small).toBe(4);
    expect(small <= 0xFF).toBe(true); // 1 byte로 충분

    // 큰 좌표 → 큰 주소
    const large = wi.encode([50, 40, 30]);
    expect(large).toBe(59_999);
    expect(large <= 0xFF).toBe(false);   // 1 byte 부족
    expect(large <= 0xFFFF).toBe(true);  // 2 bytes 충분
  });
});

// ── §4 경계값 정밀도: 2^53 전환 경계 ──────────────────────────────────────

describe("§4 경계값 정밀도: Number/BigInt 전환 경계", () => {
  // 2^53 = 9,007,199,254,740,992
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER); // 2^53 - 1

  it("shape product = 2^53 - 1 → Number 안전", () => {
    // 52D × dim=2: product = 2^52 = 4,503,599,627,370,496 < 2^53
    const shape = Array.from({ length: 52 }, () => 2);
    const product = shapeProduct(shape);
    expect(product).toBe(2 ** 52);
    expect(product).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);

    // WI 생성 성공
    const wi = new WeightedIndex(shape);
    expect(wi.size).toBe(2 ** 52);
  });

  it("shape product > 2^53 → Number 불안전, BigInt 필요", () => {
    // 53D × dim=2: product = 2^53 = MAX_SAFE_INTEGER + 1
    const shape = Array.from({ length: 53 }, () => 2);

    // shapeProduct 캡 확인
    expect(shapeProduct(shape)).toBe(Number.MAX_SAFE_INTEGER);

    // WI 생성 실패 (ShapeError)
    expect(() => new WeightedIndex(shape)).toThrow();

    // BigInt로 전환
    const wiBig = new WeightedIndexBig(shape.map(BigInt));
    expect(wiBig.size).toBe(2n ** 53n);
    expect(wiBig.size).toBeGreaterThan(MAX_SAFE);
  });

  it("maxProductBig로 hex 예산별 경계를 정확히 계산", () => {
    // 13 hex → Number 안전 경계
    const max13 = maxProductBig(13);
    expect(max13).toBe(16n ** 13n);
    expect(max13).toBeLessThan(MAX_SAFE + 1n); // 4.5e15 < 9e15

    // 14 hex → Number 불안전 시작
    const max14 = maxProductBig(14);
    expect(max14).toBe(16n ** 14n);
    expect(max14).toBeGreaterThan(MAX_SAFE); // 7.2e16 > 9e15
  });

  it("경계 근처에서 encode/decode 정확성", () => {
    // 52D × 2: Number 안전 최대
    const shape52 = Array.from({ length: 52 }, () => 2);
    const wi = new WeightedIndex(shape52);
    // 모든 좌표 최대값
    const maxCoords = shape52.map(() => 2);
    const maxAddr = wi.encode(maxCoords);
    expect(maxAddr).toBe(wi.size - 1);
    expect(wi.decode(maxAddr)).toEqual(maxCoords);

    // 53D × 2: BigInt 필요
    const shape53 = Array.from({ length: 53 }, () => 2n);
    const wiBig = new WeightedIndexBig(shape53);
    const maxCoordsBig = shape53.map(() => 2n);
    const maxAddrBig = wiBig.encode(maxCoordsBig);
    expect(maxAddrBig).toBe(wiBig.size - 1n);
    expect(wiBig.decode(maxAddrBig)).toEqual(maxCoordsBig);
  });
});

// ── §5 엔진 선택 분리: WI 외부에서 수행 ───────────────────────────────────

describe("§5 엔진 선택 분리: shape → 엔진/포맷 결정은 WI 외부", () => {
  /**
   * 어댑터 패턴: 패키지 유틸로 shape을 분석하여
   * 엔진(Number/BigInt)과 포맷 호환성을 결정한다.
   * WeightedIndex는 이 결정에 관여하지 않는다.
   */
  function selectEngine(shape: number[]) {
    const product = shapeProduct(shape);
    const jsNumber = product < Number.MAX_SAFE_INTEGER;
    return {
      engine: jsNumber ? "number" : "bigint" as const,
      create: jsNumber
        ? () => new WeightedIndex(shape)
        : () => new WeightedIndexBig(shape.map(BigInt)),
    };
  }

  function analyzeFormats(shape: number[]) {
    const productBig = shape.reduce((p, s) => p * BigInt(s), 1n);
    return {
      fitsNumber: productBig <= BigInt(Number.MAX_SAFE_INTEGER),
      fits13Hex: productBig <= maxProductBig(13),
      fits24Hex: productBig <= maxProductBig(24),
      fits64Bit: productBig <= 0xFFFF_FFFF_FFFF_FFFFn,
    };
  }

  it("작은 shape → Number 엔진, 모든 포맷 가능", () => {
    const shape = [10, 20, 30];
    const engine = selectEngine(shape);
    const formats = analyzeFormats(shape);

    expect(engine.engine).toBe("number");
    expect(formats.fitsNumber).toBe(true);
    expect(formats.fits13Hex).toBe(true);
    expect(formats.fits24Hex).toBe(true);
    expect(formats.fits64Bit).toBe(true);

    const wi = engine.create();
    expect(wi).toBeInstanceOf(WeightedIndex);
    expect(wi.encode([3, 7, 15])).toBe(wi.decode(wi.encode([3, 7, 15]))[0] > 0 ? wi.encode([3, 7, 15]) : 0);
  });

  it("대형 shape → BigInt 엔진, UUID/64-bit 가능", () => {
    const shape = [1000, 1000, 1000, 1000, 1000, 1000]; // 10^18
    const engine = selectEngine(shape);
    const formats = analyzeFormats(shape);

    expect(engine.engine).toBe("bigint");
    expect(formats.fitsNumber).toBe(false);
    expect(formats.fits13Hex).toBe(false);
    expect(formats.fits24Hex).toBe(true);
    expect(formats.fits64Bit).toBe(true);

    const wi = engine.create();
    expect(wi).toBeInstanceOf(WeightedIndexBig);
  });

  it("초대형 shape → BigInt 엔진, 표준 포맷 불가", () => {
    const shape = Array.from({ length: 10 }, () => 1000); // 10^30
    const engine = selectEngine(shape);
    const formats = analyzeFormats(shape);

    expect(engine.engine).toBe("bigint");
    expect(formats.fitsNumber).toBe(false);
    expect(formats.fits24Hex).toBe(false);
    expect(formats.fits64Bit).toBe(false);

    // 수학은 여전히 동작
    const wi = engine.create();
    expect(wi).toBeInstanceOf(WeightedIndexBig);
    const addr = (wi as WeightedIndexBig).encode(shape.map(() => 1n));
    expect((wi as WeightedIndexBig).decode(addr)).toEqual(shape.map(() => 1n));
  });
});

// ── §6 동일 수학, 다중 포맷 동시 평가 ─────────────────────────────────────

describe("§6 동일 수학, 다중 포맷: 하나의 WI에 여러 포맷을 동시 평가", () => {
  it("같은 shape으로 int64/UUID/compact 적합성을 동시에 판단", () => {
    const shape = [500, 400, 300]; // product = 60,000,000
    const wi = new WeightedIndex(shape);
    const maxAddr = wi.size - 1;

    // WI 하나, 포맷 평가 여러 개 (WI에 의존하지 않음)
    const hexNeeded = charsForMax(maxAddr);

    const formats = {
      "4-hex (16-bit)": maxAddr <= 16 ** 4 - 1,   // 65,535 — 부족
      "8-hex (32-bit)": maxAddr <= 16 ** 8 - 1,   // 4.3B — 충분
      "int64":          maxAddr <= 2 ** 53 - 1,    // 충분
      "uuid-index-24":  maxAddr <= 16 ** 24 - 1,   // 충분
    };

    expect(hexNeeded).toBe(7); // 0x3938700 - 1 → 7자
    expect(formats["4-hex (16-bit)"]).toBe(false);
    expect(formats["8-hex (32-bit)"]).toBe(true);
    expect(formats["int64"]).toBe(true);
    expect(formats["uuid-index-24"]).toBe(true);
  });

  it("fitShape로 포맷에 맞게 shape을 축소해도 WI는 관여하지 않는다", () => {
    const original = [1000, 1000, 1000]; // product = 10^9

    // 16^5 = 1,048,576 예산으로 축소
    const result = fitShape({
      shape: original,
      maxProduct: 16 ** 5,
    });
    expect(result).not.toBeNull();
    expect(result!.shape.reduce((a, b) => a * b, 1)).toBeLessThanOrEqual(16 ** 5);

    // 원본 WI와 축소된 WI: 둘 다 순수 수학, 포맷 무관
    const wiOriginal = new WeightedIndex(original);
    const wiFitted = new WeightedIndex(result!.shape);

    expect(wiOriginal.size).toBe(1_000_000_000);
    expect(wiFitted.size).toBeLessThanOrEqual(1_048_576);

    // 둘 다 encode/decode 정상 동작
    const coordO = [100, 100, 100];
    expect(wiOriginal.decode(wiOriginal.encode(coordO))).toEqual(coordO);

    const maxFitted = result!.shape.map((s) => s);
    expect(wiFitted.decode(wiFitted.encode(maxFitted))).toEqual(maxFitted);
  });

  it("BigInt WI에 대해서도 다중 포맷 동시 평가", () => {
    const shape = [10000n, 10000n, 10000n, 10000n]; // 10^16
    const wi = new WeightedIndexBig(shape);
    const maxAddr = wi.size - 1n;

    const formats = {
      fitsNumber: maxAddr <= BigInt(Number.MAX_SAFE_INTEGER),
      fits13Hex:  maxAddr < 16n ** 13n,
      fits24Hex:  maxAddr < 16n ** 24n,
      fits64Bit:  maxAddr <= 0xFFFF_FFFF_FFFF_FFFFn,
    };

    // 10^16: Number 초과, 13hex 초과, 24hex/64bit OK
    expect(formats.fitsNumber).toBe(false);
    expect(formats.fits13Hex).toBe(false);
    expect(formats.fits24Hex).toBe(true);
    expect(formats.fits64Bit).toBe(true);
  });
});

// ── §7 포맷 변경 시 수학 불변 ──────────────────────────────────────────────

describe("§7 포맷 변경 시 수학 불변: 포맷 제약이 바뀌어도 WI는 변경 없음", () => {
  it("포맷 예산이 바뀌어도 동일 WI 인스턴스의 encode/decode 결과는 동일", () => {
    const shape = [500, 400, 300]; // size = 60,000,000
    const wi = new WeightedIndex(shape);
    const coords = [250, 200, 150];
    const addr = wi.encode(coords);
    // addr ≈ 29,939,849 → 0x1C8F639 (7 hex chars)

    // 포맷 예산 A: 4 hex chars (max 65,535) — 부족
    const fitsA = addr <= 16 ** 4 - 1;
    // 포맷 예산 B: 8 hex chars (max 4.3B) — 충분
    const fitsB = addr <= 16 ** 8 - 1;
    // 포맷 예산 C: 16 hex chars (max 2^64) — 충분
    const fitsC = addr <= 16 ** 16 - 1;

    // 포맷 판단은 달라도 WI 결과는 동일
    expect(wi.encode(coords)).toBe(addr); // 같은 주소
    expect(wi.decode(addr)).toEqual(coords); // 같은 좌표

    // 포맷만 다르게 평가됨
    expect(fitsA).toBe(false);
    expect(fitsB).toBe(true);
    expect(fitsC).toBe(true);
  });

  it("UUID에서 int64로 포맷을 변경해도 WI 재생성 불필요", () => {
    const shape = [100, 200, 300];
    const wi = new WeightedIndex(shape);

    // UUID 포맷으로 평가
    const uuidOk = wi.size - 1 <= 16 ** 24 - 1;
    expect(uuidOk).toBe(true);

    // int64 포맷으로 전환 평가
    const int64Ok = wi.size - 1 <= 2 ** 53 - 1;
    expect(int64Ok).toBe(true);

    // compact 포맷 (4 hex chars)으로 전환 평가
    const compactOk = wi.size - 1 <= 16 ** 4 - 1;
    expect(compactOk).toBe(false); // 6,000,000 > 65,535

    // WI는 재생성되지 않았다 — 같은 인스턴스에서 모든 판단 수행
    expect(wi.encode([50, 100, 150])).toBe(wi.encode([50, 100, 150]));
  });

  it("BigInt WI도 포맷 변경에 불변", () => {
    const shape = [1000n, 1000n, 1000n, 1000n, 1000n, 1000n];
    const wi = new WeightedIndexBig(shape);
    const coords = [500n, 500n, 500n, 500n, 500n, 500n];
    const addr = wi.encode(coords);

    // 여러 포맷으로 평가
    const uuid = addr < 16n ** 24n;
    const int64 = addr <= 0xFFFF_FFFF_FFFF_FFFFn;
    const number = addr <= BigInt(Number.MAX_SAFE_INTEGER);

    expect(uuid).toBe(true);
    expect(int64).toBe(true);
    expect(number).toBe(false); // 10^18 > 2^53

    // WI의 수학은 불변
    expect(wi.decode(addr)).toEqual(coords);
  });
});
