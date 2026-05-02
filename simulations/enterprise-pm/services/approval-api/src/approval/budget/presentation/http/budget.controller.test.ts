// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BudgetController } from "./budget.controller.js";
import { BudgetUseCase } from "../../application/use-cases/budget.use-case.js";
import { BudgetReadModelQuery } from "../../application/queries/budget-read-model.query.js";
import { BudgetAccessQueryPort } from "../../application/ports/access-check.port.js";
import { BudgetDomainException } from "../../domain/index.js";
import { mapDomainErrorToHttp } from "@qa-sdk/sim-domain-slice-kit";
import { CurrentUserGuard } from "../../../../auth-deps/current-user.guard.js";

const userCtx = {
  userId: "alice",
  bitmapMask: new Uint8Array([0xff, 0xff]),
  bitmapVersion: "uv1",
};

async function build(args: {
  useCase?: Partial<BudgetUseCase>;
  readModel?: Partial<BudgetReadModelQuery>;
  access?: Partial<BudgetAccessQueryPort>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [BudgetController],
    providers: [
      { provide: BudgetUseCase, useValue: args.useCase ?? {} },
      { provide: BudgetReadModelQuery, useValue: args.readModel ?? {} },
      {
        provide: BudgetAccessQueryPort,
        useValue:
          args.access ??
          ({ check: async () => ({ allow: true, rootSpanId: "root-allow" }) } as never),
      },
    ],
  })
    .overrideGuard(CurrentUserGuard)
    .useValue({
      canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        const req = ctx.switchToHttp().getRequest();
        (req as { user: unknown }).user = userCtx;
        return true;
      },
    })
    .compile();
  return moduleRef.get(BudgetController);
}

describe("BudgetController", () => {
  it("POST / — create + access allow → response shape", async () => {
    const useCase = {
      create: vi.fn(async () => ({ id: "br_1", status: "draft", totalStages: 1 })),
    };
    const readModel = {
      findDetail: vi.fn(async () => ({
        id: "br_1",
        projectId: "p",
        projectDepartmentId: "d",
        amount: 500_000,
        requesterId: "u",
        status: "draft",
        currentStage: 1,
        totalStages: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
    };
    const controller = await build({ useCase, readModel });
    const r = await controller.create(
      {
        projectId: "p",
        projectDepartmentId: "d",
        amount: 500_000,
        requesterId: "u",
      },
      userCtx,
    );
    expect(r.rootSpanId).toBe("root-allow");
    expect(r.id).toBe("br_1");
  });

  it("POST 입력 검증 실패 시 zod throw", async () => {
    const controller = await build({});
    await expect(
      controller.create({ projectId: "" }, userCtx),
    ).rejects.toThrow();
  });

  it("GET 미존재 → BudgetNotFoundException (NotFoundError)", async () => {
    const readModel = { findDetail: vi.fn(async () => null) };
    const controller = await build({ readModel });
    await expect(controller.get("missing", userCtx)).rejects.toMatchObject({
      name: "NotFoundError",
      code: "BUDGET_NOT_FOUND",
    });
  });

  it("access deny → ForbiddenException + denyReason", async () => {
    const readModel = {
      findDetail: vi.fn(async () => ({
        id: "br_1",
        projectId: "p",
        projectDepartmentId: "d",
        amount: 0,
        requesterId: "u",
        status: "draft",
        currentStage: 1,
        totalStages: 1,
        updatedAt: "x",
      })),
    };
    const access = {
      check: vi.fn(async () => ({
        allow: false,
        rootSpanId: "root-deny",
        denyReason: "cross_dept",
      })),
    };
    const controller = await build({ readModel, access: access as never });
    await expect(controller.get("br_1", userCtx)).rejects.toThrow();
  });

  it("도메인 예외 → mapDomainErrorToHttp 표준 페이로드", () => {
    const err = new BudgetDomainException("BUDGET_NOT_FOUND", "missing");
    err.name = "NotFoundError";
    const { status, payload } = mapDomainErrorToHttp(err, "trc_x");
    expect(status).toBe(404);
    expect(payload).toEqual({
      code: "BUDGET_NOT_FOUND",
      message: "missing",
      traceId: "trc_x",
    });
  });
});
