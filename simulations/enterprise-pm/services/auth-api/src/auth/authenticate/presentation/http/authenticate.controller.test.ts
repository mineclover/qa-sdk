// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { AuthenticateController } from "./authenticate.controller.js";
import { AuthenticateUseCase } from "../../application/use-cases/authenticate.use-case.js";

async function build(useCase: Partial<AuthenticateUseCase>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthenticateController],
    providers: [{ provide: AuthenticateUseCase, useValue: useCase }],
  }).compile();
  return moduleRef.get(AuthenticateController);
}

describe("AuthenticateController", () => {
  it("POST /auth/authenticate → session", async () => {
    const session = {
      userId: "u_1",
      displayName: "Alice",
      departmentId: null,
      primaryRoleId: null,
      roleIds: [],
      roleNames: [],
      roleAssignments: [],
    };
    const useCase = { authenticate: vi.fn(async () => session) };
    const controller = await build(useCase);
    const res = await controller.authenticate({ email: "alice@x.com", password: "p" });
    expect(res).toEqual(session);
  });

  it("invalid email schema → throw", async () => {
    const controller = await build({ authenticate: vi.fn() });
    await expect(controller.authenticate({ email: "not-email", password: "p" })).rejects.toThrow();
  });
});
