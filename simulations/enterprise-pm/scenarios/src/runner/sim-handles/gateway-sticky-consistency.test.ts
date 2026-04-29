// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import {
  createGatewayStickyConsistency,
  type FetchLike,
} from "./gateway-sticky-consistency.js";

describe("gateway-sticky-consistency handle", () => {
  it("consistent=10, total=10 → 1.0", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { consistent: 10, total: 10 };
      },
    });
    const f = createGatewayStickyConsistency({
      gatewayUrl: "http://gw/",
      fetchImpl,
    });
    expect(await f()).toBe(1);
  });

  it("consistent=8, total=10 → 0.8", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { consistent: 8, total: 10 };
      },
    });
    const f = createGatewayStickyConsistency({
      gatewayUrl: "http://gw",
      fetchImpl,
    });
    expect(await f()).toBeCloseTo(0.8, 5);
  });

  it("total=0 → 1.0 (NaN 회피)", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { consistent: 0, total: 0 };
      },
    });
    const f = createGatewayStickyConsistency({
      gatewayUrl: "http://gw",
      fetchImpl,
    });
    expect(await f()).toBe(1);
  });

  it("invalid shape → throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { consistent: "x", total: 10 };
      },
    });
    const f = createGatewayStickyConsistency({
      gatewayUrl: "http://gw",
      fetchImpl,
    });
    await expect(f()).rejects.toThrow(/invalid shape/);
  });

  it("non-2xx → throw", async () => {
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
    const f = createGatewayStickyConsistency({
      gatewayUrl: "http://gw",
      fetchImpl,
    });
    await expect(f()).rejects.toThrow(/status=500/);
  });
});
