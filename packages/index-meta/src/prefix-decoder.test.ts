// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect } from "vitest";
import { PrefixDecoder } from "./prefix-decoder.js";
import type { PrefixDecoderConfig, PrefixDeepDecodeResult } from "./prefix-decoder.js";
import { MetaRegistry } from "./meta-registry.js";
import { MetaResolver } from "./meta-resolver.js";
import { ValidationError, ParseError } from "./errors.js";
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

/**
 * cross-index 픽스처:
 * service = [env(2), region(3)] → 6 combinations
 * permission = [perm_svc(→service, 6), role(3)] → 18 combinations
 */
const crossIndexMaps = (): { permissionMap: DecodeMap; serviceMap: DecodeMap } => {
  const serviceMap: DecodeMap = {
    indexId: "service",
    versionId: "v1",
    shape: [2, 3],
    size: 6,
    dims: [
      { dimId: "env", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["prod", "staging"] },
      { dimId: "region", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["asia", "eu", "us"] },
    ],
  };

  const permissionMap: DecodeMap = {
    indexId: "permission",
    versionId: "v1",
    shape: [6, 3],
    size: 18,
    dims: [
      {
        dimId: "perm_svc",
        snapshotId: "sv1",
        kind: { type: "index_ref", indexId: "service" },
        entries: [0, 1, 2, 3, 4, 5],
      },
      { dimId: "role", snapshotId: "sv1", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer"] },
    ],
  };

  return { permissionMap, serviceMap };
};

// ── 생성 ────────────────────────────────────────────────────────────────────

describe("PrefixDecoder 생성", () => {
  it("DecodeMap으로 생성할 수 있다", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    expect(decoder.indexId).toBe("perm");
    expect(decoder.versionId).toBe("v1");
    expect(decoder.size).toBe(27);
    expect(decoder.shape).toEqual([3, 3, 3]);
    expect(decoder.strides).toEqual([9, 3, 1]);
    expect(decoder.dimIds).toEqual(["role", "action", "resource"]);
  });

  it("refs 포함 생성", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(decoder.indexId).toBe("permission");
    expect(decoder.hasRef("perm_svc")).toBe(true);
    expect(decoder.hasRef("role")).toBe(false);
  });

  it("잘못된 DecodeMap → ValidationError", () => {
    expect(() => new PrefixDecoder({
      map: { ...permMap(), size: 999 },
    })).toThrow(ValidationError);
  });

  it("잘못된 ref DecodeMap → ValidationError", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    expect(() => new PrefixDecoder({
      map: permissionMap,
      refs: { service: { ...serviceMap, size: 999 } },
    })).toThrow(ValidationError);
  });
});

// ── detect ──────────────────────────────────────────────────────────────────

describe("detect", () => {
  it("text 프로토콜 감지", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    expect(decoder.detect("perm:v1:42")).toBe("colon");
    expect(decoder.detect("wi://perm/v1/42")).toBe("uri");
    expect(decoder.detect("perm-v1-42")).toBe("compact");
  });

  it("매칭 없으면 null", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    expect(decoder.detect("???")).toBeNull();
  });
});

// ── resolve(number) ─────────────────────────────────────────────────────────

describe("resolve(number)", () => {
  it("정수 → VersionedValue", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = decoder.resolve(0);
    expect(vv).toEqual({ indexId: "perm", versionId: "v1", value: 0 });
  });

  it("임의 정수", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = decoder.resolve(13);
    expect(vv).toEqual({ indexId: "perm", versionId: "v1", value: 13 });
  });
});

// ── resolve(string) ─────────────────────────────────────────────────────────

describe("resolve(string)", () => {
  it("colon 포맷 자동 감지", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = decoder.resolve("perm:v1:0");
    expect(vv).toEqual({ indexId: "perm", versionId: "v1", value: 0 });
  });

  it("URI 포맷 자동 감지", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = decoder.resolve("wi://perm/v1/13");
    expect(vv).toEqual({ indexId: "perm", versionId: "v1", value: 13 });
  });

  it("compact 포맷 자동 감지", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = decoder.resolve("perm-v1-5");
    expect(vv).toEqual({ indexId: "perm", versionId: "v1", value: 5 });
  });

  it("파싱 불가 문자열 → ParseError", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    expect(() => decoder.resolve("invalid-format")).toThrow(ParseError);
  });
});

// ── decode(number) ──────────────────────────────────────────────────────────

describe("decode(number)", () => {
  it("number → entity record", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const result = decoder.decode(0);
    expect(result).toEqual({ role: "admin", action: "read", resource: 10 });
  });

  it("마지막 주소 decode", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const result = decoder.decode(26);
    expect(result).toEqual({ role: "viewer", action: "delete", resource: 30 });
  });
});

// ── decode(string) ──────────────────────────────────────────────────────────

describe("decode(string)", () => {
  it("colon 문자열 → entity record", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const result = decoder.decode("perm:v1:0");
    expect(result).toEqual({ role: "admin", action: "read", resource: 10 });
  });

  it("URI 문자열 → entity record", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const result = decoder.decode("wi://perm/v1/13");
    // value 13: role=editor(1), action=write(1), resource=10(0) → 1*9+1*3+1 = 13
    // coord: [1, 1, 1] → entries[1] each → editor, write, 20
    // wait let me recalculate: shape [3,3,3], strides [9,3,1]
    // 13 / 9 = 1 r4, 4/3 = 1 r1, 1/1 = 1
    // coords: [2, 2, 2] (1-based) → entries[1] = editor, entries[1] = write, entries[1] = 20
    expect(result).toEqual({ role: "editor", action: "write", resource: 20 });
  });
});

// ── decodeDeep ──────────────────────────────────────────────────────────────

describe("decodeDeep", () => {
  it("refs 있을 때 index_ref 1-level 확장", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 0: perm_svc=0 (service addr 0 → env=prod, region=asia), role=admin
    const result = decoder.decodeDeep(0);
    expect(result.entities).toEqual({ perm_svc: 0, role: "admin" });
    expect(result.refs).toEqual({
      perm_svc: { env: "prod", region: "asia" },
    });
  });

  it("다양한 값으로 deep decode", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 5: shape [6,3] → perm_svc=1 (service addr 1 → env=prod, region=eu), role=viewer
    // 5 / 3 = 1 r2 → perm_svc=entries[1]=1, role=entries[2]=viewer
    const result = decoder.decodeDeep(5);
    expect(result.entities).toEqual({ perm_svc: 1, role: "viewer" });
    expect(result.refs).toEqual({
      perm_svc: { env: "prod", region: "eu" },
    });
  });

  it("refs 없을 때 raw number 유지", () => {
    const { permissionMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({ map: permissionMap });

    const result = decoder.decodeDeep(0);
    expect(result.entities).toEqual({ perm_svc: 0, role: "admin" });
    expect(result.refs).toEqual({});
  });

  it("index_ref 아닌 dim은 refs에 포함 안 됨", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const result = decoder.decodeDeep(0);
    expect(result.refs).toEqual({});
  });
});

// ── decodeBatch ─────────────────────────────────────────────────────────────

describe("decodeBatch", () => {
  it("number/string 혼합 배열", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const results = decoder.decodeBatch([0, "perm:v1:26"]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ role: "admin", action: "read", resource: 10 });
    expect(results[1]).toEqual({ role: "viewer", action: "delete", resource: 30 });
  });

  it("빈 배열", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    expect(decoder.decodeBatch([])).toEqual([]);
  });
});

// ── matchRanges / enumerate ─────────────────────────────────────────────────

describe("matchRanges / enumerate", () => {
  it("matchRanges: MetaCodec 위임", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const ranges = decoder.matchRanges({ role: "admin" });
    expect(ranges).toEqual([[0, 8]]);
  });

  it("enumerate: MetaCodec 위임", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const values = decoder.enumerate({ role: "admin", action: "read" });
    expect(values).toEqual([0, 1, 2]);
  });
});

// ── resolveRef / hasRef ─────────────────────────────────────────────────────

describe("resolveRef / hasRef", () => {
  it("ref 코덱으로 해석", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 0: perm_svc=0 → service decode(0) → { env: "prod", region: "asia" }
    const result = decoder.resolveRef(0, "perm_svc");
    expect(result).toEqual({ env: "prod", region: "asia" });
  });

  it("hasRef 확인", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(decoder.hasRef("perm_svc")).toBe(true);
    expect(decoder.hasRef("role")).toBe(false);
    expect(decoder.hasRef("nonexistent")).toBe(false);
  });

  it("존재하지 않는 dim → ValidationError", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(() => decoder.resolveRef(0, "nonexistent")).toThrow(ValidationError);
  });

  it("index_ref 아닌 dim → ValidationError", () => {
    const { permissionMap, serviceMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(() => decoder.resolveRef(0, "role")).toThrow(ValidationError);
  });

  it("ref 코덱 없을 때 → ValidationError", () => {
    const { permissionMap } = crossIndexMaps();
    const decoder = new PrefixDecoder({ map: permissionMap });
    expect(() => decoder.resolveRef(0, "perm_svc")).toThrow(ValidationError);
  });
});

// ── encode → decode 왕복 ────────────────────────────────────────────────────

describe("encode → decode 왕복", () => {
  it("encode → decode round-trip", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const entities = { role: "admin", action: "write", resource: 20 };
    const vv = decoder.encode(entities);
    const decoded = decoder.decode(vv.value);
    expect(decoded).toEqual(entities);
  });

  it("모든 주소 왕복 확인", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    for (let i = 0; i < decoder.size; i++) {
      const decoded = decoder.decode(i);
      const re = decoder.encode(decoded as Record<string, string | number>);
      expect(re.value).toBe(i);
    }
  });
});

// ── serialize ───────────────────────────────────────────────────────────────

describe("serialize", () => {
  it("AddressConfig 없이 기본 colon 직렬화", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = { indexId: "perm", versionId: "v1", value: 0 };
    const serialized = decoder.serialize(vv);
    expect(serialized).toBe("perm:v1:0");
  });

  it("serialize → resolve round-trip", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = { indexId: "perm", versionId: "v1", value: 13 };
    const serialized = decoder.serialize(vv);
    const resolved = decoder.resolve(serialized);
    expect(resolved).toEqual(vv);
  });

  it("프로토콜 지정 직렬화", () => {
    const decoder = new PrefixDecoder({ map: permMap() });
    const vv = { indexId: "perm", versionId: "v1", value: 5 };
    const uri = decoder.serialize(vv, "uri");
    expect(uri).toBe("wi://perm/v1/5");
  });
});

// ── toDecodeMap ─────────────────────────────────────────────────────────────

describe("toDecodeMap", () => {
  it("원본 DecodeMap과 동일 구조 반환", () => {
    const original = permMap();
    const decoder = new PrefixDecoder({ map: original });
    const exported = decoder.toDecodeMap();
    expect(exported).toEqual(original);
  });
});
