import { describe, expect, it, vi } from "vitest";
import type { AddressStateCacheRecord } from "index-meta";
import {
  GateServiceClientError,
  HttpGateStateClient,
} from "./gate-client.js";

const GATE_RECORD: AddressStateCacheRecord = {
  prefix: "perm/core",
  versionId: "v1 beta",
  specs: [],
  reservedRanges: [],
  inactiveRanges: [[4, 7]],
  openRanges: [[10, 11]],
  computedAt: "2026-01-01T00:00:00.000Z",
};

describe("HttpGateStateClient", () => {
  it("calls GET /gate/state/:prefix/:version and parses the response", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      expect(String(input)).toBe("http://gate.local/gate/state/perm%2Fcore/v1%20beta");
      return new Response(JSON.stringify(GATE_RECORD), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = new HttpGateStateClient({
      baseUrl: "http://gate.local/",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getStateRanges("perm/core", "v1 beta")).resolves.toEqual(GATE_RECORD);
  });

  it("throws GateServiceClientError when gate-service responds with an error", async () => {
    const client = new HttpGateStateClient({
      baseUrl: "http://gate.local",
      fetch: vi.fn(async () => new Response(JSON.stringify({
        error: { message: "gate unavailable" },
      }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
    });

    await expect(client.getStateRanges("perm", "v1")).rejects.toMatchObject({
      name: "GateServiceClientError",
      message: "gate unavailable",
      statusCode: 503,
    } satisfies Partial<GateServiceClientError>);
  });
});
