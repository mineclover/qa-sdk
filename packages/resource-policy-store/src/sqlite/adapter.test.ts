// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DuplicatePolicyError,
  InvalidTransitionError,
  PolicyNotFoundError,
} from "permission-engine";

import { SqliteResourcePolicyRegistry } from "./adapter.js";
import { RESOURCE_POLICIES_DDL } from "./schema.js";

const NOW = "2026-04-22T10:00:00Z";
const LATER = "2026-04-22T11:00:00Z";

describe("SqliteResourcePolicyRegistry — permission-engine 인터페이스 충족", () => {
  let db: BetterSQLite3Database;
  let registry: SqliteResourcePolicyRegistry;

  beforeEach(() => {
    const raw = new Database(":memory:");
    raw.exec(RESOURCE_POLICIES_DDL);
    db = drizzle({ client: raw });
    registry = new SqliteResourcePolicyRegistry(db);
  });

  it("create + resolve", async () => {
    await registry.create({
      resourceId: "d-1", resourceType: "doc", ownerId: "u-1", now: NOW,
    });
    const p = await registry.resolve("d-1");
    expect(p?.state).toBe("UNREGISTERED");
    expect(p?.ownerId).toBe("u-1");
  });

  it("중복 create → DuplicatePolicyError", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
    await expect(
      registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u2", now: NOW }),
    ).rejects.toThrow(DuplicatePolicyError);
  });

  it("UNREGISTERED → REGISTERED 정상 전이 + DB 영속", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.register("d", { cerbosPolicyRef: "policy-v1", now: LATER });
    const p = await registry.resolve("d");
    expect(p?.state).toBe("REGISTERED");
    expect(p?.cerbosPolicyRef).toBe("policy-v1");
    expect(p?.registeredAt).toBe(LATER);
  });

  it("REGISTERED → DELEGATED — cerbosPolicyRef 유지", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.register("d", { cerbosPolicyRef: "p", now: NOW });
    await registry.delegate("d", { graphRootId: "root-1", now: LATER });
    const p = await registry.resolve("d");
    expect(p?.state).toBe("DELEGATED");
    expect(p?.graphRootId).toBe("root-1");
    expect(p?.cerbosPolicyRef).toBe("p");
  });

  it("역전이 금지 — REGISTERED에서 register 재호출 → InvalidTransitionError", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.register("d", { cerbosPolicyRef: "p1", now: NOW });
    await expect(
      registry.register("d", { cerbosPolicyRef: "p2", now: LATER }),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("listByOwner — 소유자별 필터링", async () => {
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u-1", now: NOW });
    await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u-1", now: NOW });
    await registry.create({ resourceId: "d3", resourceType: "doc", ownerId: "u-2", now: NOW });
    const mine = await registry.listByOwner("u-1");
    expect(mine).toHaveLength(2);
  });

  it("listByState — 상태별 필터링", async () => {
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.register("d2", { cerbosPolicyRef: "p", now: NOW });
    const unreg = await registry.listByState("UNREGISTERED");
    const reg = await registry.listByState("REGISTERED");
    expect(unreg).toHaveLength(1);
    expect(reg).toHaveLength(1);
    expect(reg[0].resourceId).toBe("d2");
  });

  it("remove — DB row 삭제", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
    await registry.remove("d");
    expect(await registry.resolve("d")).toBeNull();
  });

  it("없는 리소스 register → PolicyNotFoundError", async () => {
    await expect(
      registry.register("missing", { cerbosPolicyRef: "p", now: NOW }),
    ).rejects.toThrow(PolicyNotFoundError);
  });
});
