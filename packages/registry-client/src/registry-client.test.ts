import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistryClient } from "./index.js";

describe("RegistryClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns valid true and reuses cached successful validations", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: "https://registry.qa-sdk.test",
      fetch: fetchMock,
    });

    await expect(
      client.validateEvent("checkout-api", "checkout.form.updated", "001"),
    ).resolves.toEqual({ valid: true });
    await expect(
      client.validateEvent("checkout-api", "checkout.form.updated", "001"),
    ).resolves.toEqual({ valid: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns valid false with the registry error message on 404", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "EVENT_NOT_FOUND",
              message:
                "event 'checkout.audit' version '001' not found",
            },
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 404,
          },
        ),
    );
    const client = new RegistryClient({
      baseUrl: "https://registry.qa-sdk.test",
      fetch: fetchMock,
    });

    await expect(
      client.validateEvent("checkout-api", "checkout.audit", "001"),
    ).resolves.toEqual({
      valid: false,
      reason: "event 'checkout.audit' version '001' not found",
    });
  });

  it("warns and fails open when the registry is unavailable", async () => {
    const logger = pino({ level: "silent" });
    const warnSpy = vi.spyOn(logger, "warn");
    const fetchMock = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const client = new RegistryClient({
      baseUrl: "https://registry.qa-sdk.test",
      fetch: fetchMock,
      logger,
    });

    await expect(
      client.validateEvent("checkout-api", "checkout.audit", "001"),
    ).resolves.toEqual({ valid: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
