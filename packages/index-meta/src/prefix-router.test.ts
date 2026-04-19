// @def.boundary index-meta-system
// @def.doc index-meta-system

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPrefixRouter } from "./adapters/memory-prefix-router.js";
import { NodeSqliteDriver } from "./adapters/node-sqlite-driver.js";
import { SqlPrefixRouter } from "./adapters/sql-prefix-router.js";
import type { PrefixRouter } from "./prefix-router.js";

function prefixRouterSuite(name: string, factory: () => PrefixRouter) {
  describe(name, () => {
    let router: PrefixRouter;

    beforeEach(() => {
      router = factory();
    });

    it("미등록 prefix는 null", async () => {
      expect(await router.getDatabase("missing")).toBeNull();
      expect(await router.listPrefixes("db-a")).toEqual([]);
    });

    it("route 후 getDatabase로 조회한다", async () => {
      await router.route("role", "db-a");
      await router.route("action", "db-b");

      expect(await router.getDatabase("role")).toBe("db-a");
      expect(await router.getDatabase("action")).toBe("db-b");
    });

    it("동일 prefix 재라우팅 시 최신 database로 덮어쓴다", async () => {
      await router.route("role", "db-a");
      await router.route("role", "db-b");

      expect(await router.getDatabase("role")).toBe("db-b");
      expect(await router.listPrefixes("db-a")).toEqual([]);
      expect(await router.listPrefixes("db-b")).toEqual(["role"]);
    });

    it("listPrefixes는 같은 database의 prefix만 반환한다", async () => {
      await router.route("role", "db-a");
      await router.route("action", "db-a");
      await router.route("content", "db-b");

      expect((await router.listPrefixes("db-a")).toSorted()).toEqual(["action", "role"]);
      expect(await router.listPrefixes("db-b")).toEqual(["content"]);
    });

    it("여러 prefix가 같은 database를 공유해도 조회가 분리된다", async () => {
      await router.route("role", "db-a");
      await router.route("action", "db-a");
      await router.route("content", "db-b");
      await router.route("audit", "db-a");

      expect((await router.listPrefixes("db-a")).toSorted()).toEqual(["action", "audit", "role"]);
      expect(await router.getDatabase("content")).toBe("db-b");
    });
  });
}

prefixRouterSuite("InMemoryPrefixRouter", () => {
  return new InMemoryPrefixRouter();
});

prefixRouterSuite("SqlPrefixRouter", () => {
  const driver = new NodeSqliteDriver();
  return new SqlPrefixRouter(driver);
});
