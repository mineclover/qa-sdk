// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import {
  HttpSubscriptionUserQuery,
  type FetchLike,
} from "./http-user-query.adapter.js";

function makeFetch(impl: FetchLike): { fetchImpl: FetchLike; calls: { url: string }[] } {
  const calls: { url: string }[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: typeof input === "string" ? input : input.toString() });
    return impl(input, init);
  };
  return { fetchImpl, calls };
}

describe("HttpSubscriptionUserQuery", () => {
  it("200 → true (auth-api 가 user 를 가지고 있음)", async () => {
    const { fetchImpl, calls } = makeFetch(async () => ({ status: 200 }));
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    expect(await adapter.userExists("u1")).toBe(true);
    expect(calls[0].url).toBe("http://auth-api.local:3000/users/u1");
  });

  it("404 → false (user 미존재)", async () => {
    const { fetchImpl } = makeFetch(async () => ({ status: 404 }));
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    expect(await adapter.userExists("missing")).toBe(false);
  });

  it("5xx → fail-open (true)", async () => {
    const { fetchImpl } = makeFetch(async () => ({ status: 503 }));
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    expect(await adapter.userExists("u1")).toBe(true);
  });

  it("네트워크 throw → fail-open (true)", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    expect(await adapter.userExists("u1")).toBe(true);
  });

  it("AbortSignal.timeout 이 init 으로 전달됨", async () => {
    const seen: AbortSignal[] = [];
    const fetchImpl: FetchLike = async (_input, init) => {
      if (init?.signal) seen.push(init.signal);
      return { status: 200 };
    };
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      timeoutMs: 1_000,
      fetchImpl,
    });
    await adapter.userExists("u1");
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });

  it("AbortError (signal 트리거) → fail-open (true)", async () => {
    const fetchImpl: FetchLike = async (_input, init) => {
      // 실제 AbortError 처럼 throw
      const err = new Error("aborted");
      err.name = "AbortError";
      // signal 이 abort 됐든 안 됐든, 어쨌든 throw 하면 fail-open
      void init;
      throw err;
    };
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    expect(await adapter.userExists("u1")).toBe(true);
  });

  it("trailing slash 가 normalize 됨", async () => {
    const { fetchImpl, calls } = makeFetch(async () => ({ status: 200 }));
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000/",
      fetchImpl,
    });
    await adapter.userExists("u1");
    expect(calls[0].url).toBe("http://auth-api.local:3000/users/u1");
  });

  it("special character userId 가 URL-encoded", async () => {
    const { fetchImpl, calls } = makeFetch(async () => ({ status: 200 }));
    const adapter = new HttpSubscriptionUserQuery({
      authApiBaseUrl: "http://auth-api.local:3000",
      fetchImpl,
    });
    await adapter.userExists("user@domain.com");
    expect(calls[0].url).toBe("http://auth-api.local:3000/users/user%40domain.com");
  });

  it("global fetch 미존재 시 명시적 에러", () => {
    const original = (globalThis as { fetch?: FetchLike }).fetch;
    try {
      delete (globalThis as { fetch?: FetchLike }).fetch;
      expect(
        () =>
          new HttpSubscriptionUserQuery({
            authApiBaseUrl: "http://auth-api.local:3000",
          }),
      ).toThrow(/global fetch unavailable/);
    } finally {
      (globalThis as { fetch?: FetchLike }).fetch = original;
    }
  });
});
