// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import { createOutboxClient, type FetchLike } from "./outbox-client.js";

describe("outbox-client handle", () => {
  it("insertEvents가 count를 POST하고 ids+insertedAtMs를 반환", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, body: init?.body });
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return {
            ids: ["e1", "e2", "e3"],
            insertedAtMs: 1_700_000_000_000,
          };
        },
      };
    };
    const c = createOutboxClient({
      approvalApiUrl: "http://approval/",
      fetchImpl,
    });
    const ids = await c.insertEvents(3);
    expect(ids).toEqual(["e1", "e2", "e3"]);
    expect(calls[0].url).toBe("http://approval/admin/outbox/insert");
    expect(JSON.parse(calls[0].body!)).toEqual({ count: 3 });
  });

  it("insertEvents count invalid → throw", async () => {
    const c = createOutboxClient({
      approvalApiUrl: "http://x",
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return {};
        },
      })) as unknown as FetchLike,
    });
    await expect(c.insertEvents(0)).rejects.toThrow(/positive integer/);
    await expect(c.insertEvents(-1)).rejects.toThrow(/positive integer/);
  });

  it("waitForDispatch polling 후 모든 id의 publishedAt+dispatcherIds 반환", async () => {
    const responses = [
      { publishedAt: [], dispatcherIds: [] },
      {
        publishedAt: [["e1", 1000]],
        dispatcherIds: [["e1", "d1"]],
      },
      {
        publishedAt: [
          ["e1", 1000],
          ["e2", 1010],
        ],
        dispatcherIds: [
          ["e1", "d1"],
          ["e2", "d2"],
        ],
      },
    ];
    let i = 0;
    const fetchImpl: FetchLike = async (url) => {
      // first POST insert
      if (url.includes("/insert")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return { ids: ["e1", "e2"], insertedAtMs: 900 };
          },
        };
      }
      const body = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return body;
        },
      };
    };
    let nowVal = 0;
    const c = createOutboxClient({
      approvalApiUrl: "http://x",
      fetchImpl,
      pollIntervalMs: 1,
      sleepImpl: async () => {},
      nowImpl: () => {
        nowVal += 1;
        return nowVal;
      },
    });
    const ids = await c.insertEvents(2);
    const r = await c.waitForDispatch(ids, 100);
    expect(r.publishedAt.size).toBe(2);
    expect(r.dispatcherIds.size).toBe(2);
    expect(r.insertedAtMs).toBe(900);
  });

  it("waitForDispatch timeout 시 throw", async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("/insert")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return { ids: ["a"], insertedAtMs: 0 };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return { publishedAt: [], dispatcherIds: [] };
        },
      };
    };
    let nowVal = 0;
    const c = createOutboxClient({
      approvalApiUrl: "http://x",
      fetchImpl,
      pollIntervalMs: 1,
      sleepImpl: async () => {},
      nowImpl: () => {
        nowVal += 100;
        return nowVal;
      },
    });
    await c.insertEvents(1);
    await expect(c.waitForDispatch(["a"], 200)).rejects.toThrow(
      /timeout/,
    );
  });
});
