import { describe, expect, it, vi } from "vitest";
import type { TransmissionEnvelope } from "@qa-sdk/core";
import { HttpTransport, NoopTransport } from "@qa-sdk/logger";

function buildEnvelope(overrides: Partial<TransmissionEnvelope> = {}): TransmissionEnvelope {
  return {
    transmission_id: "txm_test",
    sent_at: "2026-03-13T00:00:00.000Z",
    owner: { owner_type: "workspace", owner_id: "ws_1" },
    source: { service_name: "test-service", sdk_name: "qa-sdk-js", sdk_version: "0.1.0" },
    runtime: { platform: "node" },
    build: { env: "local" },
    records: [],
    ...overrides,
  };
}

describe("NoopTransport", () => {
  it("starts with an empty sent array", () => {
    const t = new NoopTransport();
    expect(t.sent).toEqual([]);
  });

  it("send() pushes the envelope to sent", async () => {
    const t = new NoopTransport();
    const envelope = buildEnvelope();
    await t.send(envelope);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toBe(envelope);
  });

  it("send() accumulates multiple envelopes in order", async () => {
    const t = new NoopTransport();
    const e1 = buildEnvelope({ transmission_id: "txm_1" });
    const e2 = buildEnvelope({ transmission_id: "txm_2" });
    await t.send(e1);
    await t.send(e2);
    expect(t.sent).toEqual([e1, e2]);
  });

  it("flush() resolves without error", async () => {
    const t = new NoopTransport();
    await expect(t.flush()).resolves.toBeUndefined();
  });

  it("shutdown() resolves without error", async () => {
    const t = new NoopTransport();
    await expect(t.shutdown()).resolves.toBeUndefined();
  });
});

describe("HttpTransport", () => {
  it("send() posts envelope as JSON to the configured endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
    const envelope = buildEnvelope();
    await t.send(envelope);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/v1/ingest");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(envelope);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    vi.unstubAllGlobals();
  });

  it("send() includes custom headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport({
      endpoint: "http://localhost:4000/v1/ingest",
      headers: { "X-Api-Key": "secret" },
    });
    await t.send(buildEnvelope());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("secret");

    vi.unstubAllGlobals();
  });

  it("send() throws when the response is not 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500, statusText: "Internal Server Error" }));
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
    await expect(t.send(buildEnvelope())).rejects.toThrow("500");

    vi.unstubAllGlobals();
  });

  it("send() throws on 4xx responses (e.g. 400, 401)", async () => {
    for (const status of [400, 401, 403]) {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
      vi.stubGlobal("fetch", fetchMock);

      const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
      await expect(t.send(buildEnvelope())).rejects.toThrow(String(status));

      vi.unstubAllGlobals();
    }
  });

  it("send() propagates a network error when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
    await expect(t.send(buildEnvelope())).rejects.toThrow("Failed to fetch");

    vi.unstubAllGlobals();
  });

  it("send() passes an AbortSignal so the request can be cancelled on timeout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest", timeout_ms: 5000 });
    await t.send(buildEnvelope());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);

    vi.unstubAllGlobals();
  });

  it("flush() resolves without error", async () => {
    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
    await expect(t.flush()).resolves.toBeUndefined();
  });

  it("shutdown() resolves without error", async () => {
    const t = new HttpTransport({ endpoint: "http://localhost:4000/v1/ingest" });
    await expect(t.shutdown()).resolves.toBeUndefined();
  });
});
