// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { CommentEntity } from "./comment.entity.js";
import {
  InvalidCommentIdException,
  InvalidCommentBodyException,
} from "./comment.exceptions.js";

describe("CommentEntity", () => {
  const baseInput = {
    id: "cmt_001",
    documentId: "doc_001",
    authorId: "usr_001",
    body: "This is a comment.",
    now: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("create() top-level (parentCommentId=null)", () => {
    const c = CommentEntity.create(baseInput);
    expect(c.parentCommentId).toBeNull();
    expect(c.documentId).toBe("doc_001");
  });

  it("create() reply with parentCommentId", () => {
    const c = CommentEntity.create({ ...baseInput, parentCommentId: "cmt_parent" });
    expect(c.parentCommentId).toBe("cmt_parent");
  });

  it("create() — 빈 id → InvalidCommentIdException", () => {
    expect(() => CommentEntity.create({ ...baseInput, id: "  " })).toThrow(
      InvalidCommentIdException,
    );
  });

  it("create() — 빈 body → InvalidCommentBodyException", () => {
    expect(() => CommentEntity.create({ ...baseInput, body: "" })).toThrow(
      InvalidCommentBodyException,
    );
  });

  it("toSnapshot/rehydrate 라운드트립", () => {
    const c = CommentEntity.create(baseInput);
    const s = c.toSnapshot();
    expect(CommentEntity.rehydrate(s).toSnapshot()).toEqual(s);
  });

  it("InvalidCommentIdException name='ValidationError'", () => {
    const err = new InvalidCommentIdException();
    expect(err.name).toBe("ValidationError");
  });
});
