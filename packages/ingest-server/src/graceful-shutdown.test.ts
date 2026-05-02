// @def.boundary ingest-system
// @def.doc ingest-system

import type { ServerType } from "@hono/node-server";
import type {
  RecordStore,
  TraceStore,
  GraphStore,
  SessionStore,
  VerdictStore,
  ScenarioSpecStore,
  DlqStore,
} from "@qa-sdk/core";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import pino, { type Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createAppLifecycle } from "./lib/app-lifecycle.js";
import { installGracefulShutdown } from "./lib/graceful-shutdown.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { createStreamConnectionRegistry } from "./lib/stream-connection-registry.js";

function createNoopLogger(): Logger {
  return pino({ level: "silent" });
}

function createTestHarness(
  options: {
    dlqStore?: DlqStore;
    graphStore?: GraphStore;
    logger?: Logger;
    recordStore?: RecordStore;
    scenarioSpecStore?: ScenarioSpecStore;
    sessionStore?: SessionStore;
    traceStore?: TraceStore;
    verdictStore?: VerdictStore;
  } = {},
) {
  const appLifecycle = createAppLifecycle();
  const recordStreamBroker = new RecordStreamBroker();
  const streamConnectionRegistry = createStreamConnectionRegistry();
  const recordStore = options.recordStore ?? new InMemoryRecordStore();
  const traceStore = options.traceStore ?? new InMemoryTraceStore();
  const graphStore = options.graphStore ?? new InMemoryGraphStore();
  const transmissionStore = new InMemoryTransmissionStore();
  const sessionStore = options.sessionStore ?? new InMemorySessionStore();
  const verdictStore = options.verdictStore ?? new InMemoryVerdictStore();
  const scenarioSpecStore =
    options.scenarioSpecStore ?? new InMemoryScenarioSpecStore();
  const dlqStore = options.dlqStore ?? new InMemoryDlqStore();

  const app = createApp({
    appLifecycle,
    dlqStore,
    graphStore,
    logger: options.logger ?? createNoopLogger(),
    recordStore,
    recordStreamBroker,
    scenarioSpecStore,
    sessionStore,
    streamConnectionRegistry,
    traceStore,
    transmissionStore,
    verdictStore,
  });

  return {
    app,
    appLifecycle,
    recordStreamBroker,
    streamConnectionRegistry,
  };
}

interface SseEventFrame {
  event: string | null;
  payload: unknown;
  type: "event";
}

function createSseClient(response: Response) {
  if (!response.body) {
    throw new Error("expected SSE response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const nextFrame = async (): Promise<SseEventFrame> => {
    while (true) {
      const delimiterIndex = buffer.indexOf("\n\n");

      if (delimiterIndex >= 0) {
        const rawEvent = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);

        if (rawEvent.length === 0) {
          continue;
        }

        return parseSseEventFrame(rawEvent);
      }

      const { done, value } = await reader.read();

      if (done) {
        throw new Error("SSE stream closed before the next event arrived");
      }

      buffer += decoder.decode(value, { stream: true });
    }
  };

  return {
    async close() {
      await reader.cancel();
    },
    async nextEvent(expectedEvent: string) {
      while (true) {
        const frame = await nextFrame();

        if (frame.event === expectedEvent) {
          return frame;
        }
      }
    },
  };
}

function parseSseEventFrame(rawEvent: string): SseEventFrame {
  const lines = rawEvent.split("\n");
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trimStart();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  return {
    event,
    payload: JSON.parse(dataLines.join("\n")),
    type: "event",
  };
}

function createFakeServer() {
  const server: {
    close: any;
    closeAllConnections: any;
    closeIdleConnections: any;
  } = {
    close: vi.fn,
    closeAllConnections: vi.fn,
    closeIdleConnections: vi.fn,
  };

  server.close = vi.fn((callback?: (err?: Error) => void) => {
    callback?.();
    return server;
  });
  server.closeAllConnections = vi.fn();
  server.closeIdleConnections = vi.fn();

  return server;
}

describe("installGracefulShutdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers SIGTERM and SIGINT handlers", () => {
    const on = vi.fn();

    installGracefulShutdown({
      appLifecycle: createAppLifecycle(),
      closeDb: async () => {},
      logger: createNoopLogger(),
      process: { on },
      recordStreamBroker: new RecordStreamBroker(),
      server: createFakeServer() as unknown as ServerType,
      streamConnectionRegistry: createStreamConnectionRegistry(),
    });

    expect(on).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenNthCalledWith(1, "SIGTERM", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(2, "SIGINT", expect.any(Function));
  });

  it("sends close events to active SSE clients and cleans up subscriptions", async () => {
    const harness = createTestHarness();
    const response = await harness.app.request("/v1/streams/traces/trace_shutdown");

    expect(response.status).toBe(200);
    expect(harness.recordStreamBroker.getTraceSubscriberCount("trace_shutdown")).toBe(
      1,
    );

    const client = createSseClient(response);
    const exitCodes: number[] = [];
    const closeDb = vi.fn(async () => {});
    const { shutdown } = installGracefulShutdown({
      appLifecycle: harness.appLifecycle,
      closeDb,
      exit: (code) => {
        exitCodes.push(code);
      },
      logger: createNoopLogger(),
      recordStreamBroker: harness.recordStreamBroker,
      server: createFakeServer() as unknown as ServerType,
      streamConnectionRegistry: harness.streamConnectionRegistry,
    });

    const closeEventPromise = client.nextEvent("close");

    await shutdown("SIGTERM");

    await expect(closeEventPromise).resolves.toEqual({
      event: "close",
      payload: { reason: "server_shutdown" },
      type: "event",
    });
    expect(harness.recordStreamBroker.getTraceSubscriberCount("trace_shutdown")).toBe(
      0,
    );
    expect(harness.streamConnectionRegistry.getConnectionCount()).toBe(0);
    expect(closeDb).toHaveBeenCalledOnce();
    expect(exitCodes).toEqual([0]);

    await client.close();
  });

  it("rejects new requests after shutdown starts and waits for tracked ingest work to drain", async () => {
    const harness = createTestHarness();
    const server = createFakeServer();
    const exitCodes: number[] = [];
    const closeDb = vi.fn(async () => {});
    const { shutdown } = installGracefulShutdown({
      appLifecycle: harness.appLifecycle,
      closeDb,
      exit: (code) => {
        exitCodes.push(code);
      },
      logger: createNoopLogger(),
      recordStreamBroker: harness.recordStreamBroker,
      server: server as unknown as ServerType,
      shutdownTimeoutMs: 1_000,
      streamConnectionRegistry: harness.streamConnectionRegistry,
    });
    const finishInFlightIngest = harness.appLifecycle.tryStartIngestRequest();

    expect(finishInFlightIngest).not.toBeNull();

    const shutdownPromise = shutdown("SIGTERM");
    let shutdownSettled = false;
    void shutdownPromise.then(() => {
      shutdownSettled = true;
      return undefined;
    });

    const rejectedResponse = await harness.app.request("/health");

    expect(rejectedResponse.status).toBe(503);
    await expect(rejectedResponse.json()).resolves.toEqual({
      error: {
        code: "SERVER_SHUTTING_DOWN",
        message: "server is shutting down",
      },
    });
    expect(shutdownSettled).toBe(false);

    finishInFlightIngest!();

    await shutdownPromise;

    expect(server.close).toHaveBeenCalledOnce();
    expect(server.closeIdleConnections).toHaveBeenCalledOnce();
    expect(closeDb).toHaveBeenCalledOnce();
    expect(exitCodes).toEqual([0]);
  });
});
