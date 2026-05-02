// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DocumentEntity } from "../../domain/index.js";
import {
  SqliteDocumentRepository,
  createDocumentSliceRepository,
} from "./document.repository.js";
import { SIM_DOC_DOCUMENT_SQLITE_DDL } from "./sqlite.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import type { DocumentTransactionScope } from "../../application/ports/document-transaction.port.js";

function makeScope(): DocumentTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_DOC_DOCUMENT_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  return { sqlite, db, repo: new SqliteDocumentRepository(db) };
}

describe("SqliteDocumentRepository", () => {
  it("save 후 findById 가 entity 를 라운드트립", async () => {
    const { sqlite, repo } = bootstrap();
    const entity = DocumentEntity.create({
      id: "doc_1",
      projectId: "prj_1",
      title: "Spec",
      ownerId: "usr_1",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(entity, makeScope());
    const found = await repo.findById("doc_1");
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());
    sqlite.close();
  });

  it("listByProject — projectId 별 필터링", async () => {
    const { sqlite, repo } = bootstrap();
    await repo.save(
      DocumentEntity.create({ id: "doc_a", projectId: "p1", title: "A", ownerId: "u" }),
      makeScope(),
    );
    await repo.save(
      DocumentEntity.create({ id: "doc_b", projectId: "p1", title: "B", ownerId: "u" }),
      makeScope(),
    );
    await repo.save(
      DocumentEntity.create({ id: "doc_c", projectId: "p2", title: "C", ownerId: "u" }),
      makeScope(),
    );
    expect((await repo.listByProject("p1")).length).toBe(2);
    sqlite.close();
  });

  it("delete 후 findById 는 null", async () => {
    const { sqlite, repo } = bootstrap();
    const entity = DocumentEntity.create({
      id: "doc_d",
      projectId: "p",
      title: "T",
      ownerId: "u",
    });
    await repo.save(entity, makeScope());
    await repo.delete("doc_d", makeScope());
    expect(await repo.findById("doc_d")).toBeNull();
    sqlite.close();
  });

  it("upsert: 동일 id save 시 update", async () => {
    const { sqlite, repo } = bootstrap();
    const e1 = DocumentEntity.create({
      id: "doc_2",
      projectId: "p",
      title: "T1",
      ownerId: "u",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e1, makeScope());
    const e2 = e1.update({ title: "T2" }, new Date("2026-01-02T00:00:00.000Z"));
    await repo.save(e2, makeScope());
    const found = await repo.findById("doc_2");
    expect(found!.title).toBe("T2");
    sqlite.close();
  });
});

describe("PgDocumentRepository (column mapping symmetry)", () => {
  it("sqlite/pg 둘 다 동일 컬럼셋(JS 필드) 사용", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.documents);
    const pgCols = Object.keys(pgSchemaModule.documents);
    const expected = new Set([
      "id",
      "projectId",
      "title",
      "currentVersion",
      "ownerId",
      "createdAt",
      "updatedAt",
    ]);
    for (const c of expected) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createDocumentSliceRepository factory", () => {
  it("sqlite dialect → SqliteDocumentRepository", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_DOC_DOCUMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createDocumentSliceRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteDocumentRepository);
    sqlite.close();
  });

  it("알 수 없는 dialect 는 예외", () => {
    expect(() =>
      createDocumentSliceRepository({ dialect: "mysql" as never, db: {} as never }),
    ).toThrow();
  });
});
