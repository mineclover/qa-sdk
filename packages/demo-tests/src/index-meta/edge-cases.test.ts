/**
 * 라이브러리 에지 케이스 테스트
 *
 * 기존 테스트에서 커버되지 않는 경계 조건을 검증한다.
 * - MetaRegistry: toInput 왕복, snapshotDiff, versionDiff, activeManifest (inactive 전체)
 * - PrefixDecoder: enumerate, decodeDeepDetailed (복수 unresolved)
 * - RelationalEngine: resolveRelation 파라미터 조합
 * - GateEngine: 전체 inactive dim, cascade 멱등성
 * - MetaCodec: 단일 dim, 전체 wildcard matchRanges
 */
import { describe, it, expect } from "vitest";
import {
  MetaRegistry,
  MetaCodec,
  PrefixDecoder,
  RelationalEngine,
  type MetaRegistryInput,
  type DecodeMap,
  type EntityId,
  type RelationTypeRule,
} from "index-meta";

// ── 공통 테스트 데이터 ───────────────────────────────────────────────────────

function createBasicInput(): MetaRegistryInput {
  return {
    dims: {
      role: {
        kind: { type: "string_enum" },
        snapshots: {
          s1: { entries: ["admin", "editor", "viewer"] },
          s2: { entries: ["admin", "editor", "viewer", "guest"], capacity: 6 },
        },
        migrations: [
          { fromSnapshotId: "s1", toSnapshotId: "s2", indexMap: { 1: 1, 2: 2, 3: 3 } },
        ],
      },
      action: {
        kind: { type: "string_enum" },
        snapshots: {
          s1: { entries: ["create", "read", "update", "delete"] },
        },
      },
    },
    indices: {
      perm: {
        dims: ["role", "action"],
        versions: {
          v1: { snapshots: { role: "s1", action: "s1" } },
          v2: { snapshots: { role: "s2", action: "s1" } },
        },
      },
    },
  };
}

function createInactiveInput(): MetaRegistryInput {
  return {
    dims: {
      role: {
        kind: { type: "string_enum" },
        snapshots: {
          s1: {
            entries: ["admin", "editor", "viewer"],
            entryFlags: {
              1: { status: "inactive", updatedAt: "2024-01-01T00:00:00Z" },
              2: { status: "inactive", updatedAt: "2024-01-01T00:00:00Z" },
              3: { status: "inactive", updatedAt: "2024-01-01T00:00:00Z" },
            },
          },
        },
      },
      action: {
        kind: { type: "string_enum" },
        snapshots: {
          s1: { entries: ["create", "read"] },
        },
      },
    },
    indices: {
      perm: {
        dims: ["role", "action"],
        versions: {
          v1: { snapshots: { role: "s1", action: "s1" } },
        },
      },
    },
  };
}

// ── MetaRegistry 에지 케이스 ─────────────────────────────────────────────────

describe("MetaRegistry 에지 케이스", () => {
  describe("toInput() 왕복 충실도", () => {
    it("inactive entries 보존", () => {
      const input = createInactiveInput();
      const reg = new MetaRegistry(input);
      const restored = reg.toInput();

      // inactive 플래그가 보존되어야 함
      const flags = restored.dims.role.snapshots.s1.entryFlags;
      expect(flags).toBeDefined();
      expect(flags![1]?.status).toBe("inactive");
      expect(flags![2]?.status).toBe("inactive");
      expect(flags![3]?.status).toBe("inactive");
    });

    it("capacity 보존", () => {
      const input = createBasicInput();
      const reg = new MetaRegistry(input);
      const restored = reg.toInput();

      // s2의 capacity: 6 보존
      const s2 = restored.dims.role.snapshots.s2;
      expect(s2.capacity).toBe(6);
    });

    it("migration 보존", () => {
      const input = createBasicInput();
      const reg = new MetaRegistry(input);
      const restored = reg.toInput();

      expect(restored.dims.role.migrations).toBeDefined();
      expect(restored.dims.role.migrations!.length).toBe(1);
      expect(restored.dims.role.migrations![0].indexMap).toEqual({ 1: 1, 2: 2, 3: 3 });
    });

    it("왕복 후 재생성한 registry에서 encode/decode 동등", () => {
      const input = createBasicInput();
      const reg1 = new MetaRegistry(input);
      const reg2 = new MetaRegistry(reg1.toInput());

      const codec1 = reg1.createCodec("perm", "v1");
      const codec2 = reg2.createCodec("perm", "v1");

      const entities = { role: "editor", action: "update" } as Record<string, EntityId>;
      expect(codec2.encode(entities).value).toBe(codec1.encode(entities).value);
    });
  });

  describe("getActiveManifest — 전체 inactive", () => {
    it("모든 entry가 inactive → activeIndices 빈 배열", () => {
      const reg = new MetaRegistry(createInactiveInput());
      const manifest = reg.getActiveManifest("perm", "v1");

      const roleDim = manifest.dims.find(d => d.dimId === "role");
      expect(roleDim).toBeDefined();
      expect(roleDim!.activeIndices).toEqual([]);
      // total은 entries.length 유지 (shape 불변)
      expect(roleDim!.total).toBe(3);
    });

    it("일부 inactive → active만 포함", () => {
      const input = createBasicInput();
      // s1에서 editor(2)만 inactive
      input.dims.role.snapshots.s1.entryFlags = {
        2: { status: "inactive", updatedAt: "2024-01-01T00:00:00Z" },
      };
      const reg = new MetaRegistry(input);
      const manifest = reg.getActiveManifest("perm", "v1");

      const roleDim = manifest.dims.find(d => d.dimId === "role");
      expect(roleDim!.activeIndices).toEqual([1, 3]); // admin(1), viewer(3)
      expect(roleDim!.total).toBe(3);
    });
  });

  describe("isEntryActive", () => {
    it("inactive 항목 → false", () => {
      const reg = new MetaRegistry(createInactiveInput());
      expect(reg.isEntryActive("role", "s1", 1)).toBe(false);
    });

    it("active 항목 → true", () => {
      const reg = new MetaRegistry(createBasicInput());
      expect(reg.isEntryActive("role", "s1", 1)).toBe(true);
    });

    it("플래그 없는 항목 → 기본 active", () => {
      const reg = new MetaRegistry(createBasicInput());
      // s1에는 entryFlags 없음 → 전부 active
      expect(reg.isEntryActive("action", "s1", 4)).toBe(true);
    });
  });

  describe("snapshotDiff", () => {
    it("동일 snapshot 비교 → 변경 없음", () => {
      const reg = new MetaRegistry(createBasicInput());
      const diff = reg.snapshotDiff("role", "s1", "s1");

      expect(diff.capacityChanged).toBe(false);
      expect(diff.addedEntries).toEqual([]);
      expect(diff.movedPositions).toEqual([]);
    });

    it("entry 추가 + capacity 변경 감지", () => {
      const reg = new MetaRegistry(createBasicInput());
      const diff = reg.snapshotDiff("role", "s1", "s2");

      expect(diff.addedEntries).toContain("guest");
      expect(diff.capacityChanged).toBe(true);
      expect(diff.to.capacity).toBe(6);
      expect(diff.from.capacity).toBe(3); // s1 capacity = entries.length
    });
  });

  describe("versionDiff", () => {
    it("동일 version 비교", () => {
      const reg = new MetaRegistry(createBasicInput());
      const diff = reg.versionDiff("perm", "v1", "v1");

      expect(diff.weightsChanged).toBe(false);
      expect(diff.changedDims).toEqual([]);
    });

    it("shape 변경 감지 (role dim 확장)", () => {
      const reg = new MetaRegistry(createBasicInput());
      const diff = reg.versionDiff("perm", "v1", "v2");

      expect(diff.from.shape).toEqual([3, 4]);
      expect(diff.to.shape).toEqual([6, 4]); // capacity 기준 (snapshotCapacity)
      // shape[0]이 3→6으로 변경되었으므로 changedDims에 role 포함
      expect(diff.changedDims.length).toBeGreaterThan(0);
      expect(diff.changedDims[0].dimId).toBe("role");
      expect(diff.changedDims[0].fromEntriesCount).toBe(3);
      expect(diff.changedDims[0].toEntriesCount).toBe(4);
    });
  });
});

// ── MetaCodec 에지 케이스 ────────────────────────────────────────────────────

describe("MetaCodec 에지 케이스", () => {
  it("단일 dim codec", () => {
    const map: DecodeMap = {
      indexId: "tag",
      versionId: "v1",
      shape: [5],
      size: 5,
      dims: [{
        dimId: "name",
        snapshotId: "s1",
        kind: { type: "string_enum" },
        entries: ["a", "b", "c", "d", "e"],
      }],
    };
    const codec = new MetaCodec(map);

    expect(codec.encode({ name: "a" }).value).toBe(0);
    expect(codec.encode({ name: "e" }).value).toBe(4);
    expect(codec.decodeValue(0)).toEqual({ name: "a" });
    expect(codec.decodeValue(4)).toEqual({ name: "e" });
  });

  it("matchRanges 전체 wildcard → 전체 범위", () => {
    const reg = new MetaRegistry(createBasicInput());
    const codec = reg.createCodec("perm", "v1");

    const ranges = codec.matchRanges({ role: null, action: null });
    expect(ranges).toEqual([[0, codec.size - 1]]);
  });

  it("matchRanges 전체 제약 → 단일 값 범위", () => {
    const reg = new MetaRegistry(createBasicInput());
    const codec = reg.createCodec("perm", "v1");

    const vv = codec.encode({ role: "editor", action: "read" } as Record<string, EntityId>);
    const ranges = codec.matchRanges({ role: "editor", action: "read" } as Record<string, EntityId | null>);

    expect(ranges.length).toBe(1);
    expect(ranges[0][0]).toBe(vv.value);
    expect(ranges[0][1]).toBe(vv.value);
  });
});

// ── PrefixDecoder 에지 케이스 ────────────────────────────────────────────────

describe("PrefixDecoder 에지 케이스", () => {
  const permMap: DecodeMap = {
    indexId: "perm",
    versionId: "v1",
    shape: [3, 4],
    size: 12,
    dims: [
      { dimId: "role", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["admin", "editor", "viewer"] },
      { dimId: "action", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["create", "read", "update", "delete"] },
    ],
  };

  const refMap: DecodeMap = {
    indexId: "detail",
    versionId: "v1",
    shape: [2],
    size: 2,
    dims: [
      { dimId: "level", snapshotId: "s1", kind: { type: "string_enum" }, entries: ["basic", "premium"] },
    ],
  };

  const refIndexMap: DecodeMap = {
    indexId: "article",
    versionId: "v1",
    shape: [3, 2],
    size: 6,
    dims: [
      { dimId: "quality", snapshotId: "s1", kind: { type: "index_ref", indexId: "perm" }, entries: [0, 1, 2] },
      { dimId: "tag", snapshotId: "s1", kind: { type: "index_ref", indexId: "detail" }, entries: [0, 1] },
    ],
  };

  describe("enumerate", () => {
    it("부분 제약 → 해당 주소 목록", () => {
      const decoder = new PrefixDecoder({ map: permMap });
      const addresses = decoder.enumerate({ role: "admin", action: null });

      // admin(pos 1) × action(4개) = 4개 주소
      expect(addresses).toHaveLength(4);
      // 각 주소를 decode하면 role=admin
      for (const addr of addresses) {
        expect(decoder.decode(addr).role).toBe("admin");
      }
    });

    it("전체 제약 → 단일 주소", () => {
      const decoder = new PrefixDecoder({ map: permMap });
      const addresses = decoder.enumerate({ role: "editor", action: "read" } as Record<string, EntityId | null>);

      expect(addresses).toHaveLength(1);
      expect(decoder.decode(addresses[0])).toEqual({ role: "editor", action: "read" });
    });
  });

  describe("decodeDeepDetailed — 복수 unresolved", () => {
    it("refs 없이 2개 index_ref dim → unresolved 2개", () => {
      const decoder = new PrefixDecoder({ map: refIndexMap });
      const result = decoder.decodeDeepDetailed(0);

      expect(result.unresolved).toContain("quality");
      expect(result.unresolved).toContain("tag");
      expect(result.unresolved).toHaveLength(2);
      expect(result.refs).toEqual({});
    });

    it("1개만 ref 제공 → unresolved 1개", () => {
      const decoder = new PrefixDecoder({
        map: refIndexMap,
        refs: { perm: permMap },
      });
      const result = decoder.decodeDeepDetailed(0);

      // perm은 해석됨
      expect(result.refs.quality).toBeDefined();
      // detail은 미해석
      expect(result.unresolved).toEqual(["tag"]);
    });

    it("모든 ref 제공 → unresolved 빈 배열", () => {
      const decoder = new PrefixDecoder({
        map: refIndexMap,
        refs: { perm: permMap, detail: refMap },
      });
      const result = decoder.decodeDeepDetailed(0);

      expect(result.unresolved).toEqual([]);
      expect(result.refs.quality).toBeDefined();
      expect(result.refs.tag).toBeDefined();
    });
  });
});

// ── RelationalEngine 에지 케이스 ─────────────────────────────────────────────

describe("RelationalEngine 에지 케이스", () => {
  const input: MetaRegistryInput = {
    dims: {
      subject: {
        kind: { type: "string_enum" },
        snapshots: { s1: { entries: ["user", "admin", "service"] } },
      },
      predicate: {
        kind: { type: "string_enum" },
        snapshots: { s1: { entries: ["can", "cannot"] } },
      },
      object: {
        kind: { type: "string_enum" },
        snapshots: { s1: { entries: ["read", "write", "delete"] } },
      },
    },
    indices: {
      rel: {
        dims: ["subject", "predicate", "object"],
        versions: { v1: { snapshots: { subject: "s1", predicate: "s1", object: "s1" } } },
      },
    },
  };

  it("resolveRelation — instanceRules 없으면 type-level 값 직접 반환", () => {
    const engine = new RelationalEngine(input);
    const typeRules: RelationTypeRule<string>[] = [
      { id: "r1", pattern: [null, null, null], effect: "allow" },
    ];

    const result = engine.resolveRelation(
      [1, 1, 1], // subject=user, predicate=can, object=read
      [3, 2, 3],
      typeRules,
      "most-specific",
      // instanceCoord 생략
    );

    expect(result).not.toBeNull();
    expect(result!.value).toBe("allow");
    expect(result!.instanceLevel).toBeUndefined();
  });

  it("resolveRelation — instanceRules 있지만 instanceCoord 없으면 type-level만", () => {
    const engine = new RelationalEngine(input);
    const typeRules: RelationTypeRule<string>[] = [
      {
        id: "r1",
        pattern: [null, null, null],
        effect: "allow",
        instanceRules: {
          indexId: "rel",
          versionId: "v1",
          rules: [{ id: "ir1", pattern: [null, null, null], value: "deny" }],
          strategy: "most-specific",
        },
      },
    ];

    const result = engine.resolveRelation(
      [1, 1, 1],
      [3, 2, 3],
      typeRules,
      "most-specific",
      // instanceCoord 생략 → Level 2 skip
    );

    expect(result).not.toBeNull();
    expect(result!.value).toBe("allow"); // type-level effect
    expect(result!.instanceLevel).toBeUndefined(); // Level 2 미실행
  });

  it("resolveRelation — 매칭 없으면 null", () => {
    const engine = new RelationalEngine(input);
    const typeRules: RelationTypeRule<string>[] = [
      { id: "r1", pattern: ["1", null, null], effect: "allow" }, // subject=user만
    ];

    const result = engine.resolveRelation(
      [2, 1, 1], // subject=admin → 매칭 안 됨
      [3, 2, 3],
      typeRules,
      "most-specific",
    );

    expect(result).toBeNull();
  });

  it("resolveRelation — collect 전략", () => {
    const engine = new RelationalEngine(input);
    const typeRules: RelationTypeRule<string>[] = [
      { id: "r1", pattern: [null, null, null], effect: "base" },
      { id: "r2", pattern: ["1", null, null], effect: "user-specific" },
    ];

    const result = engine.resolveRelation(
      [1, 1, 1], // subject=user
      [3, 2, 3],
      typeRules,
      "collect",
    );

    expect(result).not.toBeNull();
    // collect 전략: 매칭되는 모든 값 수집
    const typeValue = result!.typeLevel.value;
    expect(Array.isArray(typeValue)).toBe(true);
    expect(typeValue).toContain("base");
    expect(typeValue).toContain("user-specific");
  });
});
