import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemorySessionStore } from "./session.adapter.js";

describe("InMemorySessionStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("upserts sessions, ignores duplicates, and finds them by id", async () => {
    const store = new InMemorySessionStore();

    await store.upsert({
      sessionId: "session_1",
      scenarioId: "scenario_signup",
      labels: { region: "kr" },
    });

    const created = await store.findById("session_1");

    vi.setSystemTime(new Date("2026-03-12T02:00:00.000Z"));

    await store.upsert({
      sessionId: "session_1",
      scenarioId: "scenario_checkout",
      labels: { region: "us" },
    });

    const duplicate = await store.findById("session_1");

    expect(created).toEqual({
      sessionId: "session_1",
      scenarioId: "scenario_signup",
      labels: { region: "kr" },
      actorId: null,
      userId: null,
      userAttributes: null,
      startedAt: new Date("2026-03-12T01:00:00.000Z"),
      closedAt: null,
    });
    expect(duplicate).toEqual(created);
  });

  it("closes an existing session", async () => {
    const store = new InMemorySessionStore();

    await store.upsert({ sessionId: "session_1" });

    vi.setSystemTime(new Date("2026-03-12T03:00:00.000Z"));
    await store.close("session_1");

    await expect(store.findById("session_1")).resolves.toEqual({
      sessionId: "session_1",
      scenarioId: null,
      labels: null,
      actorId: null,
      userId: null,
      userAttributes: null,
      startedAt: new Date("2026-03-12T01:00:00.000Z"),
      closedAt: new Date("2026-03-12T03:00:00.000Z"),
    });
  });
});
