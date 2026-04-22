import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-metrics-collector env", () => {
  it("PORT 기본값 5200", () => {
    expect(parseEnv({}).PORT).toBe(5200);
  });
  it("SCRAPE_TARGETS 기본 빈 문자열", () => {
    expect(parseEnv({}).SCRAPE_TARGETS).toBe("");
  });
});
