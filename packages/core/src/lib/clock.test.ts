import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { now, normalizeTimestamp, compareTimestamps } from "./clock.js";

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

describe("normalizeTimestamp", () => {
  it("밀리초 없는 타임스탬프에 .000 추가", () => {
    expect(normalizeTimestamp("2026-03-22T10:00:00Z")).toBe("2026-03-22T10:00:00.000Z");
  });

  it("밀리초 있는 타임스탬프는 그대로", () => {
    expect(normalizeTimestamp("2026-03-22T10:00:00.100Z")).toBe("2026-03-22T10:00:00.100Z");
  });

  it("잘못된 형식은 원본 반환", () => {
    expect(normalizeTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("정규화 후 문자열 비교가 올바른 순서", () => {
    const a = normalizeTimestamp("2026-03-22T10:00:00Z");
    const b = normalizeTimestamp("2026-03-22T10:00:00.100Z");
    expect(a < b).toBe(true);
  });
});

describe("compareTimestamps", () => {
  it("밀리초 유무 관계없이 올바른 순서", () => {
    expect(compareTimestamps("2026-03-22T10:00:00Z", "2026-03-22T10:00:00.100Z")).toBeLessThan(0);
  });

  it("같은 시간 → 0", () => {
    expect(compareTimestamps("2026-03-22T10:00:00Z", "2026-03-22T10:00:00.000Z")).toBe(0);
  });

  it("역순", () => {
    expect(compareTimestamps("2026-03-22T10:01:00Z", "2026-03-22T10:00:00Z")).toBeGreaterThan(0);
  });
});
