/**
 * DefinitionClient 단위 테스트 — mock fetch 기반
 */

import { describe, it, expect, vi } from "vitest";
import { DefinitionClient, DefinitionClientError } from "./client.js";

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  }) as unknown as typeof fetch;
}

describe("DefinitionClient", () => {
  it("health를 호출한다", async () => {
    const f = mockFetch({ status: "ok", service: "definition-service" });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.health();
    expect(result.status).toBe("ok");
    expect(f).toHaveBeenCalledOnce();
  });

  it("listDocs에 필터를 전달한다", async () => {
    const f = mockFetch({ docs: [], total: 0 });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    await client.listDocs({ scope: "data", aspect: "prefix_schema" });
    const url = (f as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("scope=data");
    expect(url).toContain("aspect=prefix_schema");
  });

  it("getDoc을 호출한다", async () => {
    const doc = { docId: "prefix-page_view", scope: "data", version: 1 };
    const f = mockFetch(doc);
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.getDoc("prefix-page_view");
    expect(result.docId).toBe("prefix-page_view");
  });

  it("resolveIntents에 dims를 전달한다", async () => {
    const f = mockFetch({ prefixId: "page_view", address: {}, matched: [], total: 0 });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    await client.resolveIntents("page_view", { page: "checkout", locale: "ko" });
    const url = (f as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("dims=");
    expect(url).toContain("page%3Acheckout");
  });

  it("createIntent를 POST로 보낸다", async () => {
    const f = mockFetch({ id: 1, prefixId: "page_view" });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.createIntent("page_view", {
      slice: { page: "checkout" },
      intent: "결제 전환율",
    });
    expect(result.id).toBe(1);
    const callArgs = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("POST");
  });

  it("recordConsumption을 POST로 보낸다", async () => {
    const f = mockFetch({ id: 1, consumptionRate: 0.015 });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.recordConsumption("page_view", {
      prefixVersion: "v2",
      totalSpace: 32768,
      observedAddresses: 500,
      dimStats: { page: { axisId: "page", totalEntries: 20, observedEntries: 8, rate: 0.4 } },
    });
    expect(result.consumptionRate).toBeCloseTo(0.015);
  });

  it("getImpact를 호출한다", async () => {
    const f = mockFetch({ sourceId: "prefix-service", blastRadius: 34, impacted: [], affectedGroups: [] });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.getImpact("prefix-service");
    expect(result.blastRadius).toBe(34);
  });

  it("triggerSync를 POST로 보낸다", async () => {
    const f = mockFetch({ synced: 10, created: 2, unchanged: 8, errors: [] });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.triggerSync();
    expect(result.synced).toBe(10);
  });

  it("HTTP 에러 시 DefinitionClientError를 던진다", async () => {
    const f = mockFetch({ error: { code: "NOT_FOUND" } }, 404);
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    await expect(client.getDoc("nonexistent")).rejects.toThrow(DefinitionClientError);
    try {
      await client.getDoc("nonexistent");
    } catch (err) {
      expect((err as DefinitionClientError).status).toBe(404);
      expect((err as DefinitionClientError).path).toBe("/docs/nonexistent");
    }
  });

  it("deleteIntent를 DELETE로 보낸다", async () => {
    const f = mockFetch({ ok: true, id: 1 });
    const client = new DefinitionClient({ baseUrl: "http://localhost:3700", fetch: f });

    const result = await client.deleteIntent(1);
    expect(result.ok).toBe(true);
    const callArgs = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("DELETE");
  });
});
