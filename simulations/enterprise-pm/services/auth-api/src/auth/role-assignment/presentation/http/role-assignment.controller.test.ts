// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { RoleAssignmentController } from "./role-assignment.controller.js";
import { RoleAssignmentUseCase } from "../../application/use-cases/role-assignment.use-case.js";
import { RoleAssignmentReadModelQuery } from "../../application/queries/role-assignment-read-model.query.js";

async function build(useCase: Partial<RoleAssignmentUseCase>, readModel: Partial<RoleAssignmentReadModelQuery>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [RoleAssignmentController],
    providers: [
      { provide: RoleAssignmentUseCase, useValue: useCase },
      { provide: RoleAssignmentReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(RoleAssignmentController);
}

describe("RoleAssignmentController", () => {
  it("POST /role-assignments", async () => {
    const detail = {
      id: "u1|r1|global|",
      userId: "u1",
      roleId: "r1",
      scopeType: "global",
      scopeId: null,
      assignedAt: "x",
    };
    const useCase = {
      assign: vi.fn(async () => ({ id: detail.id, status: "ASSIGNED" as const })),
    };
    const readModel = { findOne: vi.fn(async () => detail) };
    const controller = await build(useCase, readModel);
    const res = await controller.assign({
      userId: "u1",
      roleId: "r1",
      scopeType: "global",
      scopeId: null,
    });
    expect(res).toEqual(detail);
  });

  it("DELETE /role-assignments → status: revoked", async () => {
    const useCase = {
      revoke: vi.fn(async () => ({ id: "u1|r1|global|", status: "REVOKED" as const })),
    };
    const controller = await build(useCase, {});
    expect(
      await controller.revoke({ userId: "u1", roleId: "r1", scopeType: "global", scopeId: null }),
    ).toEqual({ status: "revoked" });
  });

  it("GET /role-assignments?userId=…", async () => {
    const list = [
      { id: "u1|r1|global|", userId: "u1", roleId: "r1", scopeType: "global", scopeId: null, assignedAt: "x" },
    ];
    const controller = await build({}, { listForUser: vi.fn(async () => list) });
    expect(await controller.listForUser({ userId: "u1" })).toEqual(list);
  });
});
