// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { DocumentController } from "./document.controller.js";
import { DocumentUseCase } from "../../application/use-cases/document.use-case.js";
import { DocumentReadModelQuery } from "../../application/queries/document-read-model.query.js";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<DocumentUseCase>;
  readModel: Partial<DocumentReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [DocumentController],
    providers: [
      { provide: DocumentUseCase, useValue: useCase },
      { provide: DocumentReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(DocumentController);
}

describe("DocumentController", () => {
  it("POST /documents — id + status=CREATED 응답", async () => {
    const useCase = {
      create: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "CREATED" as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.create({
      projectId: "p1",
      title: "Spec",
      ownerId: "u1",
    });
    expect(res.status).toBe("CREATED");
    expect(useCase.create).toHaveBeenCalled();
  });

  it("POST 입력 schema 검증 실패 시 zod error", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: {},
    });
    await expect(controller.create({ projectId: "" })).rejects.toThrow();
  });

  it("GET /documents/:id — 200 응답 (read model)", async () => {
    const detail = {
      id: "doc_1",
      projectId: "p",
      title: "T",
      currentVersion: 0,
      ownerId: "u",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => detail) },
    });
    expect(await controller.get("doc_1")).toEqual(detail);
  });

  it("GET 미존재 시 NotFoundError", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("GET /documents?projectId=… — 리스트 반환", async () => {
    const items = [
      {
        id: "d1",
        projectId: "p",
        title: "A",
        currentVersion: 0,
        ownerId: "u",
        createdAt: "x",
        updatedAt: "x",
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listByProject: vi.fn(async () => items) },
    });
    expect(await controller.list("p")).toEqual(items);
  });

  it("PUT /documents/:id — UPDATED", async () => {
    const useCase = {
      update: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "UPDATED" as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.update("doc_1", { title: "T2" });
    expect(res.status).toBe("UPDATED");
  });

  it("DELETE /documents/:id — DELETED", async () => {
    const useCase = {
      delete: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "DELETED" as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.remove("doc_1");
    expect(res.status).toBe("DELETED");
  });
});
