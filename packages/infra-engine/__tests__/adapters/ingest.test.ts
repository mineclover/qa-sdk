import { describe, it, expect, vi, afterEach } from "vitest";
import { createIngestAdapter } from "../../src/adapters/ingest.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("IngestAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emit 성공 → { ok: true }", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accepted: true, record_count: 1 }),
    });

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    const result = await adapter.emit("deploy_event", { service_id: "test" }, {});

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    // envelope 구조 검증
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.transmission_id).toBeTruthy();
    expect(body.records).toHaveLength(1);
    expect(body.records[0].event_key).toBe("deploy_event");
    expect(body.records[0].payload.service_id).toBe("test");
  });

  it("emit 실패 → { ok: false, error }", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    const result = await adapter.emit("deploy_event", {}, {});

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("address_context 비어있으면 envelope에 포함 안 함", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accepted: true, record_count: 1 }),
    });

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    await adapter.emit("deploy_event", {}, {});

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.records[0].address_context).toBeUndefined();
  });

  it("address_context 있으면 envelope에 포함", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accepted: true, record_count: 1 }),
    });

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    await adapter.emit("deploy_event", {}, { svc_ref: "42" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.records[0].address_context).toEqual({ svc_ref: "42" });
  });

  it("HTTP 에러 응답 → { ok: false }", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    const result = await adapter.emit("deploy_event", {}, {});

    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 500");
  });

  it("accepted: false → { ok: false }", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accepted: false, record_count: 0 }),
    });

    const adapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
    const result = await adapter.emit("deploy_event", {}, {});

    expect(result.ok).toBe(false);
    expect(result.error).toBe("not accepted");
  });

  it("커스텀 serviceName 사용", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accepted: true, record_count: 1 }),
    });

    const adapter = createIngestAdapter({
      baseUrl: "http://localhost:3200",
      serviceName: "my-service",
    });
    await adapter.emit("deploy_event", {}, {});

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.owner.owner_id).toBe("my-service");
    expect(body.source.service_name).toBe("my-service");
  });
});
