import { describe, it, expect } from "vitest";
import { MetaCodec } from "./meta-codec.js";
import { MetaRegistry } from "./meta-registry.js";
import { MetaResolver } from "./meta-resolver.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";
import type { DecodeMap } from "./types.js";

// ── 픽스처 ──────────────────────────────────────────────────────────────────

/** 3×3×3 perm index (string_enum + number_enum) */
const permMap = (): DecodeMap => ({
  indexId: "perm",
  versionId: "v1",
  shape: [3, 3, 3],
  size: 27,
  dims: [
    { dimId: "role", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer"] },
    { dimId: "action", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["read", "write", "delete"] },
    { dimId: "resource", snapshotId: "sv1", kind: { type: "number_enum" }, entries: [10, 20, 30] },
  ],
});

/** 단일 dim index (number_enum) */
const singleDimMap = (): DecodeMap => ({
  indexId: "tier",
  versionId: "tv1",
  shape: [4],
  size: 4,
  dims: [
    { dimId: "level", snapshotId: "lv1", kind: { type: "number_enum" }, entries: [0, 1, 2, 3] },
  ],
});

// ── 생성 ──────────────────────────────────────────────────────────────────────

describe("MetaCodec 생성", () => {
  it("DecodeMap으로 직접 생성할 수 있다", () => {
    const codec = new MetaCodec(permMap());
    expect(codec.indexId).toBe("perm");
    expect(codec.versionId).toBe("v1");
    expect(codec.size).toBe(27);
    expect(codec.shape).toEqual([3, 3, 3]);
  });

  it("MetaRegistry.createCodec()으로 생성할 수 있다", () => {
    const reg = new MetaRegistry({
      dims: {
        role: { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: ["admin", "editor"] } } },
      },
      indices: {
        perm: { dims: ["role"], versions: { iv1: { snapshots: { role: "v1" } } } },
      },
    });
    const codec = reg.createCodec("perm", "iv1");
    expect(codec.indexId).toBe("perm");
    expect(codec.versionId).toBe("iv1");
    expect(codec.size).toBe(2);
  });

  it("MetaResolver.getDecodeMap() → new MetaCodec()로 독립 생성할 수 있다", () => {
    const reg = new MetaRegistry({
      dims: {
        role: { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: ["a", "b", "c"] } } },
      },
      indices: {
        idx: { dims: ["role"], versions: { iv1: { snapshots: { role: "v1" } } } },
      },
    });
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("idx", "iv1");
    const codec = new MetaCodec(map);

    expect(codec.indexId).toBe("idx");
    expect(codec.size).toBe(3);
  });
});

// ── encode / decode round-trip ──────────────────────────────────────────────

describe("encode / decode", () => {
  it("encode → decode round-trip: 원래 entity ID를 복원한다", () => {
    const codec = new MetaCodec(permMap());
    const vv = codec.encode({ role: "admin", action: "write", resource: 20 });

    expect(vv.indexId).toBe("perm");
    expect(vv.versionId).toBe("v1");
    expect(typeof vv.value).toBe("number");

    const ids = codec.decode(vv);
    expect(ids).toEqual({ role: "admin", action: "write", resource: 20 });
  });

  it("number_enum entity ID도 정확하게 encode/decode된다", () => {
    const codec = new MetaCodec(singleDimMap());

    for (const level of [0, 1, 2, 3]) {
      const vv = codec.encode({ level });
      expect(codec.decode(vv)).toEqual({ level });
    }
  });

  it("서로 다른 좌표는 서로 다른 value를 생성한다 (bijection)", () => {
    const codec = new MetaCodec(permMap());
    const seen = new Set<number>();

    for (const role of ["admin", "editor", "viewer"]) {
      for (const action of ["read", "write", "delete"]) {
        for (const resource of [10, 20, 30]) {
          const { value } = codec.encode({ role, action, resource });
          expect(seen.has(value)).toBe(false);
          seen.add(value);
        }
      }
    }
    expect(seen.size).toBe(27);
  });

  it("value 범위는 [0, size-1]이다", () => {
    const codec = new MetaCodec(permMap());
    const values: number[] = [];

    for (const role of ["admin", "editor", "viewer"]) {
      for (const action of ["read", "write", "delete"]) {
        for (const resource of [10, 20, 30]) {
          values.push(codec.encode({ role, action, resource }).value);
        }
      }
    }
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(26);
  });
});

// ── decodeValue ─────────────────────────────────────────────────────────────

describe("decodeValue", () => {
  it("value만으로 decode한다 (indexId/versionId 검증 없음)", () => {
    const codec = new MetaCodec(permMap());
    const vv = codec.encode({ role: "viewer", action: "delete", resource: 30 });
    const ids = codec.decodeValue(vv.value);

    expect(ids).toEqual({ role: "viewer", action: "delete", resource: 30 });
  });

  it("전체 value range를 순회하며 decodeValue가 유효한 entity를 반환한다 (단일 dim)", () => {
    const codec = new MetaCodec(singleDimMap());
    for (let v = 0; v < codec.size; v++) {
      const ids = codec.decodeValue(v);
      expect(typeof ids.level).toBe("number");
    }
  });

  it("다차원 전체 value range를 decodeValue로 순회하면 encode와 역대응한다", () => {
    const codec = new MetaCodec(permMap());
    const roles = ["admin", "editor", "viewer"];
    const actions = ["read", "write", "delete"];
    const resources = [10, 20, 30];

    for (let v = 0; v < codec.size; v++) {
      const ids = codec.decodeValue(v);
      // decode된 entity가 유효한 값인지
      expect(roles).toContain(ids.role);
      expect(actions).toContain(ids.action);
      expect(resources).toContain(ids.resource);
      // re-encode하면 원래 value와 동일한지
      expect(codec.encode(ids).value).toBe(v);
    }
  });
});

// ── 에러 ──────────────────────────────────────────────────────────────────────

describe("에러 처리", () => {
  it("존재하지 않는 entity ID는 EntryNotFoundError", () => {
    const codec = new MetaCodec(permMap());
    expect(() =>
      codec.encode({ role: "superadmin", action: "read", resource: 10 })
    ).toThrow(EntryNotFoundError);
  });

  it("dim 누락 시 ValidationError", () => {
    const codec = new MetaCodec(permMap());
    expect(() =>
      codec.encode({ role: "admin", action: "read" })
    ).toThrow(ValidationError);
  });

  it("decode: indexId 불일치 시 ValidationError", () => {
    const codec = new MetaCodec(permMap());
    expect(() =>
      codec.decode({ indexId: "wrong", versionId: "v1", value: 0 })
    ).toThrow(ValidationError);
  });

  it("decode: versionId 불일치 시 ValidationError", () => {
    const codec = new MetaCodec(permMap());
    expect(() =>
      codec.decode({ indexId: "perm", versionId: "wrong", value: 0 })
    ).toThrow(ValidationError);
  });
});

// ── 불변성 ──────────────────────────────────────────────────────────────────

describe("불변성", () => {
  it("decode 반환값이 frozen이다", () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decode(codec.encode({ role: "admin", action: "read", resource: 10 }));
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("decodeValue 반환값도 frozen이다", () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decodeValue(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("frozen 객체 변조 시 TypeError", () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decode(codec.encode({ role: "admin", action: "read", resource: 10 }));
    expect(() => {
      (result as Record<string, unknown>)["role"] = "hacked";
    }).toThrow(TypeError);
  });
});

// ── toDecodeMap ──────────────────────────────────────────────────────────────

describe("toDecodeMap", () => {
  it("deep clone을 반환한다", () => {
    const codec = new MetaCodec(permMap());
    const map1 = codec.toDecodeMap();
    const map2 = codec.toDecodeMap();

    expect(map1).toEqual(map2);
    expect(map1).not.toBe(map2);
    expect(map1.dims).not.toBe(map2.dims);
  });

  it("반환된 DecodeMap으로 새 코덱을 만들면 동일하게 동작한다", () => {
    const codec1 = new MetaCodec(permMap());
    const codec2 = new MetaCodec(codec1.toDecodeMap());

    const entityIds = { role: "editor", action: "write", resource: 20 };
    expect(codec2.encode(entityIds)).toEqual(codec1.encode(entityIds));
    expect(codec2.decode(codec1.encode(entityIds))).toEqual(entityIds);
  });
});

// ── 독립 운용 (MetaRegistry 없이) ───────────────────────────────────────────

describe("독립 운용", () => {
  it("JSON으로 전송된 DecodeMap으로 코덱을 생성해 encode/decode할 수 있다", () => {
    const codec1 = new MetaCodec(permMap());
    const vv = codec1.encode({ role: "viewer", action: "delete", resource: 30 });

    // 네트워크 전송 시뮬레이션
    const json = JSON.stringify(codec1.toDecodeMap());
    const received: DecodeMap = JSON.parse(json);

    // 수신 측에서 MetaRegistry 없이 독립 decode
    const codec2 = new MetaCodec(received);
    expect(codec2.decode(vv)).toEqual({ role: "viewer", action: "delete", resource: 30 });

    // 수신 측에서 독립 encode → 원본과 동일한 value 생성
    const vv2 = codec2.encode({ role: "viewer", action: "delete", resource: 30 });
    expect(vv2).toEqual(vv);
  });

  it("서로 다른 index version에 대한 독립 코덱을 각각 만들 수 있다", () => {
    const v1Map: DecodeMap = {
      indexId: "perm", versionId: "v1", shape: [3], size: 3,
      dims: [{ dimId: "role", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer"] }],
    };
    const v2Map: DecodeMap = {
      indexId: "perm", versionId: "v2", shape: [4], size: 4,
      dims: [{ dimId: "role", snapshotId: "sv2", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer", "guest"] }],
    };

    const v1 = new MetaCodec(v1Map);
    const v2 = new MetaCodec(v2Map);

    // v1 encode → v1 decode
    const vv1 = v1.encode({ role: "viewer" });
    expect(v1.decode(vv1)).toEqual({ role: "viewer" });

    // 동일 entity로 v2 encode → v2 decode (cross-version migration)
    const vv2 = v2.encode({ role: "viewer" });
    expect(v2.decode(vv2)).toEqual({ role: "viewer" });

    // v2에만 있는 guest
    expect(() => v1.encode({ role: "guest" })).toThrow(EntryNotFoundError);
    expect(v2.decode(v2.encode({ role: "guest" }))).toEqual({ role: "guest" });
  });

  it("같은 registry에서 생성한 여러 codec이 독립적으로 동작한다", () => {
    const reg = new MetaRegistry({
      dims: {
        role: {
          kind: { type: "string_enum" as const },
          snapshots: {
            v1: { entries: ["admin", "editor", "viewer"] },
            v2: { entries: ["admin", "editor", "viewer", "guest"] },
          },
        },
        action: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["read", "write"] } },
        },
      },
      indices: {
        perm: {
          dims: ["role", "action"],
          versions: {
            iv1: { snapshots: { role: "v1", action: "v1" } },
            iv2: { snapshots: { role: "v2", action: "v1" } },
          },
        },
      },
    });

    const iv1 = reg.createCodec("perm", "iv1");
    const iv2 = reg.createCodec("perm", "iv2");

    // 각 codec이 자기 version에서 독립 동작
    expect(iv1.size).toBe(6);  // 3×2
    expect(iv2.size).toBe(8);  // 4×2

    const vv1 = iv1.encode({ role: "admin", action: "read" });
    const vv2 = iv2.encode({ role: "guest", action: "read" });

    expect(iv1.decode(vv1)).toEqual({ role: "admin", action: "read" });
    expect(iv2.decode(vv2)).toEqual({ role: "guest", action: "read" });

    // cross-version decode 시도 시 ValidationError
    expect(() => iv1.decode(vv2)).toThrow(ValidationError);
  });

  it("decode → re-encode 패턴으로 version 이동이 가능하다", () => {
    const v1Map: DecodeMap = {
      indexId: "idx", versionId: "v1", shape: [2, 2], size: 4,
      dims: [
        { dimId: "a", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["x", "y"] },
        { dimId: "b", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["p", "q"] },
      ],
    };
    const v2Map: DecodeMap = {
      indexId: "idx", versionId: "v2", shape: [3, 2], size: 6,
      dims: [
        { dimId: "a", snapshotId: "s2", kind: { type: "string_enum" }, entries: ["x", "y", "z"] },
        { dimId: "b", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["p", "q"] },
      ],
    };

    const v1 = new MetaCodec(v1Map);
    const v2 = new MetaCodec(v2Map);

    // v1 decode → entity IDs 추출 → v2 re-encode
    const v1vv = v1.encode({ a: "y", b: "q" });
    const entityIds = v1.decode(v1vv);
    const v2vv = v2.encode(entityIds);

    expect(v2.decode(v2vv)).toEqual({ a: "y", b: "q" });
    // version이 다르므로 value도 다를 수 있다
    expect(v2vv.versionId).toBe("v2");
  });
});
