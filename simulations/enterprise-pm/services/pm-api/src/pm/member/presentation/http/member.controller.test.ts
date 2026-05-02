// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { MemberController } from "./member.controller.js";
import { MemberUseCase } from "../../application/use-cases/member.use-case.js";
import { MemberReadModelQuery } from "../../application/queries/member-read-model.query.js";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<MemberUseCase>;
  readModel: Partial<MemberReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [MemberController],
    providers: [
      { provide: MemberUseCase, useValue: useCase },
      { provide: MemberReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(MemberController);
}

describe("MemberController", () => {
  it("POST /members — useCase.add 호출", async () => {
    const detail = {
      projectId: "prj_1",
      userId: "u_1",
      role: "lead",
      joinedAt: "2026-01-01T00:00:00.000Z",
    };
    const useCase = { add: vi.fn(async () => detail) };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.add({ projectId: "prj_1", userId: "u_1", role: "lead" });
    expect(res).toEqual(detail);
  });

  it("DELETE /members — useCase.remove 호출", async () => {
    const useCase = { remove: vi.fn(async () => undefined) };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.remove("prj_1", "u_1");
    expect(res).toEqual({ status: "removed" });
    expect(useCase.remove).toHaveBeenCalledWith({ projectId: "prj_1", userId: "u_1" });
  });

  it("GET /projects/:projectId/members", async () => {
    const list = [{ projectId: "prj_1", userId: "u_1", role: "lead", joinedAt: "x" }];
    const controller = await build({
      useCase: {},
      readModel: { listForProject: vi.fn(async () => list) },
    });
    expect(await controller.listForProject("prj_1")).toEqual(list);
  });

  it("GET /users/:userId/projects", async () => {
    const list = [{ projectId: "prj_1", userId: "u_1", role: "lead", joinedAt: "x" }];
    const controller = await build({
      useCase: {},
      readModel: { listForUser: vi.fn(async () => list) },
    });
    expect(await controller.listForUser("u_1")).toEqual(list);
  });

  it("POST /members — schema 위반 시 zod error", async () => {
    const controller = await build({
      useCase: { add: vi.fn() },
      readModel: {},
    });
    await expect(controller.add({ projectId: "" })).rejects.toThrow();
  });
});
