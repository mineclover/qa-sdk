// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import { createWaitForCycles, type FetchLike } from "./wait-for-cycles.js";

describe("wait-for-cycles handle", () => {
  it("polling으로 N 사이클 누적 후 cycleIds 반환", async () => {
    const states = [
      { cycleIds: ["c1"] },
      { cycleIds: ["c1", "c2"] },
      { cycleIds: ["c1", "c2", "c3"] },
    ];
    let i = 0;
    const fetchImpl: FetchLike = async () => {
      const body = states[Math.min(i, states.length - 1)];
      i += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify(body);
        },
        async json() {
          return body;
        },
      };
    };
    let nowVal = 0;
    const sleeps: number[] = [];
    const wait = createWaitForCycles({
      controllerUrl: "http://x",
      pollIntervalMs: 10,
      fetchImpl,
      nowImpl: () => {
        nowVal += 1;
        return nowVal;
      },
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
    });
    const result = await wait(3, 1_000_000);
    expect(result).toEqual(["c1", "c2", "c3"]);
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it("timeout 도달 시 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ cycleIds: [] });
      },
      async json() {
        return { cycleIds: [] };
      },
    });
    let nowVal = 0;
    const wait = createWaitForCycles({
      controllerUrl: "http://x",
      pollIntervalMs: 10,
      fetchImpl,
      nowImpl: () => {
        nowVal += 100;
        return nowVal;
      },
      sleepImpl: async () => {},
    });
    await expect(wait(3, 200)).rejects.toThrow(/timeout/);
  });

  it("n이 양의 정수가 아니면 throw", async () => {
    const wait = createWaitForCycles({
      controllerUrl: "http://x",
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return { cycleIds: [] };
        },
      })) as unknown as FetchLike,
    });
    await expect(wait(0, 1000)).rejects.toThrow(/positive integer/);
    await expect(wait(-1, 1000)).rejects.toThrow(/positive integer/);
  });

  it("non-2xx 응답에 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 503,
      async text() {
        return "down";
      },
      async json() {
        return {};
      },
    });
    const wait = createWaitForCycles({
      controllerUrl: "http://x",
      fetchImpl,
      sleepImpl: async () => {},
      nowImpl: () => 0,
    });
    await expect(wait(1, 1000)).rejects.toThrow(/status=503/);
  });
});
