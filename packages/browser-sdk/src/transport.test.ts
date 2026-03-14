import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BeaconTransport } from "./transport.js";
import type { TransmissionEnvelope } from "@qa-sdk/core";

function makeEnvelope(): TransmissionEnvelope {
  return {
    transmission_id: "txn_test",
    sent_at: new Date().toISOString(),
    owner: { owner_type: "tenant", owner_id: "test" },
    source: { service_name: "test", sdk_name: "test-sdk", sdk_version: "0.0.1" },
    runtime: { platform: "browser", os_version: "test" },
    build: { env: "local" },
    records: [],
  };
}

const ENDPOINT = "http://localhost:3100/v1/ingest";

describe("BeaconTransport", () => {
  let transport: BeaconTransport;

  beforeEach(() => {
    transport = new BeaconTransport(ENDPOINT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses sendBeacon when available and it returns true", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });

    await transport.send(makeEnvelope());

    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(sendBeacon.mock.calls[0][0]).toBe(ENDPOINT);
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(blob.type).toBe("application/json");
  });

  it("sends correct JSON body via sendBeacon", async () => {
    const capturedBlobs: Blob[] = [];
    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn().mockImplementation((_url: string, blob: Blob) => {
        capturedBlobs.push(blob);
        return true;
      }),
    });

    const envelope = makeEnvelope();
    await transport.send(envelope);

    const text = await capturedBlobs[0].text();
    const parsed = JSON.parse(text) as TransmissionEnvelope;
    expect(parsed.transmission_id).toBe("txn_test");
  });

  it("falls back to fetch when sendBeacon returns false", async () => {
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(false) });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await transport.send(makeEnvelope());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
  });

  it("falls back to fetch when navigator.sendBeacon is absent", async () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await transport.send(makeEnvelope());

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("falls back to fetch when navigator is undefined", async () => {
    vi.stubGlobal("navigator", undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await transport.send(makeEnvelope());

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when fetch returns a non-ok status", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }));

    await expect(transport.send(makeEnvelope())).rejects.toThrow("500");
  });

  it("flush resolves immediately without error", async () => {
    await expect(transport.flush()).resolves.toBeUndefined();
  });

  it("shutdown resolves immediately without error", async () => {
    await expect(transport.shutdown()).resolves.toBeUndefined();
  });
});
