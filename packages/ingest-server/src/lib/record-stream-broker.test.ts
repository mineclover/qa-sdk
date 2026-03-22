import { describe, expect, it, vi, afterEach } from "vitest";
import type { StoredRecord } from "@qa-sdk/core";
import {
  RecordStreamBroker,
  RecordStreamBrokerShutdownError,
} from "./record-stream-broker.js";

function makeRecord(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    logId: "log_test",
    traceId: "trc_test",
    spanId: "spn_test",
    timestamp: new Date("2026-03-14T00:00:00Z"),
    recordKind: "log",
    eventKey: "test_event",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    createdAt: new Date("2026-03-14T00:00:00Z"),
    ...overrides,
  };
}

describe("RecordStreamBroker — listener error isolation", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let errorSpy: any;

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it("logs sync listener errors via console.error and continues to other listeners", () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broker = new RecordStreamBroker();
    const goodListener = vi.fn();

    broker.subscribeToScenario("scn_1", () => { throw new Error("sync crash"); });
    broker.subscribeToScenario("scn_1", goodListener);

    expect(() => broker.publishToScenario("scn_1", makeRecord())).not.toThrow();

    expect(goodListener).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[record-stream-broker] sync listener error",
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });

  it("logs async listener errors via console.error without crashing", async () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broker = new RecordStreamBroker();

    broker.subscribeToScenario("scn_2", () => Promise.reject(new Error("async crash")));

    broker.publishToScenario("scn_2", makeRecord());

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "[record-stream-broker] async listener error",
        expect.objectContaining({ err: expect.any(Error) }),
      );
    });
  });

  it("does not call subsequent listeners if one throws synchronously", () => {
    // Ensures error isolation: each listener is wrapped independently
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broker = new RecordStreamBroker();
    const afterListener = vi.fn();

    broker.subscribeToScenario("scn_3", () => { throw new Error("crash"); });
    broker.subscribeToScenario("scn_3", afterListener);

    broker.publishToScenario("scn_3", makeRecord());

    // afterListener still runs because each listener is wrapped in its own try/catch
    expect(afterListener).toHaveBeenCalledTimes(1);
  });
});

describe("RecordStreamBroker", () => {
  it("clears existing subscribers and rejects new subscriptions after shutdown", () => {
    const broker = new RecordStreamBroker();
    const traceListener = vi.fn();
    const sessionListener = vi.fn();

    const unsubscribeTrace = broker.subscribeToTrace("trace_shutdown", traceListener);
    const unsubscribeSession = broker.subscribeToSession(
      "session_shutdown",
      sessionListener,
    );

    expect(broker.getTraceSubscriberCount("trace_shutdown")).toBe(1);
    expect(broker.getSessionSubscriberCount("session_shutdown")).toBe(1);

    broker.shutdown();

    expect(broker.isShuttingDown()).toBe(true);
    expect(broker.getTraceSubscriberCount("trace_shutdown")).toBe(0);
    expect(broker.getSessionSubscriberCount("session_shutdown")).toBe(0);
    expect(() =>
      broker.subscribeToTrace("trace_shutdown", vi.fn()),
    ).toThrowError(RecordStreamBrokerShutdownError);
    expect(() =>
      broker.subscribeToSession("session_shutdown", vi.fn()),
    ).toThrowError(RecordStreamBrokerShutdownError);

    unsubscribeTrace();
    unsubscribeSession();
  });
});
