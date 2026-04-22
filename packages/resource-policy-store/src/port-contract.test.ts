// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * Port-contract test — SQLite + PG 어댑터에 동일 시나리오 적용.
 *
 * 본 파일에 들어오는 시나리오는 dialect-agnostic이어야 한다.
 * dialect-specific edge(WAL mode, RLS, search_path 등)는
 *   - sqlite/adapter.test.ts
 *   - pg/adapter.test.ts
 * 의 책임. 본 파일은 두 어댑터가 같은 인터페이스 계약을 만족하는지만 검증.
 *
 * PG는 env gate — QA_TEST_PG=1 이면 활성화, 아니면 SQLite만 검증.
 *
 * Deviation from Plan: drizzle pgSchema("auth")는 schema 이름을 하드코딩하므로
 * db-bootstrap의 createPgTestFixture가 제공하는 random schema 격리를 사용할 수 없다.
 * PG 분기는 auth.resource_policies 테이블을 매 테스트마다 drop/create로 격리.
 * 파일 단위 병렬 실행은 vitest.config.ts의 fileParallelism: false로 차단.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createSqliteTestFixture,
  type SqliteFixture,
} from "db-bootstrap";

import {
  createResourcePolicyRegistry,
  type ResourcePolicyDialect,
} from "./factory.js";
import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicyRegistry,
} from "./port.js";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

// ── Fixture 추상화 ────────────────────────────────────────────────────────────

interface FixtureRunner {
  /** 새 격리 fixture를 만들고 factory로 어댑터를 인스턴스화 */
  setup(): Promise<{ registry: ResourcePolicyRegistry; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const fixture: SqliteFixture = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    const registry = await createResourcePolicyRegistry({
      dialect: "sqlite",
      db: fixture.db as never,
    });
    return { registry, cleanup: fixture.cleanup };
  },
};

/**
 * PG runner — drizzle pgSchema("auth")가 강제하는 schema 이름 제약 때문에
 * random schema 격리 대신 auth.resource_policies 테이블을 drop/recreate로 격리.
 *
 * 파일 단위 병렬 실행이 차단된 환경에서만 안전 (vitest.config.ts fileParallelism: false).
 */
const RESET_AUTH_TABLE_DDL = `
DROP TABLE IF EXISTS auth.resource_policies CASCADE;

CREATE TABLE auth.resource_policies (
  resource_id       TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  state             VARCHAR(16) NOT NULL CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id          TEXT NOT NULL,
  cerbos_policy_ref TEXT,
  graph_root_id     TEXT,
  registered_at     TEXT,
  delegated_at      TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_rp_owner_pg ON auth.resource_policies(owner_id);
CREATE INDEX idx_rp_state_pg ON auth.resource_policies(state);
CREATE INDEX idx_rp_type_pg ON auth.resource_policies(resource_type);

ALTER TABLE auth.resource_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_temp_allow_all ON auth.resource_policies
  USING (true)
  WITH CHECK (true);
`;

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      const postgres = (await import("postgres")).default;
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const sql = postgres({
        host: PG_CFG.pgHost,
        port: PG_CFG.pgPort,
        database: PG_CFG.pgDatabase,
        user: PG_CFG.pgUser,
        password: PG_CFG.pgPassword,
        max: 5,
        onnotice: () => {},
      });
      await sql.unsafe(RESET_AUTH_TABLE_DDL);
      const db = drizzle({ client: sql });
      const registry = await createResourcePolicyRegistry({
        dialect: "pg",
        db: db as never,
      });
      return {
        registry,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS auth.resource_policies CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

// ── 매트릭스 ─────────────────────────────────────────────────────────────────

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const matrix: Array<[ResourcePolicyDialect, FixtureRunner]> = [
  ["sqlite", sqliteRunner],
  ...(PG_AVAILABLE
    ? ([["pg", makePgRunner()]] as Array<[ResourcePolicyDialect, FixtureRunner]>)
    : []),
];

describe.each(matrix)(
  "ResourcePolicyRegistry contract — %s",
  (_dialect, runner) => {
    let registry: ResourcePolicyRegistry;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      const ctx = await runner.setup();
      registry = ctx.registry;
      cleanup = ctx.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    it("1. resolve(미존재) → null", async () => {
      const got = await registry.resolve("missing");
      expect(got).toBeNull();
    });

    it("2. create 후 resolve → UNREGISTERED 상태로 복원", async () => {
      await registry.create({
        resourceId: "doc-1",
        resourceType: "document",
        ownerId: "user-A",
      });
      const got = await registry.resolve("doc-1");
      expect(got?.state).toBe("UNREGISTERED");
      expect(got?.resourceType).toBe("document");
      expect(got?.ownerId).toBe("user-A");
      expect(got?.cerbosPolicyRef).toBeUndefined();
      expect(got?.graphRootId).toBeUndefined();
    });

    it("3. create 중복 → DuplicatePolicyError", async () => {
      await registry.create({
        resourceId: "doc-2",
        resourceType: "document",
        ownerId: "user-A",
      });
      await expect(
        registry.create({
          resourceId: "doc-2",
          resourceType: "document",
          ownerId: "user-B",
        }),
      ).rejects.toBeInstanceOf(DuplicatePolicyError);
    });

    it("4. UNREGISTERED → REGISTERED 전이", async () => {
      await registry.create({
        resourceId: "doc-3",
        resourceType: "document",
        ownerId: "user-A",
      });
      const next = await registry.register("doc-3", {
        cerbosPolicyRef: "cerbos:doc-shared-v1",
      });
      expect(next.state).toBe("REGISTERED");
      expect(next.cerbosPolicyRef).toBe("cerbos:doc-shared-v1");
      expect(next.registeredAt).toBeDefined();

      const persisted = await registry.resolve("doc-3");
      expect(persisted?.state).toBe("REGISTERED");
      expect(persisted?.cerbosPolicyRef).toBe("cerbos:doc-shared-v1");
    });

    it("5. REGISTERED → DELEGATED 전이", async () => {
      await registry.create({
        resourceId: "doc-4",
        resourceType: "document",
        ownerId: "user-A",
      });
      await registry.register("doc-4", {
        cerbosPolicyRef: "cerbos:doc-shared-v1",
      });
      const next = await registry.delegate("doc-4", {
        graphRootId: "graph-root-9",
      });
      expect(next.state).toBe("DELEGATED");
      expect(next.graphRootId).toBe("graph-root-9");
      expect(next.delegatedAt).toBeDefined();

      const persisted = await registry.resolve("doc-4");
      expect(persisted?.state).toBe("DELEGATED");
    });

    it("6. 미존재 리소스에 register/delegate → PolicyNotFoundError", async () => {
      await expect(
        registry.register("ghost", { cerbosPolicyRef: "x" }),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
      await expect(
        registry.delegate("ghost", { graphRootId: "g" }),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
    });

    it("7. listByOwner — 같은 owner의 리소스만 반환", async () => {
      await registry.create({ resourceId: "a1", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "a2", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "b1", resourceType: "doc", ownerId: "V" });
      const owned = await registry.listByOwner("U");
      const ids = owned.map((p) => p.resourceId).sort();
      expect(ids).toEqual(["a1", "a2"]);
    });

    it("8. listByState + remove — 상태 전이 후 카운트 변화 + 삭제 invariant", async () => {
      await registry.create({ resourceId: "s1", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "s2", resourceType: "doc", ownerId: "U" });
      await registry.register("s2", { cerbosPolicyRef: "p" });

      const unreg = await registry.listByState("UNREGISTERED");
      const reg = await registry.listByState("REGISTERED");
      expect(unreg.map((p) => p.resourceId)).toEqual(["s1"]);
      expect(reg.map((p) => p.resourceId)).toEqual(["s2"]);

      await registry.remove("s1");
      const afterRemove = await registry.resolve("s1");
      expect(afterRemove).toBeNull();

      // 다른 리소스는 영향 없음
      const stillRegistered = await registry.resolve("s2");
      expect(stillRegistered?.state).toBe("REGISTERED");
    });
  },
);
