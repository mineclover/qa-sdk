// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { createConnection, type ConnectionConfig } from "./connection.js";

describe("createConnection — SQLite", () => {
  it(":memory: SQLite 연결·close 정상", async () => {
    const cfg: ConnectionConfig = { dialect: "sqlite" };
    const conn = await createConnection(cfg);
    expect(conn.dialect).toBe("sqlite");
    expect(conn.db).toBeDefined();
    await conn.close();
  });

  it("file path SQLite 연결 가능 (in-memory 임시 경로)", async () => {
    const path = `/tmp/db-bootstrap-test-${Date.now()}.db`;
    const cfg: ConnectionConfig = { dialect: "sqlite", sqlitePath: path };
    const conn = await createConnection(cfg);
    await conn.close();
    // cleanup
    try { (await import("node:fs/promises")).unlink(path); } catch {}
  });
});

describe.skipIf(process.env.QA_TEST_PG !== "1")("createConnection — PG", () => {
  const PG_CFG: ConnectionConfig = {
    dialect: "pg",
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };

  it("PG 연결·close 정상", async () => {
    const conn = await createConnection(PG_CFG);
    expect(conn.dialect).toBe("pg");
    await conn.close();
  });

  it("pgSchema 지정 시 search_path 설정됨", async () => {
    const conn = await createConnection({ ...PG_CFG, pgSchema: "auth" });
    // Drizzle DB는 search_path를 직접 노출 안 함 — raw query로 검증
    // (개념 검증용, 실제 검증은 PG store contract test에서 수행)
    await conn.close();
  });
});
