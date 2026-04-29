// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import {
  createBitmapVersionCheck,
  type FetchLike,
} from "./bitmap-version-check.js";

describe("bitmap-version-check handle", () => {
  it("expectedVersion 회복 시 recoveredVia + recoveredAtMs 반환", async () => {
    const states = [
      { current: "v1", recoveredVia: "stale" },
      { current: "v1", recoveredVia: "stale" },
      { current: "v2", recoveredVia: "version-check" },
    ];
    let i = 0;
    const fetchImpl: FetchLike = async () => {
      const body = states[Math.min(i, states.length - 1)];
      i += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return body;
        },
      };
    };
    let nowVal = 0;
    const checker = createBitmapVersionCheck({
      authApiUrl: "http://auth",
      fetchImpl,
      pollIntervalMs: 1,
      sleepImpl: async () => {},
      nowImpl: () => {
        nowVal += 10;
        return nowVal;
      },
    });
    const result = await checker("v2", 1_000_000);
    expect(result.recoveredVia).toBe("version-check");
    expect(result.recoveredAtMs).toBeGreaterThan(0);
  });

  it("recoveredVia가 ttl이면 그대로 반환", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { current: "v2", recoveredVia: "ttl" };
      },
    });
    const checker = createBitmapVersionCheck({
      authApiUrl: "http://auth",
      fetchImpl,
      sleepImpl: async () => {},
      nowImpl: () => 1,
    });
    const r = await checker("v2", 100);
    expect(r.recoveredVia).toBe("ttl");
  });

  it("timeout 시 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { current: "v1", recoveredVia: "stale" };
      },
    });
    let nowVal = 0;
    const checker = createBitmapVersionCheck({
      authApiUrl: "http://auth",
      fetchImpl,
      pollIntervalMs: 1,
      sleepImpl: async () => {},
      nowImpl: () => {
        nowVal += 100;
        return nowVal;
      },
    });
    await expect(checker("v2", 200)).rejects.toThrow(/timeout/);
  });

  it("non-2xx 응답에 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 500,
      async text() {
        return "down";
      },
      async json() {
        return {};
      },
    });
    const checker = createBitmapVersionCheck({
      authApiUrl: "http://auth",
      fetchImpl,
      sleepImpl: async () => {},
      nowImpl: () => 0,
    });
    await expect(checker("v2", 1000)).rejects.toThrow(/status=500/);
  });
});
