// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { SubscriptionEntity, matchesEventType } from "./subscription.entity.js";
import {
  InvalidSubscriptionIdException,
  SubscriptionNotFoundException,
  SubscriptionUserUnknownException,
} from "./subscription.exceptions.js";

describe("SubscriptionEntity", () => {
  const baseInput = {
    userId: "u1",
    eventType: "budget.*",
    channel: "in_app" as const,
    now: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("create() 기본은 isActive=true", () => {
    const e = SubscriptionEntity.create(baseInput);
    expect(e.isActive).toBe(true);
    expect(e.userId).toBe("u1");
    expect(e.eventType).toBe("budget.*");
    expect(e.channel).toBe("in_app");
  });

  it("create() 빈 userId → InvalidSubscriptionIdException", () => {
    expect(() => SubscriptionEntity.create({ ...baseInput, userId: "  " })).toThrow(
      InvalidSubscriptionIdException,
    );
  });

  it("create() 빈 eventType → InvalidSubscriptionIdException", () => {
    expect(() => SubscriptionEntity.create({ ...baseInput, eventType: "" })).toThrow(
      InvalidSubscriptionIdException,
    );
  });

  it("setActive(false) 는 새 인스턴스 + isActive=false", () => {
    const e = SubscriptionEntity.create(baseInput);
    const off = e.setActive(false);
    expect(off).not.toBe(e);
    expect(e.isActive).toBe(true);
    expect(off.isActive).toBe(false);
  });

  it("setActive 가 동일 값이면 같은 인스턴스 반환", () => {
    const e = SubscriptionEntity.create(baseInput);
    expect(e.setActive(true)).toBe(e);
  });

  it("toSnapshot/rehydrate 라운드트립", () => {
    const e = SubscriptionEntity.create(baseInput);
    expect(SubscriptionEntity.rehydrate(e.toSnapshot()).toSnapshot()).toEqual(e.toSnapshot());
  });

  it("InvalidSubscriptionIdException → ValidationError", () => {
    const err = new InvalidSubscriptionIdException("x");
    expect(err.name).toBe("ValidationError");
    expect(err.code).toBe("INVALID_SUBSCRIPTION_ID");
  });

  it("SubscriptionNotFoundException → NotFoundError", () => {
    const err = new SubscriptionNotFoundException("u", "x");
    expect(err.name).toBe("NotFoundError");
    expect(err.code).toBe("SUBSCRIPTION_NOT_FOUND");
  });

  it("SubscriptionUserUnknownException → ConflictError", () => {
    const err = new SubscriptionUserUnknownException("u");
    expect(err.name).toBe("ConflictError");
    expect(err.code).toBe("SUBSCRIPTION_USER_UNKNOWN");
  });
});

describe("matchesEventType", () => {
  it("정확 일치", () => {
    expect(matchesEventType("budget.approved", "budget.approved")).toBe(true);
  });
  it("wildcard", () => {
    expect(matchesEventType("budget.*", "budget.approved")).toBe(true);
    expect(matchesEventType("budget.*", "budget.rejected")).toBe(true);
  });
  it("미일치", () => {
    expect(matchesEventType("budget.*", "task.created")).toBe(false);
    expect(matchesEventType("budget.approved", "budget.rejected")).toBe(false);
  });
});
