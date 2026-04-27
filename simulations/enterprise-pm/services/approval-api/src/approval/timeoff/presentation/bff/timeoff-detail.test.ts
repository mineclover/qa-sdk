// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { TimeOffDetailBff } from "./timeoff-detail.bff.js";
import type { TimeOffReadModelQuery } from "../../application/queries/timeoff-read-model.query.js";
import type { TimeOffLoggerPort } from "../../application/ports/timeoff-logger.port.js";

function logger(): { logger: TimeOffLoggerPort; logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> } {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  return {
    logger: {
      info: (ctx, msg) => logged.push({ level: "info", ctx: ctx as never, msg }),
      warn: (ctx, msg) => logged.push({ level: "warn", ctx: ctx as never, msg }),
      error: (ctx, msg) => logged.push({ level: "error", ctx: ctx as never, msg }),
    },
    logged,
  };
}

describe("TimeOffDetailBff", () => {
  it("read model 합성 + cacheKey", async () => {
    const readModel: TimeOffReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: "tof_1",
        requesterId: "u",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        reason: "vacation",
        status: "submitted",
        updatedAt: "2026-04-01T00:00:00.000Z",
      })),
    } as never;
    const { logger: lg } = logger();
    const bff = new TimeOffDetailBff(readModel, lg);
    const r = await bff.getDetail({ id: "tof_1", traceId: "t", correlationId: "c" });
    expect(r).toMatchObject({
      periodLabel: "2026-05-01 → 2026-05-03",
      statusLabel: "SUBMITTED",
      cacheKey: "timeoff-bff-detail:v1:tof_1",
    });
  });
});
