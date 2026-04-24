import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GraphRetentionInsightService,
} from "./graph-retention-insight.service.js";

describe("GraphRetentionInsightService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when ingest url is not configured", async () => {
    const svc = new GraphRetentionInsightService(undefined);
    await expect(svc.getForGraph("graph-1")).resolves.toBeNull();
  });

  it("fetches insight for a graph when ingest url exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            total: 1,
            summary: { "sim.graph_retention.graph_pruned": 1 },
            byTrigger: { api: 1 },
            byGraphId: { "graph-1": 1 },
            items: [],
          }),
          { status: 200 },
        ),
      ),
    );

    const svc = new GraphRetentionInsightService("http://localhost:3200");
    const result = await svc.getForGraph("graph-1");
    expect(result?.total).toBe(1);
    expect(result?.summary["sim.graph_retention.graph_pruned"]).toBe(1);
  });
});
