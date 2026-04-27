// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { SubscriptionDetailBff } from "./subscription-detail.bff.js";
import type { SubscriptionReadModelQuery } from "../../application/queries/subscription-read-model.query.js";
import type { SubscriptionLoggerPort } from "../../application/ports/subscription-logger.port.js";

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: SubscriptionLoggerPort = {
    info: (ctx, msg) => logged.push({ level: "info", ctx: ctx as never, msg }),
    warn: (ctx, msg) => logged.push({ level: "warn", ctx: ctx as never, msg }),
    error: (ctx, msg) => logged.push({ level: "error", ctx: ctx as never, msg }),
  };
  return { logger, logged };
}

describe("SubscriptionDetailBff", () => {
  it("read model detail 을 BFF DTO 로 합성", async () => {
    const readModel: SubscriptionReadModelQuery = {
      findDetail: vi.fn(async () => ({
        userId: "u",
        eventType: "x",
        channel: "email",
        isActive: true,
        createdAt: "2026-04-01T00:00:00.000Z",
      })),
      listForUser: vi.fn(),
      listSubscribersByEventType: vi.fn(),
    };
    const { logger, logged } = makeLogger();
    const bff = new SubscriptionDetailBff(readModel, logger);

    const r = await bff.getDetail({ userId: "u", eventType: "x", traceId: "t", correlationId: "c" });
    expect(r).toEqual({
      userId: "u",
      eventType: "x",
      channelLabel: "Email",
      statusLabel: "ACTIVE",
      createdAt: "2026-04-01T00:00:00.000Z",
      cacheKey: "subscription-bff-detail:v1:u:x",
    });
    expect(logged.find((l) => l.msg === "subscription-detail.bff.success")!.ctx.outcome).toBe(
      "success",
    );
  });

  it("inactive → PAUSED", async () => {
    const readModel: SubscriptionReadModelQuery = {
      findDetail: vi.fn(async () => ({
        userId: "u",
        eventType: "x",
        channel: "in_app",
        isActive: false,
        createdAt: "2026-04-01T00:00:00.000Z",
      })),
      listForUser: vi.fn(),
      listSubscribersByEventType: vi.fn(),
    };
    const { logger } = makeLogger();
    const bff = new SubscriptionDetailBff(readModel, logger);
    const r = await bff.getDetail({ userId: "u", eventType: "x", traceId: "t", correlationId: "c" });
    expect(r!.statusLabel).toBe("PAUSED");
    expect(r!.channelLabel).toBe("In-App");
  });

  it("read-model null → null", async () => {
    const readModel: SubscriptionReadModelQuery = {
      findDetail: vi.fn(async () => null),
      listForUser: vi.fn(),
      listSubscribersByEventType: vi.fn(),
    };
    const { logger, logged } = makeLogger();
    const bff = new SubscriptionDetailBff(readModel, logger);
    expect(
      await bff.getDetail({ userId: "u", eventType: "x", traceId: "t", correlationId: "c" }),
    ).toBeNull();
    expect(logged.find((l) => l.msg === "subscription-detail.bff.miss")!.ctx.outcome).toBe(
      "failure",
    );
  });

  it("cachePrefix 일관", () => {
    const { logger } = makeLogger();
    const bff = new SubscriptionDetailBff(
      { findDetail: vi.fn(), listForUser: vi.fn(), listSubscribersByEventType: vi.fn() } as never,
      logger,
    );
    expect(bff.cachePrefix).toBe("subscription-bff-detail:v1");
  });
});
