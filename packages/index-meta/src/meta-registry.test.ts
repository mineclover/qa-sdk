import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import {
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "./errors.js";
import { PACK_FORMATS } from "weighted-index";

// ── 공통 픽스처 ────────────────────────────────────────────────────────────────

const baseInput = () => ({
  dims: {
    role: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
        v2: { entries: ["admin", "editor", "viewer", "guest"] },
      },
    },
    action: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
    resource: {
      kind: { type: "number_enum" } as const,  // 그냥 number unique key
      snapshots: {
        v1: { entries: [10, 20, 30] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
        iv2: { snapshots: { role: "v2", action: "v1", resource: "v1" } },
      },
    },
  },
});

// ── ID 콜론 제약 ──────────────────────────────────────────────────────────────

describe("ID colon restriction", () => {
  it("dimId에 콜론이 있으면 ValidationError", () => {
    const input = baseInput();
    (input.dims as Record<string, unknown>)["ro:le"] = input.dims.role;
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("snapshotId에 콜론이 있으면 ValidationError", () => {
    const input = baseInput();
    (input.dims.role.snapshots as Record<string, unknown>)["v:1"] =
      input.dims.role.snapshots.v1;
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("indexId에 콜론이 있으면 ValidationError", () => {
    const input = baseInput();
    (input.indices as Record<string, unknown>)["pe:rm"] = input.indices.perm;
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("versionId에 콜론이 있으면 ValidationError", () => {
    const input = baseInput();
    (input.indices.perm.versions as Record<string, unknown>)["iv:1"] =
      input.indices.perm.versions.iv1;
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("콜론 없는 정상 ID는 serialize/parse round-trip이 보장된다", () => {
    const reg = new MetaRegistry(baseInput());
    const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
    const str = reg.serialize(vv);
    expect(reg.parse(str)).toEqual(vv);
  });
});

// ── DimKind 검증 ──────────────────────────────────────────────────────────────

describe("DimKind", () => {
  it("string_enum dim은 DimDef.kind로 조회된다", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.getDimDef("role").kind).toEqual({ type: "string_enum" });
    expect(reg.getDimDef("action").kind).toEqual({ type: "string_enum" });
  });

  it("number_enum dim은 DimDef.kind로 조회된다", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.getDimDef("resource").kind).toEqual({ type: "number_enum" });
  });

  it("string_enum dim에 number entries가 있으면 ValidationError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = { entries: [1, 2, 3] as unknown as string[] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("number_enum dim에 string entries가 있으면 ValidationError", () => {
    const input = baseInput();
    input.dims.resource.snapshots.v1 = { entries: ["a", "b"] as unknown as number[] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("number_enum dim에 음수가 있으면 ValidationError", () => {
    const input = baseInput();
    input.dims.resource.snapshots.v1 = { entries: [-1, 20, 30] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("index_ref에 유효한 indexId를 명시하면 생성 성공", () => {
    const input = baseInput();
    (input.dims.resource as { kind: unknown }).kind = {
      type: "index_ref",
      indexId: "perm",
    };
    expect(() => new MetaRegistry(input)).not.toThrow();
  });

  it("index_ref에 존재하지 않는 indexId를 명시하면 IndexNotFoundError", () => {
    const input = baseInput();
    (input.dims.resource as { kind: unknown }).kind = {
      type: "index_ref",
      indexId: "unknown_index",
    };
    expect(() => new MetaRegistry(input)).toThrow(IndexNotFoundError);
  });
});

// ── entry-level index_ref (entryRefs) ─────────────────────────────────────────

describe("entryRefs (entry-level index_ref)", () => {
  const inputWithEntryRefs = () => {
    const input = baseInput();
    // role은 string_enum이지만 특정 entry(index 2 = "editor")가
    // 다른 index(perm)의 1D 압축값을 담고 있는 특별 케이스
    input.dims.role.snapshots.v1 = {
      entries: ["admin", 42, "viewer"],  // index 2 = 42 (perm:iv1의 VersionedValue.value)
      entryRefs: {
        2: { indexId: "perm", versionId: "iv1" },
      },
    };
    return input;
  };

  it("entryRefs가 있는 snapshot을 생성할 수 있다", () => {
    expect(() => new MetaRegistry(inputWithEntryRefs())).not.toThrow();
  });

  it("getDimSnapshot으로 entryRefs를 조회할 수 있다", () => {
    const reg = new MetaRegistry(inputWithEntryRefs());
    const sn = reg.getDimSnapshot("role", "v1");
    expect(sn.entryRefs[2]).toEqual({ indexId: "perm", versionId: "iv1" });
    expect(sn.entryRefs[1]).toBeUndefined();
  });

  it("entryRefs의 entry 값이 string이면 ValidationError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", "editor", "viewer"],
      entryRefs: { 2: { indexId: "perm", versionId: "iv1" } },
    };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("entryRefs 키가 범위 밖이면 ValidationError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", "editor", "viewer"],
      entryRefs: { 99: { indexId: "perm", versionId: "iv1" } } as unknown as typeof input.dims.role.snapshots.v1["entryRefs"],
    };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("entryRefs가 존재하지 않는 indexId를 가리키면 IndexNotFoundError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", 42, "viewer"],
      entryRefs: { 2: { indexId: "ghost_index", versionId: "iv1" } },
    };
    expect(() => new MetaRegistry(input)).toThrow(IndexNotFoundError);
  });

  it("entryRefs가 존재하지 않는 versionId를 가리키면 IndexVersionNotFoundError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", 42, "viewer"],
      entryRefs: { 2: { indexId: "perm", versionId: "iv99" } },
    };
    expect(() => new MetaRegistry(input)).toThrow(IndexVersionNotFoundError);
  });

  it("entryRefs가 없는 snapshot은 entryRefs가 빈 객체다", () => {
    const reg = new MetaRegistry(baseInput());
    const sn = reg.getDimSnapshot("role", "v1");
    expect(sn.entryRefs).toEqual({});
  });
});

// ── 생성자 검증 ───────────────────────────────────────────────────────────────

describe("MetaRegistry constructor", () => {
  it("정상 입력으로 생성된다", () => {
    expect(() => new MetaRegistry(baseInput())).not.toThrow();
  });

  it("empty entries는 ValidationError", () => {
    const input = baseInput();
    (input.dims.role.snapshots as Record<string, unknown>).v1 = { entries: [] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("중복 entity id는 ValidationError", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = { entries: ["admin", "admin", "viewer"] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("entries의 -0은 0으로 정규화되어 저장·반환된다", () => {
    const input = baseInput();
    input.dims.resource.snapshots.v1 = { entries: [-0, 20, 30] };
    const reg = new MetaRegistry(input);
    const sn = reg.getDimSnapshot("resource", "v1");
    expect(Object.is(sn.entries[0], 0)).toBe(true);   // +0
    expect(Object.is(sn.entries[0], -0)).toBe(false);  // -0 아님
  });

  it("-0과 0은 같은 entity id로 취급되어 중복 ValidationError", () => {
    const input = baseInput();
    input.dims.resource.snapshots.v1 = { entries: [-0, 0, 30] };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("존재하지 않는 dimId를 참조하면 DimNotFoundError", () => {
    const input = baseInput();
    (input.indices.perm as unknown as { dims: string[] }).dims = ["role", "action", "unknown_dim"];
    expect(() => new MetaRegistry(input)).toThrow(DimNotFoundError);
  });

  it("IndexVersion에서 dim 누락 시 ValidationError", () => {
    const input = baseInput();
    input.indices.perm.versions.iv1 = {
      snapshots: { role: "v1", action: "v1" }, // resource 누락
    };
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("IndexVersion에서 존재하지 않는 snapshotId 참조 시 SnapshotNotFoundError", () => {
    const input = baseInput();
    input.indices.perm.versions.iv1 = {
      snapshots: { role: "v999", action: "v1", resource: "v1" },
    };
    expect(() => new MetaRegistry(input)).toThrow(SnapshotNotFoundError);
  });
});

// ── getActiveManifest ────────────────────────────────────────────────────────

describe("getActiveManifest", () => {
  it("모든 entry가 active이면 activeIndices = [1..total]", () => {
    const reg = new MetaRegistry(baseInput());
    const manifest = reg.getActiveManifest("perm", "iv1");

    expect(manifest.indexId).toBe("perm");
    expect(manifest.versionId).toBe("iv1");
    expect(manifest.dims).toHaveLength(3);

    const roleSet = manifest.dims.find((d) => d.dimId === "role")!;
    expect(roleSet.total).toBe(3);
    expect(roleSet.activeIndices).toEqual([1, 2, 3]);
  });

  it("inactive entry는 activeIndices에서 제외된다", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", "editor", "viewer"],
      entryFlags: {
        2: { status: "inactive", updatedAt: "2026-01-01T00:00:00Z" },
      },
    };
    const reg = new MetaRegistry(input);
    const manifest = reg.getActiveManifest("perm", "iv1");
    const roleSet = manifest.dims.find((d) => d.dimId === "role")!;

    expect(roleSet.total).toBe(3);        // shape은 변하지 않음
    expect(roleSet.activeIndices).toEqual([1, 3]); // 2번(editor)만 제외
  });

  it("버전마다 다른 snapshot을 사용한다", () => {
    const reg = new MetaRegistry(baseInput());
    const iv1 = reg.getActiveManifest("perm", "iv1");
    const iv2 = reg.getActiveManifest("perm", "iv2");

    const roleIv1 = iv1.dims.find((d) => d.dimId === "role")!;
    const roleIv2 = iv2.dims.find((d) => d.dimId === "role")!;

    expect(roleIv1.total).toBe(3);
    expect(roleIv2.total).toBe(4);
    expect(roleIv1.snapshotId).toBe("v1");
    expect(roleIv2.snapshotId).toBe("v2");
  });

  it("알 수 없는 indexId는 IndexNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() => reg.getActiveManifest("unknown", "iv1")).toThrow(IndexNotFoundError);
  });

  it("알 수 없는 versionId는 IndexVersionNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() => reg.getActiveManifest("perm", "iv99")).toThrow(IndexVersionNotFoundError);
  });
});

// ── encode / decode ───────────────────────────────────────────────────────────

describe("encode / decode", () => {
  it("encode 후 decode하면 원래 entity ID를 복원한다", () => {
    const reg = new MetaRegistry(baseInput());
    const vv = reg.encode("perm", "iv1", {
      role: "admin",
      action: "write",
      resource: 20,
    });

    expect(vv.indexId).toBe("perm");
    expect(vv.versionId).toBe("iv1");
    expect(typeof vv.value).toBe("number");

    const ids = reg.decode(vv);
    expect(ids.role).toBe("admin");
    expect(ids.action).toBe("write");
    expect(ids.resource).toBe(20);
  });

  it("encode: 존재하지 않는 entity id는 EntryNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() =>
      reg.encode("perm", "iv1", { role: "superadmin", action: "read", resource: 10 })
    ).toThrow(EntryNotFoundError);
  });

  it("encode: dim 누락 시 ValidationError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() =>
      reg.encode("perm", "iv1", { role: "admin", action: "read" }) // resource 누락
    ).toThrow(ValidationError);
  });

  it("inactive entry로 만들어진 값도 decode는 가능하다", () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = {
      entries: ["admin", "editor", "viewer"],
      entryFlags: {
        1: { status: "inactive", updatedAt: "2026-01-01T00:00:00Z" },
      },
    };
    const reg = new MetaRegistry(input);

    // encode: entryFlags는 enforcement 하지 않으므로 admin(index 1)으로 인코딩 가능
    const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
    const ids = reg.decode(vv);
    expect(ids.role).toBe("admin");
  });

  it("서로 다른 좌표는 서로 다른 value를 생성한다 (bijection)", () => {
    const reg = new MetaRegistry(baseInput());
    const seen = new Set<number>();
    const roles = ["admin", "editor", "viewer"];
    const actions = ["read", "write", "delete"];
    const resources = [10, 20, 30];

    for (const role of roles) {
      for (const action of actions) {
        for (const resource of resources) {
          const { value } = reg.encode("perm", "iv1", { role, action, resource });
          expect(seen.has(value)).toBe(false);
          seen.add(value);
        }
      }
    }
    expect(seen.size).toBe(3 * 3 * 3);
  });
});

// ── serialize / parse ────────────────────────────────────────────────────────

describe("serialize / parse", () => {
  it("serialize → parse round-trip", () => {
    const reg = new MetaRegistry(baseInput());
    const vv = reg.encode("perm", "iv1", {
      role: "viewer",
      action: "read",
      resource: 30,
    });
    const str = reg.serialize(vv);
    const parsed = reg.parse(str);

    expect(parsed.indexId).toBe(vv.indexId);
    expect(parsed.versionId).toBe(vv.versionId);
    expect(parsed.value).toBe(vv.value);
  });

  it("형식이 잘못된 문자열은 ParseError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() => reg.parse("nocolon")).toThrow(ParseError);
    expect(() => reg.parse("only:onecolon")).toThrow(ParseError);
  });

  it("미등록 indexId는 IndexNotFoundError, 미등록 versionId는 IndexVersionNotFoundError", () => {
    const reg = new MetaRegistry(baseInput());
    expect(() => reg.parse("unknown:iv1:0")).toThrow(IndexNotFoundError);
    expect(() => reg.parse("perm:iv99:0")).toThrow(IndexVersionNotFoundError);
  });

  it("value가 WeightedIndex size 이상이면 ParseError", () => {
    const reg = new MetaRegistry(baseInput());
    // perm iv1: shape [3,3,3] → size=27, 유효 범위 [0,26]
    expect(() => reg.parse("perm:iv1:27")).toThrow(ParseError);
    expect(() => reg.parse("perm:iv1:9999")).toThrow(ParseError);
    expect(() => reg.parse("perm:iv1:26")).not.toThrow(); // 경계값 정상
  });
});

// ── 조회 API ────────────────────────────────────────────────────────────────

describe("accessor API", () => {
  it("dimIds / indexIds 반환", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.dimIds).toContain("role");
    expect(reg.dimIds).toContain("action");
    expect(reg.indexIds).toContain("perm");
  });

  it("getVersionIds 반환", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.getVersionIds("perm")).toEqual(expect.arrayContaining(["iv1", "iv2"]));
  });

  it("getSnapshotIds 반환", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.getSnapshotIds("role")).toEqual(expect.arrayContaining(["v1", "v2"]));
  });

  it("getDimSnapshot은 entries와 entryFlags를 반환한다", () => {
    const reg = new MetaRegistry(baseInput());
    const sn = reg.getDimSnapshot("role", "v1");
    expect(sn.entries).toEqual(["admin", "editor", "viewer"]);
    expect(sn.entryFlags).toEqual({});
  });
});

// ── DimSnapshotMigration ─────────────────────────────────────────────────────

describe("DimSnapshotMigration", () => {
  const inputWithMigrations = () => {
    const input = baseInput();
    // v1: ["admin"(1), "editor"(2), "viewer"(3)]
    // v2: ["superadmin"(1), "editor"(2), "viewer"(3), "guest"(4)]
    //   → admin(1) → superadmin(1): 같은 위치, indexMap 불필요 (identity)
    //
    // v3: ["superadmin"(1), "member"(2), "viewer"(3), "guest"(4), "bot"(5)]
    //   → editor(2) → member(2): 같은 위치이지만 의미 변경
    //   → v2→v3 migration: indexMap 없어도 되지만 changelog로 기록
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      {
        fromSnapshotId: "v1",
        toSnapshotId: "v2",
        indexMap: {},  // 모든 position이 그대로 유지
        changelog: "admin → superadmin (동일 위치)",
      },
      {
        fromSnapshotId: "v2",
        toSnapshotId: "v2b",
        // v2b: position 2(editor)가 position 4로 이동, 새 값이 2번 자리로 들어옴
        indexMap: { 2: 4, 3: 3, 4: 2 },
      },
    ];
    input.dims.role.snapshots = {
      v1: { entries: ["admin", "editor", "viewer"] },
      v2: { entries: ["superadmin", "editor", "viewer", "guest"] },
      v2b: { entries: ["superadmin", "guest", "viewer", "editor"] },
    };
    return input;
  };

  it("migration이 있는 경우 생성 성공", () => {
    expect(() => new MetaRegistry(inputWithMigrations())).not.toThrow();
  });

  it("getMigration으로 직접 migration을 조회한다", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    const mig = reg.getMigration("role", "v1", "v2");
    expect(mig.fromSnapshotId).toBe("v1");
    expect(mig.toSnapshotId).toBe("v2");
    expect(mig.indexMap).toEqual({});
  });

  it("직접 migration이 없으면 MigrationNotFoundError", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    // v1→v2b는 직접 등록 안 됨 (v1→v2→v2b 경로만 있음)
    expect(() => reg.getMigration("role", "v1", "v2b")).toThrow(MigrationNotFoundError);
  });

  it("traceMigration: 동일 snapshot이면 index 그대로", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    expect(reg.traceMigration("role", "v1", "v1", 2)).toBe(2);
  });

  it("traceMigration: 직접 migration (indexMap identity)", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    // v1→v2: indexMap이 비어있으므로 모두 identity
    expect(reg.traceMigration("role", "v1", "v2", 1)).toBe(1);
    expect(reg.traceMigration("role", "v1", "v2", 2)).toBe(2);
  });

  it("traceMigration: chain (v1→v2→v2b)", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    // v1의 position 2(editor)는 v2에서도 2번 (identity)
    // v2의 position 2(editor)는 v2b에서 4번으로 이동 (indexMap { 2: 4, ... })
    expect(reg.traceMigration("role", "v1", "v2b", 2)).toBe(4);
    // v1의 position 1(admin)은 v2→v2b 모두 1번 유지
    expect(reg.traceMigration("role", "v1", "v2b", 1)).toBe(1);
  });

  it("traceMigration: 경로가 없으면 MigrationNotFoundError", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    expect(() => reg.traceMigration("role", "v2", "v1", 1)).toThrow(MigrationNotFoundError);
  });

  it("getMigration: 존재하지 않는 dimId는 DimNotFoundError", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    expect(() => reg.getMigration("ghost", "v1", "v2")).toThrow(DimNotFoundError);
  });

  it("traceMigration: 존재하지 않는 dimId는 DimNotFoundError", () => {
    const reg = new MetaRegistry(inputWithMigrations());
    expect(() => reg.traceMigration("ghost", "v1", "v2", 1)).toThrow(DimNotFoundError);
  });

  it("fromSnapshotId === toSnapshotId이면 ValidationError", () => {
    const input = baseInput();
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      { fromSnapshotId: "v1", toSnapshotId: "v1", indexMap: {} },
    ];
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("indexMap key가 fromSnapshot 범위를 벗어나면 ValidationError", () => {
    const input = baseInput();
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      { fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: { 99: 1 } },
    ];
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("indexMap value가 toSnapshot 범위를 벗어나면 ValidationError", () => {
    const input = baseInput();
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      { fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: { 1: 99 } },
    ];
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("indexMap value가 중복이면 ValidationError (bijection)", () => {
    const input = baseInput();
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      { fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: { 1: 2, 2: 2 } },
    ];
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });

  it("동일 (from, to) migration 중복 등록은 ValidationError", () => {
    const input = baseInput();
    (input.dims.role as unknown as { migrations: unknown[] }).migrations = [
      { fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: {} },
      { fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: { 1: 1 } },
    ];
    expect(() => new MetaRegistry(input)).toThrow(ValidationError);
  });
});

// ── 시나리오: API 권한 관리 시스템 ──────────────────────────────────────────────
//
// role × action × resource 3차원 권한 인덱스.
// v1 → v2 진화:
//   role: guest 추가 (v1→v2 snapshot 교체)
//   action: delete 비활성화 (v2 entryFlag)

describe("시나리오: API 권한 관리 시스템", () => {
  const permInput = () => ({
    dims: {
      role: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          v1: { entries: ["admin", "editor", "viewer"] },
          v2: { entries: ["admin", "editor", "viewer", "guest"] },
        },
      },
      action: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          v1: { entries: ["read", "write", "delete"] },
          v2: {
            entries: ["read", "write", "delete"],
            entryFlags: {
              3: { status: "inactive" as const, reason: "deprecated", updatedAt: "2026-03-01" },
            },
          },
        },
      },
      resource: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          v1: { entries: ["articles", "comments", "users"] },
        },
      },
    },
    indices: {
      perm: {
        dims: ["role", "action", "resource"],
        versions: {
          v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
          v2: { snapshots: { role: "v2", action: "v2", resource: "v1" } },
        },
      },
    },
  });

  it("v1 manifest: role 3개 모두 active, action 3개 모두 active", () => {
    const reg = new MetaRegistry(permInput());
    const m = reg.getActiveManifest("perm", "v1");
    const role = m.dims.find((d) => d.dimId === "role")!;
    const action = m.dims.find((d) => d.dimId === "action")!;
    expect(role.total).toBe(3);
    expect(role.activeIndices).toEqual([1, 2, 3]);
    expect(action.total).toBe(3);
    expect(action.activeIndices).toEqual([1, 2, 3]);
  });

  it("v2 manifest: guest가 activeIndices에 포함되고, delete는 제외된다", () => {
    const reg = new MetaRegistry(permInput());
    const m = reg.getActiveManifest("perm", "v2");
    const role = m.dims.find((d) => d.dimId === "role")!;
    const action = m.dims.find((d) => d.dimId === "action")!;
    expect(role.total).toBe(4);
    expect(role.activeIndices).toEqual([1, 2, 3, 4]); // guest 포함
    expect(action.total).toBe(3);
    expect(action.activeIndices).toEqual([1, 2]); // delete(3) 제외
  });

  it("v1으로 encode된 값이 v1에서 올바르게 decode된다", () => {
    const reg = new MetaRegistry(permInput());
    const vv = reg.encode("perm", "v1", { role: "editor", action: "write", resource: "articles" });
    expect(reg.decode(vv)).toEqual({ role: "editor", action: "write", resource: "articles" });
  });

  it("EntityId 기반 v1→v2 암묵적 이동: 동일 EntityId가 새 버전에서도 올바르게 encode/decode된다", () => {
    const reg = new MetaRegistry(permInput());

    // v1으로 encode
    const v1vv = reg.encode("perm", "v1", { role: "viewer", action: "read", resource: "users" });
    const entityIds = reg.decode(v1vv);

    // 동일 EntityId로 v2 encode (viewer가 v2에서도 같은 EntityId이므로 idToIndex가 위치 자동 탐색)
    const v2vv = reg.encode("perm", "v2", entityIds);
    expect(v2vv.versionId).toBe("v2");

    // v2로 decode하면 동일한 EntityId
    expect(reg.decode(v2vv)).toEqual({ role: "viewer", action: "read", resource: "users" });
  });

  it("v2에만 있는 guest 역할은 v2에서만 encode 가능", () => {
    const reg = new MetaRegistry(permInput());
    expect(() =>
      reg.encode("perm", "v2", { role: "guest", action: "read", resource: "articles" })
    ).not.toThrow();
    expect(() =>
      reg.encode("perm", "v1", { role: "guest", action: "read", resource: "articles" })
    ).toThrow(EntryNotFoundError);
  });

  it("v1과 v2의 WeightedIndex size가 다르다 (role 차원 확장 반영)", () => {
    const reg = new MetaRegistry(permInput());
    const wi1 = reg.getWeightedIndex("perm", "v1");
    const wi2 = reg.getWeightedIndex("perm", "v2");
    expect(wi1.size).toBe(3 * 3 * 3); // 27
    expect(wi2.size).toBe(4 * 3 * 3); // 36
  });

  it("getWeightedIndex는 동일 버전에 대해 캐시된 인스턴스를 반환한다", () => {
    const reg = new MetaRegistry(permInput());
    expect(reg.getWeightedIndex("perm", "v1")).toBe(reg.getWeightedIndex("perm", "v1"));
    expect(reg.getWeightedIndex("perm", "v1")).not.toBe(reg.getWeightedIndex("perm", "v2"));
  });
});

// ── 시나리오: 콘텐츠 분류 버전 진화 ────────────────────────────────────────────
//
// category dim이 버전마다 순서가 바뀌고 항목이 추가됨.
//   s1: tech(1) science(2) art(3)
//   s2: tech(1) art(2) science(3) culture(4)  ← science↔art 재배치, culture 추가
//   s3: tech(1) art(2) science(3) culture(4) sports(5)  ← sports append
//
// traceMigration과 EntityId 기반 이동이 동일한 결과를 가리키는지 확인.

describe("시나리오: 콘텐츠 분류 버전 진화", () => {
  const contentInput = () => ({
    dims: {
      category: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          s1: { entries: ["tech", "science", "art"] },
          s2: { entries: ["tech", "art", "science", "culture"] },
          s3: { entries: ["tech", "art", "science", "culture", "sports"] },
        },
        migrations: [
          {
            fromSnapshotId: "s1",
            toSnapshotId: "s2",
            indexMap: { 2: 3, 3: 2 }, // science: 2→3, art: 3→2
          },
          {
            fromSnapshotId: "s2",
            toSnapshotId: "s3",
            indexMap: {}, // 순서 변경 없음, sports만 append
          },
        ],
      },
      lang: {
        kind: { type: "string_enum" } as const,
        snapshots: {
          lv1: { entries: ["ko", "en"] },
        },
      },
    },
    indices: {
      content: {
        dims: ["category", "lang"],
        versions: {
          cv1: { snapshots: { category: "s1", lang: "lv1" } },
          cv2: { snapshots: { category: "s2", lang: "lv1" } },
          cv3: { snapshots: { category: "s3", lang: "lv1" } },
        },
      },
    },
  });

  it("traceMigration s1→s2: science(2)→3, art(3)→2, tech(1)→1 (identity)", () => {
    const reg = new MetaRegistry(contentInput());
    expect(reg.traceMigration("category", "s1", "s2", 1)).toBe(1); // tech: identity
    expect(reg.traceMigration("category", "s1", "s2", 2)).toBe(3); // science: 2→3
    expect(reg.traceMigration("category", "s1", "s2", 3)).toBe(2); // art: 3→2
  });

  it("traceMigration s1→s3: 2-hop chain (s1→s2→s3)", () => {
    const reg = new MetaRegistry(contentInput());
    // science: s1=2 → s2=3 (migration) → s3=3 (identity, s2→s3 indexMap={})
    expect(reg.traceMigration("category", "s1", "s3", 2)).toBe(3);
    // art: s1=3 → s2=2 (migration) → s3=2 (identity)
    expect(reg.traceMigration("category", "s1", "s3", 3)).toBe(2);
    // tech: s1=1 → s2=1 (identity) → s3=1 (identity)
    expect(reg.traceMigration("category", "s1", "s3", 1)).toBe(1);
  });

  it("EntityId 기반 cv1→cv2 이동: decode→re-encode로 동일한 EntityId 보존", () => {
    const reg = new MetaRegistry(contentInput());

    // cv1에서 science/ko 인코딩
    const cv1vv = reg.encode("content", "cv1", { category: "science", lang: "ko" });
    const ids = reg.decode(cv1vv);
    expect(ids).toEqual({ category: "science", lang: "ko" });

    // 동일 EntityId로 cv2 인코딩 (science는 cv2 s2에서 position 3)
    const cv2vv = reg.encode("content", "cv2", ids);
    expect(reg.decode(cv2vv)).toEqual({ category: "science", lang: "ko" });

    // 두 버전의 value는 다르다 (science 좌표 위치가 다름)
    expect(cv1vv.value).not.toBe(cv2vv.value);
  });

  it("traceMigration 결과 좌표와 EntityId 기반 이동 후 좌표가 일치한다", () => {
    const reg = new MetaRegistry(contentInput());

    const cv1vv = reg.encode("content", "cv1", { category: "science", lang: "ko" });
    const cv2vv = reg.encode("content", "cv2", { category: "science", lang: "ko" });

    const coordsInCv1 = reg.getWeightedIndex("content", "cv1").decode(cv1vv.value);
    const coordsInCv2 = reg.getWeightedIndex("content", "cv2").decode(cv2vv.value);

    // s1에서 science = position 2, s2에서 science = position 3
    expect(coordsInCv1[0]).toBe(2);
    expect(coordsInCv2[0]).toBe(3);

    // traceMigration(s1, s2, 2) = 3 과 일치
    expect(reg.traceMigration("category", "s1", "s2", coordsInCv1[0])).toBe(coordsInCv2[0]);
  });

  it("s3에 추가된 sports는 cv3에서 encode/decode 가능하고 cv1/cv2에는 없다", () => {
    const reg = new MetaRegistry(contentInput());
    expect(() =>
      reg.encode("content", "cv3", { category: "sports", lang: "en" })
    ).not.toThrow();
    expect(() =>
      reg.encode("content", "cv1", { category: "sports", lang: "en" })
    ).toThrow(EntryNotFoundError);
    expect(() =>
      reg.encode("content", "cv2", { category: "sports", lang: "en" })
    ).toThrow(EntryNotFoundError);
  });
});

// ── 시나리오: 중첩 index (index_ref 차원) ───────────────────────────────────────
//
// doc_meta = format × lang (inner index, shape [2,2])
//   encode(pdf, ko)=0  encode(pdf, en)=1  encode(html, ko)=2  encode(html, en)=3
//
// quality_tier dim: index_ref → doc_meta
//   entries: [0, 2]  → position 1 = pdf/ko, position 2 = html/ko
//
// article index: quality_tier dim (outer index)
//
// article 값을 decode하면 doc_meta 압축값이 나오고,
// 그 값으로 doc_meta를 다시 decode하면 format+lang을 얻는다.

describe("시나리오: 중첩 index (index_ref 차원)", () => {
  const nestedInput = () => ({
    dims: {
      format: {
        kind: { type: "string_enum" } as const,
        snapshots: { fv1: { entries: ["pdf", "html"] } },
      },
      lang: {
        kind: { type: "string_enum" } as const,
        snapshots: { lv1: { entries: ["ko", "en"] } },
      },
      quality_tier: {
        kind: { type: "index_ref", indexId: "doc_meta" } as const,
        snapshots: {
          qtv1: { entries: [0, 2] }, // doc_meta 압축값: pdf/ko=0, html/ko=2
        },
      },
    },
    indices: {
      doc_meta: {
        dims: ["format", "lang"],
        versions: { dmv1: { snapshots: { format: "fv1", lang: "lv1" } } },
      },
      article: {
        dims: ["quality_tier"],
        versions: { av1: { snapshots: { quality_tier: "qtv1" } } },
      },
    },
  });

  it("quality_tier dim의 kind가 index_ref로 조회된다", () => {
    const reg = new MetaRegistry(nestedInput());
    expect(reg.getDimDef("quality_tier").kind).toEqual({
      type: "index_ref",
      indexId: "doc_meta",
    });
  });

  it("article encode/decode: quality_tier에 doc_meta 압축값을 그대로 저장하고 복원한다", () => {
    const reg = new MetaRegistry(nestedInput());

    // quality_tier=0 (pdf/ko의 doc_meta 압축값)
    const vv0 = reg.encode("article", "av1", { quality_tier: 0 });
    expect(reg.decode(vv0)).toEqual({ quality_tier: 0 });

    // quality_tier=2 (html/ko의 doc_meta 압축값)
    const vv2 = reg.encode("article", "av1", { quality_tier: 2 });
    expect(reg.decode(vv2)).toEqual({ quality_tier: 2 });
  });

  it("article decode 결과(doc_meta value)로 inner index를 재귀 decode할 수 있다", () => {
    const reg = new MetaRegistry(nestedInput());

    // outer article decode → doc_meta 압축값 획득
    const vv = reg.encode("article", "av1", { quality_tier: 2 });
    const outerIds = reg.decode(vv);
    const docMetaValue = outerIds.quality_tier as number;
    expect(docMetaValue).toBe(2);

    // inner doc_meta decode → format + lang
    const innerIds = reg.decode({ indexId: "doc_meta", versionId: "dmv1", value: docMetaValue });
    expect(innerIds).toEqual({ format: "html", lang: "ko" });
  });

  it("quality_tier manifest: total=2, activeIndices=[1,2]", () => {
    const reg = new MetaRegistry(nestedInput());
    const m = reg.getActiveManifest("article", "av1");
    const qt = m.dims.find((d) => d.dimId === "quality_tier")!;
    expect(qt.total).toBe(2);
    expect(qt.activeIndices).toEqual([1, 2]);
  });

  it("quality_tier entries에 없는 doc_meta 압축값은 EntryNotFoundError", () => {
    const reg = new MetaRegistry(nestedInput());
    // 1(pdf/en), 3(html/en)은 quality_tier entries에 없음
    expect(() => reg.encode("article", "av1", { quality_tier: 1 })).toThrow(EntryNotFoundError);
    expect(() => reg.encode("article", "av1", { quality_tier: 3 })).toThrow(EntryNotFoundError);
  });

  it("doc_meta 전체 조합에 대한 압축값이 bijection임을 확인한다", () => {
    const reg = new MetaRegistry(nestedInput());
    // shape [2,2]: 가능한 값 = 0,1,2,3
    const expected = new Map([
      [0, { format: "pdf", lang: "ko" }],
      [1, { format: "pdf", lang: "en" }],
      [2, { format: "html", lang: "ko" }],
      [3, { format: "html", lang: "en" }],
    ]);
    for (const [value, ids] of expected) {
      expect(reg.decode({ indexId: "doc_meta", versionId: "dmv1", value })).toEqual(ids);
    }
  });
});

// ── Address 프로토콜 바인딩 ──────────────────────────────────────────────────
//
// MetaRegistry에 address config를 설정해 layout protocol 기반
// PK 직렬화(toPK/fromPK)를 테스트한다.

describe("Address 프로토콜 바인딩", () => {
  const inputWithAddress = () => ({
    ...baseInput(),
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { iv1: 1, iv2: 2 },
    },
  });

  // ── AddressConfig 검증 ──────────────────────────────────────────────────

  describe("AddressConfig 검증", () => {
    it("정상 address config로 생성된다", () => {
      expect(() => new MetaRegistry(inputWithAddress())).not.toThrow();
    });

    it("address 미설정 시에도 생성된다 (기본 colon 프로토콜)", () => {
      const reg = new MetaRegistry(baseInput());
      expect(reg.defaultProtocol).toBe("colon");
    });

    it("address 설정 시 기본 프로토콜이 layout으로 변경된다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      expect(reg.defaultProtocol).toBe("layout:uuid");
    });

    it("등록된 indexId가 schemas에 없으면 ValidationError", () => {
      const input = inputWithAddress();
      input.address.schemas = {}; // perm 누락
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });

    it("등록된 versionId가 versions에 없으면 ValidationError", () => {
      const input = inputWithAddress();
      input.address.versions = { iv1: 1 }; // iv2 누락
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });

    it("schemas 매핑 값이 음수이면 ValidationError", () => {
      const input = inputWithAddress();
      input.address.schemas = { perm: -1 };
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });

    it("versions 매핑 값이 소수이면 ValidationError", () => {
      const input = inputWithAddress();
      input.address.versions = { iv1: 1.5, iv2: 2 };
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });

    it("schemas 매핑 값이 중복이면 ValidationError", () => {
      const input = {
        dims: {
          role: {
            kind: { type: "string_enum" } as const,
            snapshots: { v1: { entries: ["admin"] } },
          },
        },
        indices: {
          idx_a: {
            dims: ["role"],
            versions: { v1: { snapshots: { role: "v1" } } },
          },
          idx_b: {
            dims: ["role"],
            versions: { v1: { snapshots: { role: "v1" } } },
          },
        },
        address: {
          format: PACK_FORMATS.uuid,
          schemaChars: 4,
          versionChars: 2,
          schemas: { idx_a: 1, idx_b: 1 }, // 중복
          versions: { v1: 1 },
        },
      };
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });

    it("versions 매핑 값이 중복이면 ValidationError", () => {
      const input = inputWithAddress();
      input.address.versions = { iv1: 1, iv2: 1 }; // 중복
      expect(() => new MetaRegistry(input)).toThrow(ValidationError);
    });
  });

  // ── serialize / parse (프로토콜 통합) ──────────────────────────────────────

  describe("serialize / parse (프로토콜 통합)", () => {
    it("serialize 기본 → layout:uuid 형식 (address 설정 시)", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      const pk = reg.serialize(vv);

      // UUID 형식 검증
      expect(pk).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("serialize → parse round-trip (layout:uuid)", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.encode("perm", "iv1", { role: "editor", action: "write", resource: 20 });
      const pk = reg.serialize(vv);
      const parsed = reg.parse(pk);

      expect(parsed).toEqual(vv);
    });

    it("serialize('colon') → 기존 colon 형식", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      const str = reg.serialize(vv, "colon");

      expect(str).toBe("perm:iv1:0");
    });

    it("serialize('uri') → URI 형식", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      const str = reg.serialize(vv, "uri");

      expect(str).toBe("wi://perm/iv1/0");
    });

    it("parse: colon 형식 자동 감지", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.parse("perm:iv1:0");
      expect(vv).toEqual({ indexId: "perm", versionId: "iv1", value: 0 });
    });

    it("parse: URI 형식 자동 감지", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.parse("wi://perm/iv1/0");
      expect(vv).toEqual({ indexId: "perm", versionId: "iv1", value: 0 });
    });

    it("parse: 미등록 indexId는 IndexNotFoundError", () => {
      const reg = new MetaRegistry(inputWithAddress());
      expect(() => reg.parse("unknown:iv1:0", "colon")).toThrow(IndexNotFoundError);
    });

    it("parse: 미등록 versionId는 IndexVersionNotFoundError", () => {
      const reg = new MetaRegistry(inputWithAddress());
      expect(() => reg.parse("perm:iv99:0", "colon")).toThrow(IndexVersionNotFoundError);
    });

    it("parse: value 범위 초과는 ParseError", () => {
      const reg = new MetaRegistry(inputWithAddress());
      // perm iv1: shape [3,3,3] → size=27
      expect(() => reg.parse("perm:iv1:27", "colon")).toThrow(ParseError);
    });

    it("parse: 잘못된 형식은 ParseError", () => {
      const reg = new MetaRegistry(inputWithAddress());
      expect(() => reg.parse("not-a-valid-input")).toThrow(ParseError);
    });

    it("address 미설정 시에도 text 프로토콜은 사용 가능", () => {
      const reg = new MetaRegistry(baseInput());
      const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });

      expect(reg.serialize(vv)).toBe("perm:iv1:0");
      expect(reg.serialize(vv, "uri")).toBe("wi://perm/iv1/0");
      expect(reg.serialize(vv, "compact")).toBe("perm-iv1-0");

      expect(reg.parse("perm:iv1:0")).toEqual(vv);
      expect(reg.parse("wi://perm/iv1/0")).toEqual(vv);
    });
  });

  // ── toPK / fromPK ────────────────────────────────────────────────────────

  describe("toPK / fromPK", () => {
    it("toPK → fromPK round-trip", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const entityIds = { role: "editor", action: "write", resource: 20 };
      const pk = reg.toPK("perm", "iv1", entityIds);
      const decoded = reg.fromPK(pk);

      expect(decoded).toEqual(entityIds);
    });

    it("toPK는 UUID 형식 문자열을 반환한다 (address 설정 시)", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const pk = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 });

      expect(pk).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("toPK: 명시적 프로토콜 사용", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const pk = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 }, "colon");

      expect(pk).toBe("perm:iv1:0");
    });

    it("fromPK: 다양한 프로토콜 자동 감지", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const entityIds = { role: "viewer", action: "delete", resource: 30 };

      // 동일 entity를 각 프로토콜로 인코딩
      const uuidPK = reg.toPK("perm", "iv1", entityIds);
      const colonPK = reg.toPK("perm", "iv1", entityIds, "colon");
      const uriPK = reg.toPK("perm", "iv1", entityIds, "uri");

      // 모두 동일한 entity로 디코딩
      expect(reg.fromPK(uuidPK)).toEqual(entityIds);
      expect(reg.fromPK(colonPK)).toEqual(entityIds);
      expect(reg.fromPK(uriPK)).toEqual(entityIds);
    });

    it("서로 다른 entity 조합은 서로 다른 PK를 생성한다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const pk1 = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      const pk2 = reg.toPK("perm", "iv1", { role: "editor", action: "write", resource: 20 });
      const pk3 = reg.toPK("perm", "iv1", { role: "viewer", action: "delete", resource: 30 });

      expect(new Set([pk1, pk2, pk3]).size).toBe(3);
    });

    it("다른 버전은 다른 PK를 생성한다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const entityIds = { role: "admin", action: "read", resource: 10 };
      const pk1 = reg.toPK("perm", "iv1", entityIds);
      const pk2 = reg.toPK("perm", "iv2", entityIds);

      expect(pk1).not.toBe(pk2); // version 필드가 다르므로 UUID도 다름
    });

    it("address 미설정 시 toPK는 colon 형식을 반환한다", () => {
      const reg = new MetaRegistry(baseInput());
      const pk = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      expect(pk).toBe("perm:iv1:0");
    });
  });

  // ── 크로스 프로토콜 변환 ────────────────────────────────────────────────────

  describe("크로스 프로토콜 변환", () => {
    it("UUID → colon → UUID round-trip", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const entityIds = { role: "editor", action: "write", resource: 20 };
      const uuidPK = reg.toPK("perm", "iv1", entityIds);

      // UUID → VersionedValue → colon
      const vv = reg.parse(uuidPK);
      const colonStr = reg.serialize(vv, "colon");

      // colon → VersionedValue → UUID
      const vv2 = reg.parse(colonStr);
      const uuidPK2 = reg.serialize(vv2);

      expect(uuidPK2).toBe(uuidPK);
      expect(vv).toEqual(vv2);
    });

    it("converter를 통한 직접 프로토콜 변환", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const conv = reg.converter;

      const uuidStr = conv.convert("perm:iv1:0", "layout:uuid");
      expect(uuidStr).toMatch(/^[0-9a-f]{8}-/);

      const colonStr = conv.convert(uuidStr, "colon");
      expect(colonStr).toBe("perm:iv1:0");

      const uriStr = conv.convert(uuidStr, "uri");
      expect(uriStr).toBe("wi://perm/iv1/0");
    });
  });

  // ── UUID 구조 검증 ────────────────────────────────────────────────────────

  describe("UUID 구조 검증", () => {
    it("UUID의 schema/version 필드가 올바른 위치에 인코딩된다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const vv = reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      const pk = reg.serialize(vv);

      // schema=1 → 4hex "0001", version=1 → 2hex "01"
      // UUID format: [8]-[4]-[4]-[4]-[12]
      // rawHex = "0001" + "01" + "000000000000000000000000000" (gap+index)
      // schema 4자리가 rawHex 앞 4자리, version 2자리가 5-6번째
      const rawHex = pk.replace(/-/g, "");
      expect(rawHex.slice(0, 4)).toBe("0001"); // schema = perm → 1
      expect(rawHex.slice(4, 6)).toBe("01");   // version = iv1 → 1
    });

    it("다른 버전은 version 필드만 달라진다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const entityIds = { role: "admin", action: "read", resource: 10 };
      const pk1 = reg.toPK("perm", "iv1", entityIds);
      const pk2 = reg.toPK("perm", "iv2", entityIds);

      const raw1 = pk1.replace(/-/g, "");
      const raw2 = pk2.replace(/-/g, "");

      expect(raw1.slice(0, 4)).toBe(raw2.slice(0, 4)); // schema 동일
      expect(raw1.slice(4, 6)).toBe("01"); // iv1 → 1
      expect(raw2.slice(4, 6)).toBe("02"); // iv2 → 2
    });

    it("index 필드가 right-aligned로 인코딩된다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      // perm:iv1, admin/read/10 → value=0
      const pk0 = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 });
      // perm:iv1, viewer/delete/30 → value=26
      const pk26 = reg.toPK("perm", "iv1", { role: "viewer", action: "delete", resource: 30 });

      const raw0 = pk0.replace(/-/g, "");
      const raw26 = pk26.replace(/-/g, "");

      // index는 오른쪽 정렬: 마지막 (32 - 4 - 2 = 26) hex chars
      expect(raw0.slice(6)).toBe("0".repeat(26));
      // value 26 = 0x1a → 오른쪽 끝 2자리가 "1a"
      expect(raw26.slice(-2)).toBe("1a");
      expect(raw26.slice(6, -2)).toBe("0".repeat(24)); // gap
    });
  });

  // ── 다중 인덱스 시나리오 ──────────────────────────────────────────────────

  describe("다중 인덱스 + address", () => {
    const multiIndexInput = () => ({
      dims: {
        role: {
          kind: { type: "string_enum" } as const,
          snapshots: { v1: { entries: ["admin", "editor"] } },
        },
        category: {
          kind: { type: "string_enum" } as const,
          snapshots: { v1: { entries: ["tech", "art"] } },
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
          versions: { v1: { snapshots: { category: "v1", lang: "v1" } } },
        },
      },
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1, content: 2 },
        versions: { v1: 1 },
      },
    });

    it("서로 다른 index의 UUID는 schema 필드가 다르다", () => {
      const reg = new MetaRegistry(multiIndexInput());
      const permPK = reg.toPK("perm", "v1", { role: "admin" });
      const contentPK = reg.toPK("content", "v1", { category: "tech", lang: "ko" });

      const permRaw = permPK.replace(/-/g, "");
      const contentRaw = contentPK.replace(/-/g, "");

      expect(permRaw.slice(0, 4)).toBe("0001"); // perm → 1
      expect(contentRaw.slice(0, 4)).toBe("0002"); // content → 2
    });

    it("서로 다른 index의 UUID도 fromPK로 올바르게 decode된다", () => {
      const reg = new MetaRegistry(multiIndexInput());
      const permPK = reg.toPK("perm", "v1", { role: "editor" });
      const contentPK = reg.toPK("content", "v1", { category: "art", lang: "en" });

      expect(reg.fromPK(permPK)).toEqual({ role: "editor" });
      expect(reg.fromPK(contentPK)).toEqual({ category: "art", lang: "en" });
    });
  });

  // ── toInput() round-trip ─────────────────────────────────────────────────

  describe("toInput() round-trip (address 설정)", () => {
    it("toInput()으로 복제한 레지스트리가 동일하게 동작한다", () => {
      const reg = new MetaRegistry(inputWithAddress());
      const reg2 = new MetaRegistry(reg.toInput());

      const entityIds = { role: "editor", action: "write", resource: 20 };
      expect(reg2.encode("perm", "iv1", entityIds)).toEqual(reg.encode("perm", "iv1", entityIds));
      expect(reg2.toPK("perm", "iv1", entityIds)).toBe(reg.toPK("perm", "iv1", entityIds));
      expect(reg2.defaultProtocol).toBe(reg.defaultProtocol);
    });

    it("toInput()에 address가 보존된다", () => {
      const input = inputWithAddress();
      const reg = new MetaRegistry(input);
      const out = reg.toInput();
      expect(out.address).toEqual(input.address);
    });
  });

  // ── int64 포맷 ──────────────────────────────────────────────────────────

  describe("int64 포맷", () => {
    const int64Input = () => ({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.int64,
        schemaChars: 2,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });

    it("int64 형식으로 직렬화된다 (dash 없는 16자리 hex)", () => {
      const reg = new MetaRegistry(int64Input());
      const pk = reg.toPK("perm", "iv1", { role: "admin", action: "read", resource: 10 });

      expect(pk).toMatch(/^[0-9a-f]{16}$/);
      expect(reg.defaultProtocol).toBe("layout:int64");
    });

    it("int64 toPK → fromPK round-trip", () => {
      const reg = new MetaRegistry(int64Input());
      const entityIds = { role: "viewer", action: "delete", resource: 30 };
      const pk = reg.toPK("perm", "iv1", entityIds);
      expect(reg.fromPK(pk)).toEqual(entityIds);
    });
  });
});

// ── toInput() / MetaRegistryDataset ─────────────────────────────────────────

describe("toInput() / MetaRegistryDataset", () => {
  it("address 없는 레지스트리를 toInput()으로 복제할 수 있다", () => {
    const reg = new MetaRegistry(baseInput());
    const reg2 = new MetaRegistry(reg.toInput());

    expect(reg2.dimIds.sort()).toEqual(reg.dimIds.slice().sort());
    expect(reg2.indexIds.sort()).toEqual(reg.indexIds.slice().sort());
    expect(reg2.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 })).toEqual(
      reg.encode("perm", "iv1", { role: "admin", action: "read", resource: 10 })
    );
    expect(reg2.toInput().address).toBeUndefined();
  });

  it("migrations가 보존된다", () => {
    const reg = new MetaRegistry({
      dims: {
        role: {
          kind: { type: "string_enum" } as const,
          snapshots: {
            v1: { entries: ["admin", "editor"] },
            v2: { entries: ["admin", "editor", "viewer"] },
          },
          migrations: [{ fromSnapshotId: "v1", toSnapshotId: "v2", indexMap: { 1: 1, 2: 2 } }],
        },
      },
      indices: {
        perm: {
          dims: ["role"],
          versions: {
            iv1: { snapshots: { role: "v1" } },
            iv2: { snapshots: { role: "v2" } },
          },
        },
      },
    });

    const reg2 = new MetaRegistry(reg.toInput());
    expect(reg2.traceMigration("role", "v1", "v2", 1)).toBe(1);
    expect(reg2.traceMigration("role", "v1", "v2", 2)).toBe(2);
  });

  it("entryFlags / entryRefs가 보존된다", () => {
    const reg = new MetaRegistry({
      dims: {
        action: {
          kind: { type: "string_enum" } as const,
          snapshots: {
            v1: {
              entries: ["read", "write", "delete"],
              entryFlags: { 3: { status: "inactive" as const, reason: "deprecated", updatedAt: "2026-01-01" } },
            },
          },
        },
      },
      indices: {
        perm: {
          dims: ["action"],
          versions: { v1: { snapshots: { action: "v1" } } },
        },
      },
    });

    const out = reg.toInput();
    const snap = out.dims.action.snapshots.v1;
    expect(snap.entryFlags?.[3]?.status).toBe("inactive");
    expect(snap.entryFlags?.[3]?.reason).toBe("deprecated");
  });

  it("plain object 입력으로 생성할 수 있다", () => {
    const reg = new MetaRegistry(baseInput());
    expect(reg.dimIds).toContain("role");
  });

  it("toInput() 반환값으로 확장된 레지스트리를 만들 수 있다 (fork 패턴)", () => {
    const base = new MetaRegistry(baseInput());
    const forked = new MetaRegistry({
      ...base.toInput(),
      dims: {
        ...base.toInput().dims,
        env: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["prod", "staging", "dev"] } },
        },
      },
      indices: {
        ...base.toInput().indices,
        permEnv: {
          dims: ["role", "action", "resource", "env"],
          versions: {
            ev1: { snapshots: { role: "v1", action: "v1", resource: "v1", env: "v1" } },
          },
        },
      },
    });

    expect(forked.dimIds).toContain("env");
    expect(forked.dimIds).toContain("role");
    expect(forked.indexIds).toContain("permEnv");
    expect(forked.indexIds).toContain("perm");
    expect(forked.encode("permEnv", "ev1", { role: "admin", action: "read", resource: 10, env: "prod" })).toBeDefined();
  });
});

// ── 다차원 데이터 순환 패턴 ──────────────────────────────────────────────────
//
// 구조:
//
//   item_class index (inner):  format(3) × sensitivity(3) = 9 slots
//     book/public=0   book/restricted=1   book/confidential=2
//     ebook/public=3  ebook/restricted=4  ebook/confidential=5
//     audio/public=6  audio/restricted=7  audio/confidential=8
//
//   content dim (index_ref → item_class):
//     pos 1 = entries[0] = 0  → (book, public)
//     pos 2 = entries[1] = 4  → (ebook, restricted)
//     pos 3 = entries[2] = 8  → (audio, confidential)
//
//   catalog index (outer): category(3) × content(3) = 9 slots
//     category: [fiction, science, history]
//     content:  index_ref — shape 3 (= entries.length)
//
//   audit_log index (downstream): format(3) × action(3) = 9 slots
//     format: [book, ebook, audio]
//     action: [view, download, share]
//
// 패턴 A: catalog decode → content 값(= item_class 식별자) → item_class decode
// 패턴 B: item_class decode에서 추출한 format + 새 action → audit_log encode

describe("다차원 데이터 순환 패턴", () => {
  const chainInput = () => ({
    dims: {
      format: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["book", "ebook", "audio"] } },
      },
      sensitivity: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["public", "restricted", "confidential"] } },
      },
      category: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["fiction", "science", "history"] } },
      },
      content: {
        // index_ref: 각 entry가 item_class의 VersionedValue.value
        kind: { type: "index_ref", indexId: "item_class" } as const,
        snapshots: {
          v1: { entries: [0, 4, 8] }, // book/public, ebook/restricted, audio/confidential
        },
      },
      action: {
        kind: { type: "string_enum" } as const,
        snapshots: { v1: { entries: ["view", "download", "share"] } },
      },
    },
    indices: {
      item_class: {
        dims: ["format", "sensitivity"],
        versions: { v1: { snapshots: { format: "v1", sensitivity: "v1" } } },
      },
      catalog: {
        dims: ["category", "content"],
        versions: { v1: { snapshots: { category: "v1", content: "v1" } } },
      },
      audit_log: {
        dims: ["format", "action"],
        versions: { v1: { snapshots: { format: "v1", action: "v1" } } },
      },
    },
  });

  // ── 사전 조건: item_class 인코딩 테이블 검증 ─────────────────────────────

  it("item_class 인코딩 테이블이 예상과 일치한다", () => {
    const reg = new MetaRegistry(chainInput());
    expect(reg.encode("item_class", "v1", { format: "book",  sensitivity: "public"       }).value).toBe(0);
    expect(reg.encode("item_class", "v1", { format: "ebook", sensitivity: "restricted"   }).value).toBe(4);
    expect(reg.encode("item_class", "v1", { format: "audio", sensitivity: "confidential" }).value).toBe(8);
  });

  it("content dim entries가 item_class 값과 1:1 대응한다", () => {
    const reg = new MetaRegistry(chainInput());
    const sn = reg.getDimSnapshot("content", "v1");
    // pos 1,2,3 → item_class 값 0,4,8
    expect(sn.entries).toEqual([0, 4, 8]);
  });

  // ── 패턴 A: 2-hop decode 체인 ────────────────────────────────────────────
  //
  // catalog.encode(science, content_pos2)
  //   → catalog value
  //   → catalog.decode → {category: "science", content: 4}
  //   → content=4 는 item_class value
  //   → item_class.decode(4) → {format: "ebook", sensitivity: "restricted"}

  it("[패턴 A] catalog decode → content 값 추출 → item_class decode", () => {
    const reg = new MetaRegistry(chainInput());

    // content pos 2 = entries[1] = 4 (ebook/restricted)
    const catalogVV = reg.encode("catalog", "v1", { category: "science", content: 4 });
    const catalogDecoded = reg.decode(catalogVV);

    expect(catalogDecoded.category).toBe("science");
    expect(catalogDecoded.content).toBe(4); // item_class value 그대로 보존

    // content 값으로 item_class를 직접 decode
    const itemClassVV = { indexId: "item_class", versionId: "v1", value: catalogDecoded.content as number };
    const itemDecoded = reg.decode(itemClassVV);

    expect(itemDecoded.format).toBe("ebook");
    expect(itemDecoded.sensitivity).toBe("restricted");
  });

  it("[패턴 A] 세 개 content 슬롯 모두 체인 decode가 일관성 있다", () => {
    const reg = new MetaRegistry(chainInput());

    const expectations = [
      { content: 0, category: "fiction",  format: "book",  sensitivity: "public"        },
      { content: 4, category: "science",  format: "ebook", sensitivity: "restricted"    },
      { content: 8, category: "history",  format: "audio", sensitivity: "confidential"  },
    ];

    for (const { content, category, format, sensitivity } of expectations) {
      const catalogVV = reg.encode("catalog", "v1", { category, content });
      const { content: extractedContent } = reg.decode(catalogVV);

      const itemVV = { indexId: "item_class", versionId: "v1", value: extractedContent as number };
      const itemDecoded = reg.decode(itemVV);

      expect(itemDecoded.format).toBe(format);
      expect(itemDecoded.sensitivity).toBe(sensitivity);
    }
  });

  // ── 패턴 B: decode 일부 추출 + 새 차원 결합 → 다른 index encode ──────────
  //
  // catalog decode → item_class decode → format 추출
  //   → format + action → audit_log.encode
  //   → audit_log.decode → 검증

  it("[패턴 B] catalog → item_class에서 format 추출 → audit_log encode", () => {
    const reg = new MetaRegistry(chainInput());

    // Step 1: catalog에서 시작
    const catalogVV = reg.encode("catalog", "v1", { category: "science", content: 4 });

    // Step 2: catalog decode → content(item_class value) 추출
    const { content: itemClassValue } = reg.decode(catalogVV);

    // Step 3: item_class decode → format, sensitivity 분리
    const itemVV = { indexId: "item_class", versionId: "v1", value: itemClassValue as number };
    const { format } = reg.decode(itemVV);

    // Step 4: 추출된 format + 새 action → audit_log encode
    const auditVV = reg.encode("audit_log", "v1", { format: format as string, action: "download" });

    // Step 5: audit_log decode → round-trip 검증
    const auditDecoded = reg.decode(auditVV);
    expect(auditDecoded.format).toBe("ebook");   // item_class에서 온 format
    expect(auditDecoded.action).toBe("download"); // 새로 결합한 action
  });

  it("[패턴 B] 파이프라인 전체: catalog value → audit_log value bijection", () => {
    const reg = new MetaRegistry(chainInput());

    // 세 가지 catalog 슬롯 × 세 가지 action = 9가지 경로
    const actions = ["view", "download", "share"] as const;
    const catalogSlots = [
      { category: "fiction",  content: 0 }, // book/public
      { category: "science",  content: 4 }, // ebook/restricted
      { category: "history",  content: 8 }, // audio/confidential
    ];
    const expectedFormats = ["book", "ebook", "audio"];

    const auditValues = new Set<number>();

    for (let i = 0; i < catalogSlots.length; i++) {
      const catalogVV = reg.encode("catalog", "v1", catalogSlots[i]);
      const { content: itemVal } = reg.decode(catalogVV);
      const { format } = reg.decode({ indexId: "item_class", versionId: "v1", value: itemVal as number });

      expect(format).toBe(expectedFormats[i]);

      for (const action of actions) {
        const auditVV = reg.encode("audit_log", "v1", { format: format as string, action });
        auditValues.add(auditVV.value);
      }
    }

    // 3 formats × 3 actions = 9개 고유 audit_log 값
    expect(auditValues.size).toBe(9);
  });

  // ── 체인 내 format 불변성 검증 ──────────────────────────────────────────
  //
  // catalog → item_class → audit_log 체인을 통과해도
  // format 값이 변하지 않아야 한다 (round-trip identity).

  it("체인 전체에서 format 값이 보존된다 (identity)", () => {
    const reg = new MetaRegistry(chainInput());

    // item_class에서 직접 encode한 format이 catalog 체인 경유 후에도 동일
    for (const [contentVal, expectedFormat] of [[0, "book"], [4, "ebook"], [8, "audio"]] as const) {
      // 직접 경로: item_class.decode
      const { format: directFormat } = reg.decode({ indexId: "item_class", versionId: "v1", value: contentVal });

      // 체인 경로: catalog → decode → item_class.decode
      const catalogVV = reg.encode("catalog", "v1", { category: "fiction", content: contentVal });
      const { content: extracted } = reg.decode(catalogVV);
      const { format: chainFormat } = reg.decode({ indexId: "item_class", versionId: "v1", value: extracted as number });

      expect(directFormat).toBe(expectedFormat);
      expect(chainFormat).toBe(directFormat); // 경로 무관하게 동일
    }
  });
});
