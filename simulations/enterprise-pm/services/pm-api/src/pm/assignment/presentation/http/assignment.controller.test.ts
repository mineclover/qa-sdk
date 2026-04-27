// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { AssignmentController } from "./assignment.controller.js";
import { AssignmentUseCase } from "../../application/use-cases/assignment.use-case.js";
import { AssignmentReadModelQuery } from "../../application/queries/assignment-read-model.query.js";
import { AssignmentDomainException } from "../../domain/index.js";
import { mapDomainErrorToHttp } from "@qa-sdk/sim-domain-slice-kit";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<AssignmentUseCase>;
  readModel: Partial<AssignmentReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AssignmentController],
    providers: [
      { provide: AssignmentUseCase, useValue: useCase },
      { provide: AssignmentReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(AssignmentController);
}

describe("AssignmentController", () => {
  it("POST /assignments — 202 응답 shape (assignmentId + status=PENDING)", async () => {
    const useCase = {
      create: vi.fn(async () => ({ id: "asg_1", status: "PENDING" as const })),
    };
    const controller = await build({ useCase, readModel: {} });

    const res = await controller.create({
      projectId: "prj_1",
      managerId: "mgr_1",
      idempotencyKey: "asg_1",
    });

    expect(res).toEqual({ assignmentId: "asg_1", status: "PENDING" });
    expect(useCase.create).toHaveBeenCalledWith({
      id: "asg_1",
      projectId: "prj_1",
      managerId: "mgr_1",
    });
  });

  it("POST 입력 schema 검증 실패 시 zod error", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: {},
    });
    await expect(controller.create({ projectId: "" })).rejects.toThrow();
  });

  it("GET /assignments/:id — 200 응답 (read model)", async () => {
    const detail = {
      id: "asg_1",
      projectId: "prj_1",
      managerId: "mgr_1",
      status: "assigned",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => detail) },
    });
    expect(await controller.get("asg_1")).toEqual(detail);
  });

  it("GET 미존재 시 NotFoundError 도메인 예외", async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "ASSIGNMENT_NOT_FOUND",
    });
  });

  it("도메인 예외가 mapDomainErrorToHttp 로 표준 페이로드 매핑된다", () => {
    const err = new AssignmentDomainException("ASSIGNMENT_NOT_FOUND", "missing");
    err.name = "NotFoundError";
    const { status, payload } = mapDomainErrorToHttp(err, "trc_x");
    expect(status).toBe(404);
    expect(payload).toEqual({
      code: "ASSIGNMENT_NOT_FOUND",
      message: "missing",
      traceId: "trc_x",
    });
  });
});
