// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { ResourceDetailBff } from "./resource-detail.bff.js";
import type { ResourceReadModelQuery } from "../../application/queries/resource-read-model.query.js";
import type { ResourceLoggerPort } from "../../application/ports/resource-logger.port.js";

function logger(): { logger: ResourceLoggerPort; logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> } {
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

describe("ResourceDetailBff", () => {
  it("read model 합성 + cacheKey", async () => {
    const readModel: ResourceReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: "rsr_1",
        projectId: "p",
        requesterId: "u",
        resourceType: "consultant",
        description: "x",
        status: "submitted",
        updatedAt: "2026-04-01T00:00:00.000Z",
      })),
    } as never;
    const { logger: lg } = logger();
    const bff = new ResourceDetailBff(readModel, lg);
    const r = await bff.getDetail({ id: "rsr_1", traceId: "t", correlationId: "c" });
    expect(r).toMatchObject({
      typeLabel: "consultant",
      statusLabel: "SUBMITTED",
      cacheKey: "resource-bff-detail:v1:rsr_1",
    });
  });
  it("null → null", async () => {
    const readModel = { findDetail: vi.fn(async () => null) } as never;
    const { logger: lg } = logger();
    const bff = new ResourceDetailBff(readModel, lg);
    expect(await bff.getDetail({ id: "x", traceId: "t", correlationId: "c" })).toBeNull();
  });
});
