// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { AssignmentDetailBff } from "./assignment-detail.bff.js";
import type { AssignmentReadModelQuery } from "../../application/queries/assignment-read-model.query.js";
import type { AssignmentLoggerPort } from "../../application/ports/assignment-logger.port.js";

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: AssignmentLoggerPort = {
    info: (ctx, msg) => {
      logged.push({ level: "info", ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: "warn", ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      logged.push({ level: "error", ctx: ctx as never, msg });
    },
  };
  return { logger, logged };
}

describe("AssignmentDetailBff", () => {
  it("read model 의 detail 을 BFF DTO 로 합성한다 (cacheKey 포함)", async () => {
    const readModel: AssignmentReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: "asg_1",
        projectId: "prj_1",
        managerId: "mgr_1",
        status: "assigned",
        updatedAt: "2026-04-01T00:00:00.000Z",
      })),
    };
    const { logger, logged } = makeLogger();
    const bff = new AssignmentDetailBff(readModel, logger);

    const result = await bff.getDetail({
      id: "asg_1",
      traceId: "trc_a",
      correlationId: "cor_a",
    });

    expect(result).toEqual({
      id: "asg_1",
      title: "Assignment asg_1",
      assigneeLabel: "Manager mgr_1",
      statusLabel: "ASSIGNED",
      updatedAt: "2026-04-01T00:00:00.000Z",
      cacheKey: "assignment-bff-detail:v1:asg_1",
    });

    const log = logged.find((l) => l.msg === "assignment-detail.bff.success")!;
    expect(log.ctx).toMatchObject({
      domain: "assignment",
      useCase: "AssignmentDetailBff.getDetail",
      queryName: "AssignmentDetailBffQuery",
      cacheKeyPrefix: "assignment-bff-detail:v1",
      cacheHit: false,
      outcome: "success",
    });
  });

  it("read model 이 null 이면 null 반환 + outcome=failure 로깅", async () => {
    const readModel: AssignmentReadModelQuery = {
      findDetail: vi.fn(async () => null),
    };
    const { logger, logged } = makeLogger();
    const bff = new AssignmentDetailBff(readModel, logger);

    const result = await bff.getDetail({
      id: "missing",
      traceId: "trc_b",
      correlationId: "cor_b",
    });
    expect(result).toBeNull();
    const miss = logged.find((l) => l.msg === "assignment-detail.bff.miss")!;
    expect(miss.ctx.outcome).toBe("failure");
  });

  it("cacheKey prefix 가 OM seed 와 일치한다", () => {
    const { logger } = makeLogger();
    const bff = new AssignmentDetailBff({ findDetail: vi.fn() } as never, logger);
    expect(bff.cachePrefix).toBe("assignment-bff-detail:v1");
  });
});
