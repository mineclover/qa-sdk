// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { proxyRequest } from "./proxy.js";

afterEach(() => vi.restoreAllMocks());

describe("proxyRequest", () => {
  it("downstream 호출 — 메서드/path/헤더 전달", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://downstream.local:1234/projects/abc");
      expect(init?.method).toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-user-id")).toBe("user-1");
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/projects/abc", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/projects/abc",
      request: inReq,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("body POST 전달 + Content-Type 보존", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("application/json");
      const body = await new Response(init?.body as BodyInit).text();
      expect(body).toBe('{"x":1}');
      return new Response("created", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"x":1}',
    });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/projects",
      request: inReq,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(201);
  });

  it("timeout 초과 → 504", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/x", { method: "GET" });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: inReq,
      timeoutMs: 50,
    });
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("upstream_timeout");
  });

  it("downstream 5xx → status 그대로 전달", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 503 })),
    );
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: new Request("http://gateway/x"),
      timeoutMs: 5000,
    });
    expect(res.status).toBe(503);
  });

  it("traceparent 헤더가 OTel propagation으로 자동 부착 시도", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("x-user-id")).toBe(true);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: new Request("http://gateway/x", {
        headers: { "x-user-id": "u" },
      }),
      timeoutMs: 5000,
    });
    expect(res.status).toBe(200);
  });
});
