// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgDocumentRepository } from "./adapter.js";
import { SIM_DOC_PG_RESET_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgDocumentRepository — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let repo: PgDocumentRepository;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 5, onnotice: () => {},
    });
    await sql.unsafe(SIM_DOC_PG_RESET_DDL);
    repo = new PgDocumentRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_versions CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_comments CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_documents CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("createDocument + createVersion transaction (currentVersion 증가)", async () => {
    const d = await repo.createDocument({ projectId: "p", title: "S", ownerId: "u" });
    await repo.createVersion({ documentId: d.id, contentRef: "s3://k1", authorId: "u" });
    const updated = await repo.findDocument(d.id);
    expect(updated?.currentVersion).toBe(1);
  });

  it("listCommentsForDocument", async () => {
    await repo.createComment({ documentId: "d", authorId: "u", body: "hi" });
    expect((await repo.listCommentsForDocument("d")).length).toBe(1);
  });
});
