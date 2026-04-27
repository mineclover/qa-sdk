// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphRetentionInsightHttpAdapter } from "./graph-retention-insight.adapter.js";

describe("GraphRetentionInsightHttpAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("URL 미설정 시 null", async () => {
    const adapter = new GraphRetentionInsightHttpAdapter(undefined);
    expect(await adapter.getForGraph("graph-1")).toBeNull();
  });

  it("ingest URL 설정 시 fetch 위임 + 파싱", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            total: 3,
            summary: { "sim.graph_retention.graph_pruned": 3 },
            byTrigger: { api: 3 },
            byGraphId: { "graph-1": 3 },
            items: [],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new GraphRetentionInsightHttpAdapter("http://localhost:3200");
    const result = await adapter.getForGraph("graph-1");
    expect(result?.total).toBe(3);
    expect(result?.summary["sim.graph_retention.graph_pruned"]).toBe(3);
  });

  it("fetch 비-200 응답 시 null (fail-open)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 503 })));
    const adapter = new GraphRetentionInsightHttpAdapter("http://localhost:3200");
    expect(await adapter.getForGraph("graph-1")).toBeNull();
  });

  it("fetch 예외 시 null (fail-open)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const adapter = new GraphRetentionInsightHttpAdapter("http://localhost:3200");
    expect(await adapter.getForGraph("graph-1")).toBeNull();
  });
});
