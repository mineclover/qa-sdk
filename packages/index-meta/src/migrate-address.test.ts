import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import { EntryNotFoundError } from "./errors.js";
import { migrateAddress, migrateValue, migrateBatch } from "./migrate-address.js";

// ── 픽스처 ──────────────────────────────────────────────────────────────────

const registryInput = () => ({
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
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: {
        v1: { snapshots: { role: "v1", action: "v1" } },
        v2: { snapshots: { role: "v2", action: "v1" } },
      },
    },
  },
});

// ── migrateAddress ──────────────────────────────────────────────────────────

describe("migrateAddress", () => {
  it("v1 주소를 v2로 마이그레이션한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v1addr = reg.serialize(v1.encode({ role: "editor", action: "write" }));

    const result = migrateAddress(reg, v1addr, "v2");

    expect(result.migrated).toBe(true);
    expect(result.vv.versionId).toBe("v2");

    // v2 codec으로 decode하면 동일 entity
    const v2 = reg.createCodec("perm", "v2");
    expect(v2.decode(result.vv)).toEqual({ role: "editor", action: "write" });
  });

  it("이미 최신 버전이면 migrated=false, 원본 반환", () => {
    const reg = new MetaRegistry(registryInput());
    const v2 = reg.createCodec("perm", "v2");
    const v2addr = reg.serialize(v2.encode({ role: "admin", action: "read" }));

    const result = migrateAddress(reg, v2addr, "v2");

    expect(result.migrated).toBe(false);
    expect(result.serialized).toBe(v2addr);
  });

  it("v2에 없는 entity가 있으면 에러", () => {
    const input = registryInput();
    // v2에서 role v2 snapshot에 "viewer"가 없도록 조작
    input.dims.role.snapshots.v2 = { entries: ["admin", "editor", "guest", "moderator"] };
    const reg = new MetaRegistry(input);

    const v1 = reg.createCodec("perm", "v1");
    const addr = reg.serialize(v1.encode({ role: "viewer", action: "read" }));

    expect(() => migrateAddress(reg, addr, "v2")).toThrow(EntryNotFoundError);
  });

  it("마이그레이션 후 entity ID가 보존된다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v2 = reg.createCodec("perm", "v2");

    const entities = { role: "viewer", action: "delete" };
    const v1addr = reg.serialize(v1.encode(entities));

    const result = migrateAddress(reg, v1addr, "v2");
    expect(v2.decode(result.vv)).toEqual(entities);
  });

  it("전체 v1 조합을 v2로 마이그레이션할 수 있다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v2 = reg.createCodec("perm", "v2");

    const roles = ["admin", "editor", "viewer"];
    const actions = ["read", "write", "delete"];

    for (const role of roles) {
      for (const action of actions) {
        const addr = reg.serialize(v1.encode({ role, action }));
        const result = migrateAddress(reg, addr, "v2");

        expect(result.migrated).toBe(true);
        expect(v2.decode(result.vv)).toEqual({ role, action });
      }
    }
  });
});

// ── migrateValue ────────────────────────────────────────────────────────────

describe("migrateValue", () => {
  it("VersionedValue 수준에서 마이그레이션한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const vv = v1.encode({ role: "editor", action: "read" });

    const result = migrateValue(reg, vv, "v2");

    expect(result.migrated).toBe(true);
    expect(result.vv.versionId).toBe("v2");

    const v2 = reg.createCodec("perm", "v2");
    expect(v2.decode(result.vv)).toEqual({ role: "editor", action: "read" });
  });

  it("이미 최신이면 migrated=false", () => {
    const reg = new MetaRegistry(registryInput());
    const v2 = reg.createCodec("perm", "v2");
    const vv = v2.encode({ role: "admin", action: "write" });

    const result = migrateValue(reg, vv, "v2");
    expect(result.migrated).toBe(false);
    expect(result.vv).toBe(vv);
  });
});

// ── migrateBatch ────────────────────────────────────────────────────────────

describe("migrateBatch", () => {
  it("여러 주소를 일괄 마이그레이션한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");

    const addresses = [
      reg.serialize(v1.encode({ role: "admin", action: "read" })),
      reg.serialize(v1.encode({ role: "editor", action: "write" })),
      reg.serialize(v1.encode({ role: "viewer", action: "delete" })),
    ];

    const results = migrateBatch(reg, addresses, "v2");

    expect(results).toHaveLength(3);
    expect(results.every(r => r.migrated)).toBe(true);
    expect(results.every(r => r.vv.versionId === "v2")).toBe(true);
  });

  it("혼재된 버전에서 v1만 마이그레이션한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v2 = reg.createCodec("perm", "v2");

    const addresses = [
      reg.serialize(v1.encode({ role: "admin", action: "read" })),   // v1 → 마이그레이션
      reg.serialize(v2.encode({ role: "guest", action: "write" })),   // v2 → skip
      reg.serialize(v1.encode({ role: "viewer", action: "delete" })), // v1 → 마이그레이션
    ];

    const results = migrateBatch(reg, addresses, "v2");

    expect(results[0].migrated).toBe(true);
    expect(results[1].migrated).toBe(false);
    expect(results[2].migrated).toBe(true);
  });

  it("original 필드에 원본 주소가 보존된다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const addr = reg.serialize(v1.encode({ role: "admin", action: "read" }));

    const results = migrateBatch(reg, [addr], "v2");

    expect(results[0].original).toBe(addr);
    expect(results[0].serialized).not.toBe(addr); // v2로 변환됨
  });
});
