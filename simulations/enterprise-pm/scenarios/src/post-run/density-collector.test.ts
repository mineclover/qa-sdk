// @def.boundary sim-scenarios
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchDensity, summarizeDensity } from "./density-collector.js";

afterEach(() => vi.restoreAllMocks());

describe("density-collector", () => {
  it("fetchDensity — 200 → §5 §3.1 응답 deserialize + query param 조립", async () => {
    const fetchSpy = vi.fn(async (input: unknown) => {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const u = new URL(urlStr);
      expect(u.pathname).toBe("/density");
      expect(u.searchParams.get("catalog")).toBe("sim");
      expect(u.searchParams.get("prefix")).toBe("sim.bitmap");
      expect(u.searchParams.get("version")).toBe("uv1");
      return Response.json({
        catalog: "sim",
        prefix: "sim.bitmap",
        version: "uv1",
        axes: [
          {
            axisName: "user_action",
            shapeCapacity: 4,
            observedDistinct: 2,
            marginalDensity: 0.5,
            unobservedEntries: [],
          },
        ],
        underutilizedAxes: [],
        saturatedAxes: [],
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchDensity("http://reporting", {
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.axes[0].marginalDensity).toBe(0.5);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("fetchDensity — 5xx → throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 503 })),
    );
    await expect(
      fetchDensity("http://x", {
        catalog: "sim",
        prefix: "p",
        version: "v",
      }),
    ).rejects.toThrow(/status=503/);
  });

  it("summarizeDensity — multi-line 출력 + threshold 알림", () => {
    const summary = summarizeDensity({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
      axes: [
        {
          axisName: "user_action",
          shapeCapacity: 4,
          observedDistinct: 0,
          marginalDensity: 0,
          unobservedEntries: ["a", "b"],
        },
        {
          axisName: "dept_action",
          shapeCapacity: 3,
          observedDistinct: 3,
          marginalDensity: 1.0,
          unobservedEntries: [],
        },
      ],
      underutilizedAxes: ["user_action"],
      saturatedAxes: ["dept_action"],
    });
    expect(summary).toContain("underutilized: user_action");
    expect(summary).toContain("saturated: dept_action");
    expect(summary).toContain("0/4");
    expect(summary).toContain("3/3");
  });
});
