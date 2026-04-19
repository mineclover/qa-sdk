// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect, beforeAll } from "vitest";
import {
  MetaRegistry,
  computeShapeProductBig,
  fitsNumber,
} from "./meta-registry.js";
import { CapacityOverflowError, ValidationError } from "./errors.js";
import type { MetaRegistryInput, NumberType } from "./types.js";
import { PrefixDecoder } from "./prefix-decoder.js";
import { MetaCodecBig } from "./meta-codec-big.js";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/** 작은 shape (Number 범위 내) 스키마. */
const smallInput = (opts?: {
  numberType?: NumberType;
  strict?: boolean;
}): MetaRegistryInput => ({
  strict: opts?.strict,
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["read", "write"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      numberType: opts?.numberType,
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1" } },
      },
    },
  },
});

/**
 * 큰 shape (Number 범위 초과) 스키마.
 * 3개 dim × 210_000 entries = 210_000^3 ≈ 9.26 × 10^15 > 2^53
 * number_enum을 사용해 빠른 검증.
 */
const BIG_DIM_SIZE = 210_000;
const bigNumEntries = (offset: number) =>
  Array.from({ length: BIG_DIM_SIZE }, (_, i) => offset + i);

const bigInput = (opts?: {
  numberType?: NumberType;
  strict?: boolean;
}): MetaRegistryInput => ({
  strict: opts?.strict,
  dims: {
    d1: {
      kind: { type: "number_enum" },
      snapshots: { v1: { entries: bigNumEntries(0) } },
    },
    d2: {
      kind: { type: "number_enum" },
      snapshots: { v1: { entries: bigNumEntries(BIG_DIM_SIZE) } },
    },
    d3: {
      kind: { type: "number_enum" },
      snapshots: { v1: { entries: bigNumEntries(BIG_DIM_SIZE * 2) } },
    },
  },
  indices: {
    big: {
      dims: ["d1", "d2", "d3"],
      numberType: opts?.numberType,
      versions: {
        iv1: { snapshots: { d1: "v1", d2: "v1", d3: "v1" } },
      },
    },
  },
});

// ── computeShapeProductBig / fitsNumber ──────────────────────────────────────

describe("computeShapeProductBig", () => {
  it("빈 shape → 1n", () => {
    expect(computeShapeProductBig([])).toBe(1n);
  });

  it("작은 shape → BigInt 곱", () => {
    expect(computeShapeProductBig([3, 4, 5])).toBe(60n);
  });

  it("큰 shape → 정확한 BigInt 곱", () => {
    const product = computeShapeProductBig([10_000_000, 10_000_000, 10_000_000]);
    expect(product).toBe(1_000_000_000_000_000_000_000n);
  });
});

describe("fitsNumber", () => {
  it("작은 shape → true", () => {
    expect(fitsNumber([3, 4, 5])).toBe(true);
  });

  it("Number.MAX_SAFE_INTEGER 초과 shape → false", () => {
    expect(fitsNumber([10_000_000, 10_000_000, 10_000_000])).toBe(false);
  });

  it("경계값: 2^53 이하 → true", () => {
    // 2^53 = 9007199254740992
    // 9007199 * 1000000 < 2^53
    expect(fitsNumber([9007199, 1000000])).toBe(true);
  });
});

// ── NumberType 자동 추론 ────────────────────────────────────────────────────

describe("NumberType 자동 추론", () => {
  it("작은 shape + numberType 미지정 → number", () => {
    const reg = new MetaRegistry(smallInput());
    const def = reg.getIndexDef("perm");
    expect(def.numberType).toBe("number");
  });

  it("작은 shape + numberType: 'number' → number", () => {
    const reg = new MetaRegistry(smallInput({ numberType: "number" }));
    expect(reg.getIndexDef("perm").numberType).toBe("number");
  });

  it("작은 shape + numberType: 'bigint' → bigint (사용자 선언 존중)", () => {
    const reg = new MetaRegistry(smallInput({ numberType: "bigint" }));
    expect(reg.getIndexDef("perm").numberType).toBe("bigint");
  });

  it("큰 shape + numberType 미지정 → bigint 자동 승격", () => {
    const reg = new MetaRegistry(bigInput({ strict: false }));
    expect(reg.getIndexDef("big").numberType).toBe("bigint");
  });

  it("큰 shape + numberType: 'bigint' → bigint", () => {
    const reg = new MetaRegistry(bigInput({ numberType: "bigint" }));
    expect(reg.getIndexDef("big").numberType).toBe("bigint");
  });
});

// ── strict 모드 ────────────────────────────────────────────────────────────

describe("strict 모드", () => {
  it("strict: true (기본) + 큰 shape + numberType: 'number' → CapacityOverflowError", () => {
    expect(() =>
      new MetaRegistry(bigInput({ numberType: "number" }))
    ).toThrow(CapacityOverflowError);
  });

  it("strict: true + 큰 shape + numberType: 'number' → 에러 메시지에 shape product 포함", () => {
    try {
      const _r = new MetaRegistry(bigInput({ numberType: "number", strict: true }));
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CapacityOverflowError);
      const err = e as CapacityOverflowError;
      expect(err.indexId).toBe("big");
      expect(err.versionId).toBe("iv1");
      expect(err.productBig).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
      expect(err.message).toContain("Number.MAX_SAFE_INTEGER");
    }
  });

  it("strict: false + 큰 shape + numberType: 'number' → 경고 수집, bigint로 승격", () => {
    const reg = new MetaRegistry(bigInput({ numberType: "number", strict: false }));
    expect(reg.getIndexDef("big").numberType).toBe("bigint");
    expect(reg.capacityWarnings.length).toBeGreaterThan(0);
    expect(reg.capacityWarnings[0]).toContain("big/iv1");
  });

  it("strict: false + 큰 shape + numberType 미지정 → 경고 없이 bigint 승격", () => {
    const reg = new MetaRegistry(bigInput({ strict: false }));
    expect(reg.getIndexDef("big").numberType).toBe("bigint");
    expect(reg.capacityWarnings).toHaveLength(0);
  });

  it("strict: true + 작은 shape → 경고 없음, 정상 생성", () => {
    const reg = new MetaRegistry(smallInput({ strict: true }));
    expect(reg.capacityWarnings).toHaveLength(0);
    expect(reg.getIndexDef("perm").numberType).toBe("number");
  });
});

// ── getCapacityInfo ────────────────────────────────────────────────────────

describe("getCapacityInfo", () => {
  it("작은 shape → fitsNumber: true", () => {
    const reg = new MetaRegistry(smallInput());
    const info = reg.getCapacityInfo("perm", "iv1");
    expect(info.fitsNumber).toBe(true);
    expect(info.sizeNumber).toBe(6); // 3 × 2
    expect(info.sizeBigInt).toBe(6n);
    expect(info.numberType).toBe("number");
    expect(info.shape).toEqual([3, 2]);
  });

  it("큰 shape → fitsNumber: false, sizeNumber 캡", () => {
    const reg = new MetaRegistry(bigInput({ strict: false }));
    const info = reg.getCapacityInfo("big", "iv1");
    expect(info.fitsNumber).toBe(false);
    expect(info.sizeNumber).toBe(Number.MAX_SAFE_INTEGER);
    expect(info.sizeBigInt).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(info.numberType).toBe("bigint");
  });
});

// ── 런타임 가드: bigint index에서 Number 기반 연산 차단 ─────────────────────

describe("런타임 가드 — bigint index 차단", () => {
  let reg: MetaRegistry;

  beforeAll(() => {
    reg = new MetaRegistry(bigInput({ strict: false }));
  });

  it("createCodec → CapacityOverflowError", () => {
    expect(() => reg.createCodec("big", "iv1")).toThrow(CapacityOverflowError);
  });

  it("getWeightedIndex → CapacityOverflowError", () => {
    expect(() => reg.getWeightedIndex("big", "iv1")).toThrow(CapacityOverflowError);
  });

  it("serialize → CapacityOverflowError", () => {
    const vv = { indexId: "big", versionId: "iv1", value: 0 };
    expect(() => reg.serialize(vv)).toThrow(CapacityOverflowError);
  });

  it("parse는 _getWeightedIndex를 호출하므로 CapacityOverflowError", () => {
    expect(() => reg.parse("big:iv1:0")).toThrow(CapacityOverflowError);
  });

  it("작은 index는 정상 동작 (혼합 레지스트리)", () => {
    // 작은 index + 큰 index 공존
    const mixedInput: MetaRegistryInput = {
      strict: false,
      dims: {
        role: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["admin", "editor"] } },
        },
        d1: {
          kind: { type: "number_enum" },
          snapshots: { v1: { entries: bigNumEntries(0) } },
        },
        d2: {
          kind: { type: "number_enum" },
          snapshots: { v1: { entries: bigNumEntries(BIG_DIM_SIZE) } },
        },
        d3: {
          kind: { type: "number_enum" },
          snapshots: { v1: { entries: bigNumEntries(BIG_DIM_SIZE * 2) } },
        },
      },
      indices: {
        small: {
          dims: ["role"],
          versions: { iv1: { snapshots: { role: "v1" } } },
        },
        big: {
          dims: ["d1", "d2", "d3"],
          versions: { iv1: { snapshots: { d1: "v1", d2: "v1", d3: "v1" } } },
        },
      },
    };
    const mixed = new MetaRegistry(mixedInput);
    // small은 정상
    const codec = mixed.createCodec("small", "iv1");
    expect(codec.size).toBe(2);
    // big은 차단
    expect(() => mixed.createCodec("big", "iv1")).toThrow(CapacityOverflowError);
  });
});

// ── DecodeMap에 numberType 전파 ─────────────────────────────────────────────

describe("DecodeMap numberType 전파", () => {
  it("createCodec → toDecodeMap()에 numberType 포함", () => {
    const reg = new MetaRegistry(smallInput());
    const codec = reg.createCodec("perm", "iv1");
    const map = codec.toDecodeMap();
    expect(map.numberType).toBe("number");
  });
});

// ── PrefixDecoder bigint 가드 ────────────────────────────────────────────────

describe("PrefixDecoder bigint 가드", () => {
  it("numberType: 'bigint' DecodeMap → ValidationError", () => {
    const map = {
      indexId: "test",
      versionId: "v1",
      shape: [3, 2],
      size: 6,
      numberType: "bigint" as const,
      dims: [
        { dimId: "a", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["x", "y", "z"] },
        { dimId: "b", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["p", "q"] },
      ],
    };
    expect(() => new PrefixDecoder({ map })).toThrow(ValidationError);
    expect(() => new PrefixDecoder({ map })).toThrow(/BigInt-typed index/);
  });

  it("numberType: 'number' DecodeMap → 정상 생성", () => {
    const map = {
      indexId: "test",
      versionId: "v1",
      shape: [3, 2],
      size: 6,
      numberType: "number" as const,
      dims: [
        { dimId: "a", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["x", "y", "z"] },
        { dimId: "b", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["p", "q"] },
      ],
    };
    const decoder = new PrefixDecoder({ map });
    expect(decoder.size).toBe(6);
  });

  it("numberType 미지정 DecodeMap → 정상 생성 (하위 호환)", () => {
    const map = {
      indexId: "test",
      versionId: "v1",
      shape: [3, 2],
      size: 6,
      dims: [
        { dimId: "a", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["x", "y", "z"] },
        { dimId: "b", snapshotId: "v1", kind: { type: "string_enum" as const }, entries: ["p", "q"] },
      ],
    };
    const decoder = new PrefixDecoder({ map });
    expect(decoder.size).toBe(6);
  });
});

// ── createCodecBig — BigInt 경로 ────────────────────────────────────────────

describe("createCodecBig — BigInt 경로", () => {
  it("bigint index에서 createCodecBig으로 encode/decode 가능", () => {
    const reg = new MetaRegistry(bigInput({ strict: false }));
    const codec = reg.createCodecBig("big", "iv1");
    expect(codec).toBeInstanceOf(MetaCodecBig);
    expect(codec.size).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));

    // 첫 번째 엔트리 encode → decode 왕복
    const entities = { d1: 0, d2: BIG_DIM_SIZE, d3: BIG_DIM_SIZE * 2 };
    const vvb = codec.encode(entities);
    expect(typeof vvb.value).toBe("bigint");
    expect(vvb.value).toBe(0n);

    const decoded = codec.decode(vvb);
    expect(decoded).toEqual(entities);
  });

  it("number index에서도 createCodecBig 사용 가능", () => {
    const reg = new MetaRegistry(smallInput());
    const codec = reg.createCodecBig("perm", "iv1");
    const vvb = codec.encode({ role: "admin", action: "read" });
    expect(vvb.value).toBe(0n);
    const decoded = codec.decode(vvb);
    expect(decoded.role).toBe("admin");
    expect(decoded.action).toBe("read");
  });

  it("createCodec은 차단되지만 createCodecBig은 동작 (혼합 레지스트리)", () => {
    const reg = new MetaRegistry(bigInput({ strict: false }));
    expect(() => reg.createCodec("big", "iv1")).toThrow(CapacityOverflowError);
    const bigCodec = reg.createCodecBig("big", "iv1");
    expect(bigCodec.size).toBeGreaterThan(0n);
  });
});
