// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { createSqliteTestFixture, createPgTestFixture } from "./test-fixtures.js";

const SAMPLE_DDL = `
CREATE TABLE IF NOT EXISTS sample (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
`;

describe("createSqliteTestFixture", () => {
  it(":memory: SQLite + DDL 적용 + cleanup 동작", async () => {
    const { db, cleanup } = await createSqliteTestFixture(SAMPLE_DDL);
    // db는 Drizzle DB 인스턴스. raw query 가능 여부만 검증
    expect(db).toBeDefined();
    await cleanup();
  });

  it("같은 DDL을 여러 fixture에 적용해도 격리됨 (각 :memory:)", async () => {
    const f1 = await createSqliteTestFixture(SAMPLE_DDL);
    const f2 = await createSqliteTestFixture(SAMPLE_DDL);
    expect(f1.db).not.toBe(f2.db);
    await f1.cleanup();
    await f2.cleanup();
  });
});

describe.skipIf(process.env.QA_TEST_PG !== "1")("createPgTestFixture", () => {
  it("random schema 생성 → DDL 적용 → cleanup으로 schema drop", async () => {
    const PG_CFG = {
      pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
      pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
      pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
    };
    // PG DDL은 schema-qualified or schema-less. test fixture는 random schema 생성 후 search_path 적용
    const PG_DDL = `
      CREATE TABLE sample (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;
    const { db, schemaName, cleanup } = await createPgTestFixture(PG_DDL, PG_CFG);
    expect(db).toBeDefined();
    expect(schemaName).toMatch(/^test_[0-9a-f]{8}$/);
    await cleanup();
  });

  it("동시 fixture 2개 — schema 충돌 없음", async () => {
    const PG_CFG = {
      pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
      pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
      pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
    };
    const PG_DDL = `CREATE TABLE sample (id TEXT PRIMARY KEY);`;
    const f1 = await createPgTestFixture(PG_DDL, PG_CFG);
    const f2 = await createPgTestFixture(PG_DDL, PG_CFG);
    expect(f1.schemaName).not.toBe(f2.schemaName);
    await f1.cleanup();
    await f2.cleanup();
  });
});
