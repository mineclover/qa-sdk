import { describe, it, expect } from "vitest";
import { MetaCodecBig } from "./meta-codec-big.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";
import type { DecodeMap, VersionedValueBig } from "./types.js";

// ── 픽스처 ────────────────────────────────────────────────────────────────────

/** 작은 스키마 (Number 범위 내). */
function smallMap(): DecodeMap {
  return {
    indexId: "perm",
    versionId: "v1",
    shape: [3, 2],
    size: 6,
    dims: [
      { dimId: "role", snapshotId: "v1", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer"] },
      { dimId: "action", snapshotId: "v1", kind: { type: "string_enum" }, entries: ["read", "write"] },
    ],
  };
}

/** 큰 스키마 (Number 범위 초과). number_enum 사용. */
const BIG_DIM = 210_000;
function bigMap(): DecodeMap {
  return {
    indexId: "big",
    versionId: "v1",
    shape: [BIG_DIM, BIG_DIM, BIG_DIM],
    size: Number.MAX_SAFE_INTEGER, // 캡됨 — 실제 곱은 2^53 초과
    numberType: "bigint",
    dims: [
      { dimId: "d1", snapshotId: "v1", kind: { type: "number_enum" }, entries: Array.from({ length: BIG_DIM }, (_, i) => i) },
      { dimId: "d2", snapshotId: "v1", kind: { type: "number_enum" }, entries: Array.from({ length: BIG_DIM }, (_, i) => BIG_DIM + i) },
      { dimId: "d3", snapshotId: "v1", kind: { type: "number_enum" }, entries: Array.from({ length: BIG_DIM }, (_, i) => BIG_DIM * 2 + i) },
    ],
  };
}

// ── 기본 동작 ────────────────────────────────────────────────────────────────

describe("MetaCodecBig 기본", () => {
  it("생성 및 identity 속성", () => {
    const codec = new MetaCodecBig(smallMap());
    expect(codec.indexId).toBe("perm");
    expect(codec.versionId).toBe("v1");
    expect(codec.size).toBe(6n);
    expect([...codec.shape]).toEqual([3n, 2n]);
    expect([...codec.dimIds]).toEqual(["role", "action"]);
  });

  it("encode → decode 왕복 (작은 스키마)", () => {
    const codec = new MetaCodecBig(smallMap());
    const entities = { role: "editor", action: "write" };
    const vvb = codec.encode(entities);
    expect(vvb.indexId).toBe("perm");
    expect(vvb.versionId).toBe("v1");
    expect(typeof vvb.value).toBe("bigint");

    const decoded = codec.decode(vvb);
    expect(decoded).toEqual(entities);
  });

  it("모든 좌표 조합 encode → decode 왕복", () => {
    const codec = new MetaCodecBig(smallMap());
    const roles = ["admin", "editor", "viewer"];
    const actions = ["read", "write"];
    const seen = new Set<bigint>();

    for (const role of roles) {
      for (const action of actions) {
        const vvb = codec.encode({ role, action });
        expect(seen.has(vvb.value)).toBe(false);
        seen.add(vvb.value);

        const decoded = codec.decode(vvb);
        expect(decoded.role).toBe(role);
        expect(decoded.action).toBe(action);
      }
    }
    expect(seen.size).toBe(6);
  });

  it("decodeValue로 직접 decode", () => {
    const codec = new MetaCodecBig(smallMap());
    const vvb = codec.encode({ role: "admin", action: "read" });
    const decoded = codec.decodeValue(vvb.value);
    expect(decoded.role).toBe("admin");
    expect(decoded.action).toBe("read");
  });

  it("decodeBatch", () => {
    const codec = new MetaCodecBig(smallMap());
    const values = [0n, 1n, 2n];
    const results = codec.decodeBatch(values);
    expect(results).toHaveLength(3);
    expect(results[0].role).toBe("admin");
    expect(results[0].action).toBe("read");
  });

  it("toDecodeMap", () => {
    const codec = new MetaCodecBig(smallMap());
    const map = codec.toDecodeMap();
    expect(map.indexId).toBe("perm");
    expect(map.shape).toEqual([3, 2]);
  });
});

// ── 에러 ─────────────────────────────────────────────────────────────────────

describe("MetaCodecBig 에러", () => {
  it("존재하지 않는 entity → EntryNotFoundError", () => {
    const codec = new MetaCodecBig(smallMap());
    expect(() => codec.encode({ role: "ghost", action: "read" })).toThrow(EntryNotFoundError);
  });

  it("dim 누락 → ValidationError", () => {
    const codec = new MetaCodecBig(smallMap());
    expect(() => codec.encode({ role: "admin" })).toThrow(ValidationError);
  });

  it("indexId/versionId 불일치 decode → ValidationError", () => {
    const codec = new MetaCodecBig(smallMap());
    const wrong: VersionedValueBig = { indexId: "other", versionId: "v1", value: 0n };
    expect(() => codec.decode(wrong)).toThrow(ValidationError);
  });
});

// ── BigInt 주소 공간 ────────────────────────────────────────────────────────

describe("MetaCodecBig 대형 스키마", () => {
  it("size가 2^53 초과", () => {
    const codec = new MetaCodecBig(bigMap());
    expect(codec.size).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });

  it("첫 번째 / 마지막 좌표 encode → decode 왕복", () => {
    const codec = new MetaCodecBig(bigMap());
    // 첫 번째
    const first = codec.encode({ d1: 0, d2: BIG_DIM, d3: BIG_DIM * 2 });
    expect(first.value).toBe(0n);
    const dec1 = codec.decode(first);
    expect(dec1.d1).toBe(0);
    expect(dec1.d2).toBe(BIG_DIM);
    expect(dec1.d3).toBe(BIG_DIM * 2);

    // 마지막
    const last = codec.encode({
      d1: BIG_DIM - 1,
      d2: BIG_DIM * 2 - 1,
      d3: BIG_DIM * 3 - 1,
    });
    expect(last.value).toBe(codec.size - 1n);
    const dec2 = codec.decode(last);
    expect(dec2.d1).toBe(BIG_DIM - 1);
    expect(dec2.d2).toBe(BIG_DIM * 2 - 1);
    expect(dec2.d3).toBe(BIG_DIM * 3 - 1);
  });

  it("중간 좌표 왕복", () => {
    const codec = new MetaCodecBig(bigMap());
    const mid = {
      d1: 100_000,
      d2: BIG_DIM + 50_000,
      d3: BIG_DIM * 2 + 75_000,
    };
    const vvb = codec.encode(mid);
    expect(typeof vvb.value).toBe("bigint");
    const decoded = codec.decode(vvb);
    expect(decoded).toEqual(mid);
  });
});

// ── matchRanges (BigInt) ────────────────────────────────────────────────────

describe("MetaCodecBig matchRanges", () => {
  it("전체 와일드카드 → [[0n, size-1n]]", () => {
    const codec = new MetaCodecBig(smallMap());
    const ranges = codec.matchRanges({});
    expect(ranges).toEqual([[0n, 5n]]);
  });

  it("단일 dim 고정 → 연속 범위", () => {
    const codec = new MetaCodecBig(smallMap());
    const ranges = codec.matchRanges({ role: "editor" });
    // editor = 2번째 (0-based idx 1), stride[0] = 2, range = [2, 3]
    expect(ranges).toEqual([[2n, 3n]]);
  });

  it("존재하지 않는 entity → EntryNotFoundError", () => {
    const codec = new MetaCodecBig(smallMap());
    expect(() => codec.matchRanges({ role: "ghost" })).toThrow(EntryNotFoundError);
  });
});
