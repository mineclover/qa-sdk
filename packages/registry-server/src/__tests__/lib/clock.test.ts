import { describe, expect, it } from "vitest";
import { now } from "../../lib/clock.js";

describe("now", () => {
  it("returns the current time as a Date", () => {
    const before = Date.now();
    const current = now();
    const after = Date.now();

    expect(current).toBeInstanceOf(Date);
    expect(current.getTime()).toBeGreaterThanOrEqual(before);
    expect(current.getTime()).toBeLessThanOrEqual(after);
  });
});
