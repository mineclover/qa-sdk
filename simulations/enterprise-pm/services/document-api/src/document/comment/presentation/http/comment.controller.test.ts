// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { CommentController } from "./comment.controller.js";
import { CommentUseCase } from "../../application/use-cases/comment.use-case.js";
import { CommentReadModelQuery } from "../../application/queries/comment-read-model.query.js";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<CommentUseCase>;
  readModel: Partial<CommentReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [CommentController],
    providers: [
      { provide: CommentUseCase, useValue: useCase },
      { provide: CommentReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(CommentController);
}

describe("CommentController", () => {
  it("POST /comments — CREATED", async () => {
    const useCase = {
      create: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "CREATED" as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.create({
      documentId: "doc_1",
      authorId: "u",
      body: "hi",
    });
    expect(res.status).toBe("CREATED");
  });

  it("POST 입력 검증 실패", async () => {
    const controller = await build({ useCase: { create: vi.fn() }, readModel: {} });
    await expect(controller.create({ documentId: "", authorId: "u", body: "x" })).rejects.toThrow();
  });

  it("GET /comments/:id 미존재 → NotFoundError", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get("missing")).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("GET /documents/:docId/comments — 리스트", async () => {
    const items = [
      {
        id: "c1",
        documentId: "d",
        authorId: "u",
        parentCommentId: null,
        body: "a",
        createdAt: "x",
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listByDocument: vi.fn(async () => items) },
    });
    expect(await controller.listForDocument("d")).toEqual(items);
  });

  it("GET /comments/:parentId/replies — 리스트", async () => {
    const items = [
      {
        id: "r1",
        documentId: "d",
        authorId: "u",
        parentCommentId: "p1",
        body: "r",
        createdAt: "x",
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listReplies: vi.fn(async () => items) },
    });
    expect(await controller.listReplies("p1")).toEqual(items);
  });

  it("DELETE /comments/:id — DELETED", async () => {
    const useCase = {
      delete: vi.fn(async (c: { id: string }) => ({ id: c.id, status: "DELETED" as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    expect((await controller.remove("c1")).status).toBe("DELETED");
  });
});
