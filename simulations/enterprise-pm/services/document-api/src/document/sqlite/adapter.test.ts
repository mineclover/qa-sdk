import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteDocumentRepository } from "./adapter.js";
import { SIM_DOC_SQLITE_DDL } from "./schema.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_DOC_SQLITE_DDL);
  return {
    repo: new SqliteDocumentRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe("SqliteDocumentRepository", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.close());

  it("createDocument round-trip", async () => {
    const d = await f.repo.createDocument({ projectId: "p", title: "Spec", ownerId: "u" });
    expect((await f.repo.findDocument(d.id))?.title).toBe("Spec");
  });

  it("listDocumentsByProject", async () => {
    await f.repo.createDocument({ projectId: "p-1", title: "A", ownerId: "u" });
    await f.repo.createDocument({ projectId: "p-1", title: "B", ownerId: "u" });
    await f.repo.createDocument({ projectId: "p-2", title: "C", ownerId: "u" });
    expect((await f.repo.listDocumentsByProject("p-1")).length).toBe(2);
  });

  it("createVersion (1) → currentVersion=1", async () => {
    const d = await f.repo.createDocument({ projectId: "p", title: "S", ownerId: "u" });
    await f.repo.createVersion({ documentId: d.id, contentRef: "s3://k1", authorId: "u" });
    const updated = await f.repo.findDocument(d.id);
    expect(updated?.currentVersion).toBe(1);
  });

  it("createVersion (2) → currentVersion=2 + listVersions 2건", async () => {
    const d = await f.repo.createDocument({ projectId: "p", title: "S", ownerId: "u" });
    await f.repo.createVersion({ documentId: d.id, contentRef: "s3://k1", authorId: "u" });
    await f.repo.createVersion({ documentId: d.id, contentRef: "s3://k2", authorId: "u" });
    const updated = await f.repo.findDocument(d.id);
    expect(updated?.currentVersion).toBe(2);
    expect((await f.repo.listVersions(d.id)).length).toBe(2);
  });

  it("createComment (top-level)", async () => {
    const c = await f.repo.createComment({ documentId: "d", authorId: "u", body: "hi" });
    expect(c.parentCommentId).toBeNull();
  });

  it("createComment with parentCommentId → listReplies", async () => {
    const parent = await f.repo.createComment({ documentId: "d", authorId: "u", body: "parent" });
    await f.repo.createComment({
      documentId: "d", authorId: "u", body: "reply", parentCommentId: parent.id,
    });
    expect((await f.repo.listReplies(parent.id)).length).toBe(1);
  });

  it("listCommentsForDocument", async () => {
    await f.repo.createComment({ documentId: "d1", authorId: "u", body: "a" });
    await f.repo.createComment({ documentId: "d1", authorId: "u", body: "b" });
    await f.repo.createComment({ documentId: "d2", authorId: "u", body: "c" });
    expect((await f.repo.listCommentsForDocument("d1")).length).toBe(2);
  });

  it("deleteComment", async () => {
    const c = await f.repo.createComment({ documentId: "d", authorId: "u", body: "x" });
    await f.repo.deleteComment(c.id);
    expect(await f.repo.findComment(c.id)).toBeNull();
  });
});
