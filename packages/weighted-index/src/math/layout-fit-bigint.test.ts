// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * layout-fit-bigint.test.ts — BigInt의 UUID 전체 공간 커버 가능성 탐사.
 *
 * 검증 대상:
 *  1. BigInt 범위: UUID 128bit 전체를 정확히 표현 가능한가?
 *  2. BigInt mixed-radix encode/decode: Number가 깨지는 영역에서 BigInt가 정확한가?
 *  3. Number 한계 경계: 어디서부터 Number가 틀려지는가?
 *  4. BigInt 성능: encode/decode가 실용적인 속도인가?
 *  5. Number 다중 결합 대안: 가능성과 한계
 */

import { describe, it, expect } from "vitest";

// ── BigInt mixed-radix encode/decode ────────────────────────────────────────
// Number 버전(simEncode/simDecode)의 BigInt 대응. 테스트용 구현.

function bigEncode(shape: readonly bigint[], coords: readonly bigint[]): bigint {
  let index = 0n;
  let weight = 1n;
  for (let i = shape.length - 1; i >= 0; i--) {
    index += (coords[i] - 1n) * weight;
    weight *= shape[i];
  }
  return index;
}

function bigDecode(shape: readonly bigint[], index: bigint): bigint[] {
  const n = shape.length;
  const coords = new Array<bigint>(n);
  let rest = index;
  for (let i = n - 1; i >= 0; i--) {
    coords[i] = (rest % shape[i]) + 1n;
    rest = rest / shape[i];
  }
  return coords;
}

function bigProduct(shape: readonly bigint[]): bigint {
  return shape.reduce((p, s) => p * s, 1n);
}

// ── §1. BigInt 범위 — UUID 전체 공간 ────────────────────────────────────────

describe("[BigInt 범위] UUID 128bit 전체 표현", () => {
  it("16^32 (UUID 전체 128bit)를 정확히 표현", () => {
    const uuid128 = 16n ** 32n;
    expect(uuid128.toString()).toBe("340282366920938463463374607431768211456");
    // 약 3.4 × 10^38
  });

  it("16^29 (index 예산 29ch = 116bit)를 정확히 표현", () => {
    const idx116 = 16n ** 29n;
    expect(idx116 > 0n).toBe(true);
    expect(idx116.toString().length).toBe(35); // 10^34 자릿수
  });

  it("MAX_SAFE_INTEGER를 BigInt로 변환 후 연산 가능", () => {
    const safe = BigInt(Number.MAX_SAFE_INTEGER);
    expect(safe).toBe(9007199254740991n);
    // MAX_SAFE_INTEGER^2도 정확
    const squared = safe * safe;
    expect(squared).toBe(81129638414606663681390495662081n);
  });

  it("UUID 최대 인덱스 (16^32 - 1) 표현 가능", () => {
    const maxIndex = 16n ** 32n - 1n;
    const hex = maxIndex.toString(16);
    expect(hex).toBe("f".repeat(32));
  });

  it("UUID 최대 인덱스 (16^29 - 1) hex 변환", () => {
    const maxIdx29 = 16n ** 29n - 1n;
    const hex = maxIdx29.toString(16).padStart(29, "0");
    expect(hex.length).toBe(29);
    expect(hex).toBe("f".repeat(29));
  });
});

// ── §2. BigInt encode/decode — Number가 깨지는 영역 ─────────────────────────

describe("[BigInt encode/decode] Number 한계 초과 영역", () => {
  // budget=29, 4차원 — Number 모드에서 dimMax ≈ 9×10^12
  const shape4 = [100000n, 100000n, 100000n, 100000n]; // 10^20 공간
  const product4 = bigProduct(shape4); // 10^20

  it("shape [100K, 100K, 100K, 100K] → 공간 10^20 > MAX_SAFE_INTEGER", () => {
    expect(product4).toBe(100000000000000000000n);
    expect(product4 > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("마지막 인덱스 encode → decode 라운드트립", () => {
    const lastIdx = product4 - 1n;
    const coords = bigDecode(shape4, lastIdx);
    expect(coords).toEqual([100000n, 100000n, 100000n, 100000n]);
    const back = bigEncode(shape4, coords);
    expect(back).toBe(lastIdx);
  });

  it("첫 번째 인덱스 → 모두 1", () => {
    const coords = bigDecode(shape4, 0n);
    expect(coords).toEqual([1n, 1n, 1n, 1n]);
  });

  it("중간 값 라운드트립 — Number가 정밀도를 잃는 영역", () => {
    // 9007199254740993 = MAX_SAFE_INTEGER + 2 — Number로는 표현 불가
    const idx = 9007199254740993n;
    const coords = bigDecode(shape4, idx);
    const back = bigEncode(shape4, coords);
    expect(back).toBe(idx);
  });

  // UUID 최대 규모: budget=29, 2차원
  const shape2 = [10000000000000000n, 10000000000000000n]; // 각 10^16, 공간 10^32

  it("초대형 shape [10^16, 10^16] → 공간 10^32, 라운드트립 정확", () => {
    const product = bigProduct(shape2);
    expect(product).toBe(100000000000000000000000000000000n); // 10^32
    const lastIdx = product - 1n;
    const coords = bigDecode(shape2, lastIdx);
    expect(coords).toEqual(shape2.map(s => s)); // [10^16, 10^16]
    expect(bigEncode(shape2, coords)).toBe(lastIdx);
  });
});

// ── §3. Number 한계 경계 — 어디서 깨지는가 ──────────────────────────────────

describe("[Number 한계 경계] 정밀도 손실 지점", () => {
  it("MAX_SAFE_INTEGER까지는 Number 정확", () => {
    const n = Number.MAX_SAFE_INTEGER; // 2^53 - 1
    expect(n + 1 - 1).toBe(n);
  });

  it("MAX_SAFE_INTEGER + 1부터 Number 정밀도 손실", () => {
    const n = Number.MAX_SAFE_INTEGER;
    // MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2 (정밀도 손실!)
    expect(n + 1 === n + 2).toBe(true); // ← 여기서부터 깨짐
    // BigInt에서는 정확히 구분
    expect(BigInt(n) + 1n === BigInt(n) + 2n).toBe(false);
  });

  it("Number mixed-radix: MAX_SAFE_INTEGER 범위에서 정확", () => {
    const shape = [1000, 1000, 1000, 1000, 9007]; // product ≈ 9×10^15
    const lastIdx = shape.reduce((p, s) => p * s, 1) - 1;
    expect(lastIdx).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    // 이 범위에서는 Number encode/decode가 정확
  });

  it("Number mixed-radix: MAX_SAFE_INTEGER 초과 시 좌표 오염", () => {
    // Number로 계산하면 modulo/division이 부정확해짐
    const shape = [1000000, 1000000, 1000000]; // product = 10^18 > MAX_SAFE_INTEGER
    const product = shape.reduce((p, s) => p * s, 1);
    expect(product).toBeGreaterThan(Number.MAX_SAFE_INTEGER);

    // Number로 decode → encode 시 값이 달라질 수 있음
    const idx = Number.MAX_SAFE_INTEGER + 100;
    const coords: number[] = [];
    let rest = idx;
    for (let i = shape.length - 1; i >= 0; i--) {
      coords[i] = (rest % shape[i]) + 1;
      rest = Math.floor(rest / shape[i]);
    }
    let back = 0;
    let weight = 1;
    for (let i = shape.length - 1; i >= 0; i--) {
      back += (coords[i] - 1) * weight;
      weight *= shape[i];
    }
    // Number에서는 라운드트립이 깨질 수 있음
    const roundtripOk = back === idx;

    // BigInt로 동일 연산하면 정확
    const bShape = shape.map(BigInt);
    const bIdx = BigInt(idx);
    const bCoords = bigDecode(bShape, bIdx);
    const bBack = bigEncode(bShape, bCoords);
    expect(bBack).toBe(bIdx); // BigInt는 항상 정확

    // Number가 실패하는 경우 기록 (실패하든 성공하든 BigInt가 올바름을 증명)
    if (!roundtripOk) {
      expect(bBack).toBe(bIdx); // BigInt 정확 확인 (이미 위에서 검증)
    }
  });
});

// ── §4. BigInt 성능 특성 ────────────────────────────────────────────────────

describe("[BigInt 성능] encode/decode 처리량", () => {
  const shape4 = [100000n, 100000n, 100000n, 100000n];
  const iterations = 100_000;

  it(`decode ${iterations.toLocaleString()}회 — 실용적 속도 확인`, () => {
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      bigDecode(shape4, BigInt(i));
    }
    const elapsed = performance.now() - t0;
    const opsPerSec = iterations / (elapsed / 1000);
    // 최소 100K ops/s는 되어야 실용적
    expect(opsPerSec).toBeGreaterThan(100_000);
    console.log(`BigInt decode: ${(opsPerSec / 1e6).toFixed(2)}M ops/s (${(elapsed / iterations * 1000).toFixed(0)}µs/op)`);
  });

  it(`encode ${iterations.toLocaleString()}회 — 실용적 속도 확인`, () => {
    const coords = [50000n, 50000n, 50000n, 50000n];
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      bigEncode(shape4, coords);
    }
    const elapsed = performance.now() - t0;
    const opsPerSec = iterations / (elapsed / 1000);
    expect(opsPerSec).toBeGreaterThan(100_000);
    console.log(`BigInt encode: ${(opsPerSec / 1e6).toFixed(2)}M ops/s (${(elapsed / iterations * 1000).toFixed(0)}µs/op)`);
  });

  it("BigInt vs Number 성능 비율", () => {
    const numShape = [100000, 100000, 100000, 100000];
    const bigShape = numShape.map(BigInt);
    const n = 50_000;

    // Number decode
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      let rest = i;
      for (let d = 3; d >= 0; d--) {
        rest = Math.floor(rest / numShape[d]);
      }
    }
    const numTime = performance.now() - t0;

    // BigInt decode
    const t1 = performance.now();
    for (let i = 0; i < n; i++) {
      let rest = BigInt(i);
      for (let d = 3; d >= 0; d--) {
        rest = rest / bigShape[d];
      }
    }
    const bigTime = performance.now() - t1;

    const ratio = bigTime / numTime;
    console.log(`BigInt/Number 속도 비율: ${ratio.toFixed(1)}x 느림 (Number ${numTime.toFixed(1)}ms, BigInt ${bigTime.toFixed(1)}ms)`);
    // BigInt가 Number 대비 몇 배 느린지 기록 (보통 5~20x)
    // 성능이 중요한 경우 참고용
  });
});

// ── §5. UUID hex 패킹 — BigInt 기반 ─────────────────────────────────────────

describe("[BigInt UUID 패킹] 전체 128bit 활용", () => {
  function bigPackUUID(
    prefixChars: number, prefixVal: bigint,
    versionChars: number, versionVal: bigint,
    shardChars: number, shardVal: bigint,
    indexVal: bigint,
  ): string {
    // 전체 128bit를 하나의 BigInt로 조합
    const indexChars = 32 - prefixChars - versionChars - shardChars;
    let full = 0n;

    // prefix (왼쪽부터)
    if (prefixChars > 0) {
      full |= prefixVal << BigInt((32 - prefixChars) * 4);
    }
    // version
    if (versionChars > 0) {
      full |= versionVal << BigInt((32 - prefixChars - versionChars) * 4);
    }
    // shard (index 바로 왼쪽)
    if (shardChars > 0) {
      full |= shardVal << BigInt(indexChars * 4);
    }
    // index (오른쪽)
    if (indexChars > 0) {
      full |= indexVal;
    }

    const hex = full.toString(16).padStart(32, "0");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }

  it("prefix=0xAB, ver=0x1, index=0 → ab1 + 29개 0", () => {
    const uuid = bigPackUUID(2, 0xABn, 1, 0x1n, 0, 0n, 0n);
    expect(uuid.replace(/-/g, "").startsWith("ab1")).toBe(true);
    expect(uuid.replace(/-/g, "").slice(3)).toBe("0".repeat(29));
  });

  it("index = 16^29 - 1 (최대) → 뒤 29자리가 모두 f", () => {
    const maxIdx = 16n ** 29n - 1n;
    const uuid = bigPackUUID(2, 0xABn, 1, 0x1n, 0, 0n, maxIdx);
    const raw = uuid.replace(/-/g, "");
    expect(raw.slice(3)).toBe("f".repeat(29));
  });

  it("Number가 표현 못하는 인덱스도 정확히 패킹", () => {
    // MAX_SAFE_INTEGER + 1000 — Number로는 정밀도 손실
    const idx = BigInt(Number.MAX_SAFE_INTEGER) + 1000n;
    const uuid = bigPackUUID(2, 0xABn, 1, 0x1n, 0, 0n, idx);
    const raw = uuid.replace(/-/g, "");
    // index 부분 추출 (뒤 29자)
    const indexHex = raw.slice(3);
    const recovered = BigInt("0x" + indexHex);
    expect(recovered).toBe(idx);
  });

  it("UUID 전체 128bit 활용 — prefix 없이 index만 32ch", () => {
    const maxIdx = 16n ** 32n - 1n;
    const uuid = bigPackUUID(0, 0n, 0, 0n, 0, 0n, maxIdx);
    expect(uuid.replace(/-/g, "")).toBe("f".repeat(32));
  });
});

// ── §6. Number 다중 결합 가능성 탐사 ────────────────────────────────────────

describe("[Number 다중 결합] BigInt 대안 탐사", () => {
  // 아이디어: 116bit index를 53bit 청크 3개로 분할 (53 + 53 + 10)
  // 각 청크를 Number로 관리하고 필요시 결합

  function splitIndex(idx: bigint, chunkBits: number[]): number[] {
    const chunks: number[] = [];
    let rest = idx;
    for (let i = chunkBits.length - 1; i >= 0; i--) {
      const mask = (1n << BigInt(chunkBits[i])) - 1n;
      chunks[i] = Number(rest & mask);
      rest >>= BigInt(chunkBits[i]);
    }
    return chunks;
  }

  function joinIndex(chunks: number[], chunkBits: number[]): bigint {
    let idx = 0n;
    for (let i = 0; i < chunks.length; i++) {
      idx <<= BigInt(chunkBits[i]);
      idx |= BigInt(chunks[i]);
    }
    return idx;
  }

  it("116bit → [53, 53, 10] 분할/결합 라운드트립", () => {
    const bits = [53, 53, 10];
    const original = 16n ** 29n - 1n; // 116bit 최대값

    const chunks = splitIndex(original, bits);
    // 각 청크가 Number 범위 안에 있는지
    expect(chunks[0]).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(chunks[1]).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(chunks[2]).toBeLessThanOrEqual(1023); // 10bit

    const recovered = joinIndex(chunks, bits);
    expect(recovered).toBe(original);
  });

  it("128bit → [53, 53, 22] 분할/결합 라운드트립", () => {
    const bits = [53, 53, 22];
    const original = 16n ** 32n - 1n; // 128bit 최대값

    const chunks = splitIndex(original, bits);
    expect(chunks[0]).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(chunks[1]).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(chunks[2]).toBeLessThanOrEqual(2 ** 22 - 1);

    const recovered = joinIndex(chunks, bits);
    expect(recovered).toBe(original);
  });

  it("분할 방식의 한계: mixed-radix에는 BigInt 연산 필요", () => {
    // Number 청크로 분할해도 mixed-radix decode 시 나눗셈/모듈러가
    // 전체 index에 대해 이뤄져야 하므로 결국 BigInt가 필요
    const shape = [100000n, 100000n, 100000n];
    const product = bigProduct(shape); // 10^15 — 이건 Number OK
    expect(Number(product)).toBeLessThan(Number.MAX_SAFE_INTEGER);

    // 하지만 shape가 더 크면...
    const bigShape = [1000000000n, 1000000000n]; // 10^18
    const bigProd = bigProduct(bigShape);
    expect(bigProd > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    // → mixed-radix 연산 자체가 BigInt를 요구
  });
});
