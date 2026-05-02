// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { UserController } from "./user.controller.js";
import { UserUseCase } from "../../application/use-cases/user.use-case.js";
import { UserReadModelQuery } from "../../application/queries/user-read-model.query.js";
import { UserDomainException } from "../../domain/index.js";
import { mapDomainErrorToHttp } from "@qa-sdk/sim-domain-slice-kit";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<UserUseCase>;
  readModel: Partial<UserReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [UserController],
    providers: [
      { provide: UserUseCase, useValue: useCase },
      { provide: UserReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(UserController);
}

describe("UserController", () => {
  it("POST /users — 생성 후 read model detail 반환", async () => {
    const detail = {
      id: "usr_alice_example_com",
      email: "alice@example.com",
      displayName: "Alice",
      departmentId: null,
      primaryRoleId: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const useCase = {
      create: vi.fn(async () => ({ id: detail.id, status: "ACTIVE" as const })),
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const controller = await build({ useCase, readModel });

    const res = await controller.create({
      email: "alice@example.com",
      displayName: "Alice",
    });
    expect(res).toEqual(detail);
  });

  it("POST 입력 schema 검증 실패 시 zod error", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn() },
    });
    await expect(controller.create({ email: "not-an-email", displayName: "X" })).rejects.toThrow();
  });

  it("GET /users/:id — read model 반환", async () => {
    const detail = {
      id: "usr_1",
      email: "u1@x",
      displayName: "U1",
      departmentId: null,
      primaryRoleId: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => detail) },
    });
    expect(await controller.get("usr_1")).toEqual(detail);
  });

  it("GET 미존재 시 NotFoundError 도메인 예외", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "USER_NOT_FOUND",
    });
  });

  it("GET /users (departmentId 미제공) → ValidationError", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listByDepartment: vi.fn() },
    });
    await expect(controller.list(undefined)).rejects.toMatchObject({
      name: "ValidationError",
    });
  });

  it("PUT /users/:id — update", async () => {
    const useCase = { update: vi.fn(async () => ({ id: "usr_1", status: "ACTIVE" as const })) };
    const controller = await build({ useCase, readModel: { findDetail: vi.fn() } });
    const res = await controller.update("usr_1", { displayName: "New" });
    expect(res).toEqual({ userId: "usr_1", status: "ACTIVE" });
  });

  it("DELETE /users/:id — delete", async () => {
    const useCase = { delete: vi.fn(async () => ({ id: "usr_1", status: "DELETED" as const })) };
    const controller = await build({ useCase, readModel: {} });
    expect(await controller.remove("usr_1")).toEqual({ status: "deleted" });
  });

  it("도메인 예외가 mapDomainErrorToHttp 로 표준 페이로드 매핑된다", () => {
    const err = new UserDomainException("USER_NOT_FOUND", "missing");
    err.name = "NotFoundError";
    const { status, payload } = mapDomainErrorToHttp(err, "trc_x");
    expect(status).toBe(404);
    expect(payload).toEqual({ code: "USER_NOT_FOUND", message: "missing", traceId: "trc_x" });
  });
});
