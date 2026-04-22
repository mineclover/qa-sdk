// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { describe, expect, it } from "vitest";

import { createResourcePolicyRegistry } from "./factory.js";
import { createSqliteTestFixture } from "db-bootstrap";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

describe("createResourcePolicyRegistry — dialect 분기", () => {
  it("dialect=sqlite → SqliteResourcePolicyRegistry 인스턴스", async () => {
    const { db, cleanup } = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    try {
      const registry = await createResourcePolicyRegistry({ dialect: "sqlite", db: db as never });
      expect(registry.constructor.name).toBe("SqliteResourcePolicyRegistry");
      // smoke — 인터페이스 메서드 호출 가능
      const result = await registry.resolve("nonexistent");
      expect(result).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("dialect=sqlite로 create + resolve 라운드트립", async () => {
    const { db, cleanup } = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    try {
      const registry = await createResourcePolicyRegistry({ dialect: "sqlite", db: db as never });
      await registry.create({ resourceId: "r1", resourceType: "doc", ownerId: "u1" });
      const got = await registry.resolve("r1");
      expect(got?.state).toBe("UNREGISTERED");
      expect(got?.ownerId).toBe("u1");
    } finally {
      await cleanup();
    }
  });

  it("잘못된 dialect → 에러 throw", async () => {
    await expect(
      // @ts-expect-error — invalid dialect 의도적 주입
      createResourcePolicyRegistry({ dialect: "mongo", db: {} }),
    ).rejects.toThrow(/dialect/i);
  });
});
