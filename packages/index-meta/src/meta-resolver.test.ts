import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import { MetaResolver } from "./meta-resolver.js";
import { IndexNotFoundError, IndexVersionNotFoundError, DimNotFoundError } from "./errors.js";
import { PACK_FORMATS } from "weighted-index";

// ── 공통 픽스처 ────────────────────────────────────────────────────────────────

const baseInput = () => ({
  dims: {
    role: {
      kind: { type: "string_enum" } as const,
      description: "사용자 역할",
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
        v2: {
          entries: ["admin", "editor", "viewer", "guest"],
          entryFlags: {
            2: { status: "inactive" as const, reason: "deprecated", updatedAt: "2026-01-01" },
          },
        },
      },
    },
    action: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
    resource: {
      kind: { type: "number_enum" } as const,
      snapshots: {
        v1: { entries: [10, 20, 30] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      description: "권한 인덱스",
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
        iv2: { snapshots: { role: "v2", action: "v1", resource: "v1" } },
      },
    },
  },
});

// ── DecodeMap ──────────────────────────────────────────────────────────────────

describe("getDecodeMap", () => {
  it("shape과 size가 정확하다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    expect(map.indexId).toBe("perm");
    expect(map.versionId).toBe("iv1");
    expect(map.shape).toEqual([3, 3, 3]);
    expect(map.size).toBe(27);
  });

  it("dims가 IndexDef.dims 순서를 유지한다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    expect(map.dims.map((d) => d.dimId)).toEqual(["role", "action", "resource"]);
  });

  it("entries가 복사본이다 (원본 불변)", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    map.dims[0].entries.push("mutated" as never);
    const sn = reg.getDimSnapshot("role", "v1");
    expect(sn.entries).toEqual(["admin", "editor", "viewer"]);
  });

  it("kind가 포함된다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    expect(map.dims[0].kind).toEqual({ type: "string_enum" });
    expect(map.dims[2].kind).toEqual({ type: "number_enum" });
  });

  it("version이 다르면 shape이 다르다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);

    expect(resolver.getDecodeMap("perm", "iv1").shape).toEqual([3, 3, 3]);
    expect(resolver.getDecodeMap("perm", "iv2").shape).toEqual([4, 3, 3]);
  });

  it("address 미설정 시 address가 undefined", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(resolver.getDecodeMap("perm", "iv1").address).toBeUndefined();
  });

  it("address 설정 시 address가 포함된다", () => {
    const reg = new MetaRegistry({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    expect(map.address).toBeDefined();
    expect(map.address!.schemas).toEqual({ perm: 1 });
  });

  it("DecodeMap으로 외부에서 decode를 재현할 수 있다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap("perm", "iv1");

    // encode로 값 생성
    const vv = reg.encode("perm", "iv1", { role: "editor", action: "write", resource: 20 });

    // DecodeMap만으로 외부 decode 재현
    const weights: number[] = [];
    for (let i = 0; i < map.shape.length; i++) {
      weights.push(map.shape.slice(i + 1).reduce((a, b) => a * b, 1));
    }

    let remaining = vv.value;
    const result: Record<string, string | number> = {};
    for (let i = 0; i < map.dims.length; i++) {
      const coord = Math.floor(remaining / weights[i]) + 1;
      remaining = remaining % weights[i];
      result[map.dims[i].dimId] = map.dims[i].entries[coord - 1];
    }

    expect(result).toEqual({ role: "editor", action: "write", resource: 20 });
  });

  it("미등록 indexId는 IndexNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDecodeMap("unknown", "iv1")).toThrow(IndexNotFoundError);
  });

  it("미등록 versionId는 IndexVersionNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDecodeMap("perm", "iv99")).toThrow(IndexVersionNotFoundError);
  });
});

// ── DimRange ──────────────────────────────────────────────────────────────────

describe("getDimRange", () => {
  it("dim의 모든 snapshot을 반환한다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange("role");

    expect(range.dimId).toBe("role");
    expect(range.kind).toEqual({ type: "string_enum" });
    expect(range.description).toBe("사용자 역할");
    expect(range.snapshots).toHaveLength(2);
  });

  it("각 snapshot의 entries와 total이 정확하다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange("role");

    const v1 = range.snapshots.find((s) => s.snapshotId === "v1")!;
    expect(v1.entries).toEqual(["admin", "editor", "viewer"]);
    expect(v1.total).toBe(3);
    expect(v1.activeIndices).toEqual([1, 2, 3]);

    const v2 = range.snapshots.find((s) => s.snapshotId === "v2")!;
    expect(v2.entries).toEqual(["admin", "editor", "viewer", "guest"]);
    expect(v2.total).toBe(4);
    expect(v2.activeIndices).toEqual([1, 3, 4]); // editor(2) inactive
  });

  it("snapshot이 하나인 dim도 정상 동작한다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange("action");

    expect(range.snapshots).toHaveLength(1);
    expect(range.snapshots[0].entries).toEqual(["read", "write", "delete"]);
  });

  it("미등록 dimId는 DimNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDimRange("unknown")).toThrow(DimNotFoundError);
  });
});

// ── IndexRange ──────────────────────────────────────────────────────────────────

describe("getIndexRange", () => {
  it("index의 모든 version을 반환한다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange("perm");

    expect(range.indexId).toBe("perm");
    expect(range.description).toBe("권한 인덱스");
    expect(range.dimIds).toEqual(["role", "action", "resource"]);
    expect(range.versions).toHaveLength(2);
  });

  it("각 version의 shape이 정확하다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange("perm");

    const iv1 = range.versions.find((v) => v.versionId === "iv1")!;
    const iv2 = range.versions.find((v) => v.versionId === "iv2")!;

    expect(iv1.shape).toEqual([3, 3, 3]);
    expect(iv1.size).toBe(27);
    expect(iv2.shape).toEqual([4, 3, 3]);
    expect(iv2.size).toBe(36);
  });

  it("version별 dim의 activeIndices가 다르다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange("perm");

    const iv1 = range.versions.find((v) => v.versionId === "iv1")!;
    const iv2 = range.versions.find((v) => v.versionId === "iv2")!;

    const roleIv1 = iv1.dims.find((d) => d.dimId === "role")!;
    const roleIv2 = iv2.dims.find((d) => d.dimId === "role")!;

    expect(roleIv1.activeIndices).toEqual([1, 2, 3]);
    expect(roleIv2.activeIndices).toEqual([1, 3, 4]); // editor(2) inactive in v2
  });

  it("version별 dim의 snapshotId가 다르다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange("perm");

    const iv1 = range.versions.find((v) => v.versionId === "iv1")!;
    const iv2 = range.versions.find((v) => v.versionId === "iv2")!;

    expect(iv1.dims[0].snapshotId).toBe("v1"); // role → v1
    expect(iv2.dims[0].snapshotId).toBe("v2"); // role → v2
    expect(iv1.dims[1].snapshotId).toBe("v1"); // action → 동일
    expect(iv2.dims[1].snapshotId).toBe("v1");
  });
});

// ── MetaDataset ──────────────────────────────────────────────────────────────

describe("getDataset", () => {
  it("전체 indices와 dims를 포함한다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    expect(dataset.indices.map((i) => i.indexId)).toContain("perm");
    expect(dataset.dims.map((d) => d.dimId)).toEqual(
      expect.arrayContaining(["role", "action", "resource"])
    );
  });

  it("indices와 dims의 내용이 개별 조회와 동일하다", () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    const permFromDataset = dataset.indices.find((i) => i.indexId === "perm")!;
    const permDirect = resolver.getIndexRange("perm");
    expect(permFromDataset).toEqual(permDirect);

    const roleFromDataset = dataset.dims.find((d) => d.dimId === "role")!;
    const roleDirect = resolver.getDimRange("role");
    expect(roleFromDataset).toEqual(roleDirect);
  });
});

// ── 다중 인덱스 시나리오 ────────────────────────────────────────────────────

describe("다중 인덱스", () => {
  const multiInput = () => ({
    dims: {
      role: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["admin", "editor"] } },
      },
      category: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          v1: { entries: ["tech", "art"] },
          v2: { entries: ["tech", "art", "science"] },
        },
      },
      lang: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["ko", "en"] } },
      },
    },
    indices: {
      perm: {
        dims: ["role"],
        versions: { v1: { snapshots: { role: "v1" } } },
      },
      content: {
        dims: ["category", "lang"],
        versions: {
          cv1: { snapshots: { category: "v1", lang: "v1" } },
          cv2: { snapshots: { category: "v2", lang: "v1" } },
        },
      },
    },
  });

  it("인덱스별로 독립된 range를 반환한다", () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);

    const perm = resolver.getIndexRange("perm");
    const content = resolver.getIndexRange("content");

    expect(perm.dimIds).toEqual(["role"]);
    expect(perm.versions).toHaveLength(1);

    expect(content.dimIds).toEqual(["category", "lang"]);
    expect(content.versions).toHaveLength(2);
  });

  it("getDataset이 모든 인덱스를 포함한다", () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    expect(dataset.indices.map((i) => i.indexId).sort()).toEqual(["content", "perm"]);
    expect(dataset.dims.map((d) => d.dimId).sort()).toEqual(["category", "lang", "role"]);
  });

  it("공유 dim은 dims에 한 번만 등장한다", () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    const dimIds = dataset.dims.map((d) => d.dimId);
    expect(new Set(dimIds).size).toBe(dimIds.length);
  });

  it("content cv2에서 category가 확장된 것이 반영된다", () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const content = resolver.getIndexRange("content");

    const cv1 = content.versions.find((v) => v.versionId === "cv1")!;
    const cv2 = content.versions.find((v) => v.versionId === "cv2")!;

    expect(cv1.shape).toEqual([2, 2]);
    expect(cv2.shape).toEqual([3, 2]);
    expect(cv2.dims[0].entries).toEqual(["tech", "art", "science"]);
  });
});
