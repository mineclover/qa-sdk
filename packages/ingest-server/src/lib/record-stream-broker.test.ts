import { describe, expect, it, vi } from "vitest";
import {
  RecordStreamBroker,
  RecordStreamBrokerShutdownError,
} from "./record-stream-broker.js";

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
