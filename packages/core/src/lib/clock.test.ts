import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { now } from "./clock.js";

describe("now", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an ISO-8601 UTC string", () => {
    vi.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
    expect(now()).toBe("2026-03-13T12:00:00.000Z");
  });

  it("ends with Z (UTC timezone)", () => {
    vi.setSystemTime(new Date("2026-03-13T00:00:00.000Z"));
    expect(now()).toMatch(/Z$/);
  });

  it("matches ISO-8601 format", () => {
    vi.setSystemTime(new Date("2026-03-13T15:30:45.123Z"));
    expect(now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("reflects the current system time", () => {
    const expected = new Date("2026-06-01T08:00:00.000Z");
    vi.setSystemTime(expected);
    expect(now()).toBe(expected.toISOString());
  });
});
