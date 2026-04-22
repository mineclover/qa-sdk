// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createDocumentRepository, type DocumentRepoDialect } from "./factory.js";
import { SIM_DOC_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_DOC_PG_RESET_DDL } from "./pg/schema.js";
import type { DocumentRepository } from "./shared/port.js";

interface FixtureRunner {
  setup(): Promise<{ repo: DocumentRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(":memory:");
    raw.exec(SIM_DOC_SQLITE_DDL);
    const repo = await createDocumentRepository({
      dialect: "sqlite", db: drizzleSqlite({ client: raw }),
    });
    return { repo, cleanup: async () => { raw.close(); } };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    user: process.env.QA_TEST_PG_USER ?? "qa_admin",
    password: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      const sql = postgres({
        host: PG_CFG.host, port: PG_CFG.port, database: PG_CFG.database,
        user: PG_CFG.user, password: PG_CFG.password, max: 5, onnotice: () => {},
      });
      await sql.unsafe(SIM_DOC_PG_RESET_DDL);
      const repo = await createDocumentRepository({ dialect: "pg", db: drizzlePg({ client: sql }) });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_versions CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_comments CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.doc_documents CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const matrix: Array<[DocumentRepoDialect, FixtureRunner]> = [
  ["sqlite", sqliteRunner],
  ...(PG_AVAILABLE ? ([["pg", makePgRunner()]] as Array<[DocumentRepoDialect, FixtureRunner]>) : []),
];

describe.each(matrix)("DocumentRepository contract — %s", (dialect, runner) => {
  let repo: DocumentRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`createDocument + findDocument — ${dialect}`, async () => {
    const d = await repo.createDocument({ projectId: `p-${dialect}`, title: "S", ownerId: "u" });
    expect((await repo.findDocument(d.id))?.title).toBe("S");
  });

  it(`createVersion increments currentVersion — ${dialect}`, async () => {
    const d = await repo.createDocument({ projectId: `pv-${dialect}`, title: "S", ownerId: "u" });
    await repo.createVersion({ documentId: d.id, contentRef: "k1", authorId: "u" });
    await repo.createVersion({ documentId: d.id, contentRef: "k2", authorId: "u" });
    const updated = await repo.findDocument(d.id);
    expect(updated?.currentVersion).toBe(2);
  });

  it(`createComment threaded — ${dialect}`, async () => {
    const parent = await repo.createComment({ documentId: `d-${dialect}`, authorId: "u", body: "p" });
    await repo.createComment({
      documentId: `d-${dialect}`, authorId: "u", body: "r", parentCommentId: parent.id,
    });
    expect((await repo.listReplies(parent.id)).length).toBe(1);
  });

  it(`listCommentsForDocument — ${dialect}`, async () => {
    await repo.createComment({ documentId: `lc-${dialect}`, authorId: "u", body: "a" });
    await repo.createComment({ documentId: `lc-${dialect}`, authorId: "u", body: "b" });
    expect((await repo.listCommentsForDocument(`lc-${dialect}`)).length).toBe(2);
  });
});
