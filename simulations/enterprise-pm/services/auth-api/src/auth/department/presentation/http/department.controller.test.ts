// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { DepartmentController } from "./department.controller.js";
import { DepartmentUseCase } from "../../application/use-cases/department.use-case.js";
import { DepartmentReadModelQuery } from "../../application/queries/department-read-model.query.js";

async function build(useCase: Partial<DepartmentUseCase>, readModel: Partial<DepartmentReadModelQuery>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [DepartmentController],
    providers: [
      { provide: DepartmentUseCase, useValue: useCase },
      { provide: DepartmentReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(DepartmentController);
}

describe("DepartmentController", () => {
  it("POST /departments → 생성 후 detail 반환", async () => {
    const detail = {
      id: "dept_eng",
      name: "Eng",
      parentId: null,
      managerId: null,
      createdAt: "x",
      updatedAt: "y",
    };
    const useCase = {
      create: vi.fn(async () => ({ id: "dept_eng", status: "ACTIVE" as const })),
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const controller = await build(useCase, readModel);
    const res = await controller.create({ name: "Eng" });
    expect(res).toEqual(detail);
  });

  it("GET /departments/:id/chain", async () => {
    const chain = [
      { id: "leaf", name: "Leaf", parentId: "root", managerId: null, createdAt: "x", updatedAt: "y" },
      { id: "root", name: "Root", parentId: null, managerId: null, createdAt: "x", updatedAt: "y" },
    ];
    const controller = await build({}, { resolveChain: vi.fn(async () => chain) });
    expect(await controller.chain("leaf")).toEqual(chain);
  });

  it("GET 미존재 → NotFoundError", async () => {
    const controller = await build({}, { findDetail: vi.fn(async () => null) });
    await expect(controller.get("missing")).rejects.toMatchObject({ name: "NotFoundError" });
  });
});
