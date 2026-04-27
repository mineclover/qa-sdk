// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { TimeOffController } from "./timeoff.controller.js";
import { TimeOffUseCase } from "../../application/use-cases/timeoff.use-case.js";
import { TimeOffReadModelQuery } from "../../application/queries/timeoff-read-model.query.js";

async function build(args: {
  useCase?: Partial<TimeOffUseCase>;
  readModel?: Partial<TimeOffReadModelQuery>;
}) {
  const m = await Test.createTestingModule({
    controllers: [TimeOffController],
    providers: [
      { provide: TimeOffUseCase, useValue: args.useCase ?? {} },
      { provide: TimeOffReadModelQuery, useValue: args.readModel ?? {} },
    ],
  }).compile();
  return m.get(TimeOffController);
}

describe("TimeOffController", () => {
  it("POST + GET 라운드트립", async () => {
    const useCase = { create: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "draft" })) };
    const detail = {
      id: "tof_1",
      requesterId: "u",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      reason: "vacation",
      status: "draft",
      updatedAt: "x",
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const c = await build({ useCase, readModel });
    expect(
      await c.create({
        requesterId: "u",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        reason: "vacation",
      }),
    ).toEqual(detail);
  });

  it("GET 미존재 → TimeOffNotFoundException", async () => {
    const readModel = { findDetail: vi.fn(async () => null) };
    const c = await build({ readModel });
    await expect(c.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "TIMEOFF_NOT_FOUND",
    });
  });
});
