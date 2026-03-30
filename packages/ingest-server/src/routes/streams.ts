import { Hono, type Context } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import type { StoredRecord } from "@qa-sdk/core";
import {
  RecordStreamBrokerShutdownError,
  type RecordStreamBroker,
} from "../lib/record-stream-broker.js";
import type { StreamConnectionRegistry } from "../lib/stream-connection-registry.js";
import { respondServerShuttingDown } from "../middleware/shutdown.js";

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_PAYLOAD = ": heartbeat\n\n";
const DEFAULT_STREAM_SUBSCRIPTION_LIMIT = 10;

export interface StreamDeps {
  recordStreamBroker: RecordStreamBroker;
  subscriptionLimit?: number;
  streamConnectionRegistry: StreamConnectionRegistry;
}

export function createStreamRoutes(deps: StreamDeps) {
  const app = new Hono();
  const subscriptionLimit =
    deps.subscriptionLimit ?? DEFAULT_STREAM_SUBSCRIPTION_LIMIT;

  app.get("/v1/streams/traces/:traceId", (c) => {
    return handleStreamRequest(c, {
      getSubscriberCount: deps.recordStreamBroker.getTraceSubscriberCount.bind(
        deps.recordStreamBroker,
      ),
      id: c.req.param("traceId"),
      recordStreamBroker: deps.recordStreamBroker,
      scope: "trace",
      streamConnectionRegistry: deps.streamConnectionRegistry,
      subscriptionLimit,
      subscribe: deps.recordStreamBroker.subscribeToTrace.bind(
        deps.recordStreamBroker,
      ),
    });
  });

  app.get("/v1/streams/sessions/:sessionId", (c) => {
    return handleStreamRequest(c, {
      getSubscriberCount: deps.recordStreamBroker.getSessionSubscriberCount.bind(
        deps.recordStreamBroker,
      ),
      id: c.req.param("sessionId"),
      recordStreamBroker: deps.recordStreamBroker,
      scope: "session",
      streamConnectionRegistry: deps.streamConnectionRegistry,
      subscriptionLimit,
      subscribe: deps.recordStreamBroker.subscribeToSession.bind(
        deps.recordStreamBroker,
      ),
    });
  });

  return app;
}

function handleStreamRequest(
  c: Context,
  options: {
    getSubscriberCount: (id: string) => number;
    id: string;
    recordStreamBroker: RecordStreamBroker;
    scope: "trace" | "session";
    streamConnectionRegistry: StreamConnectionRegistry;
    subscriptionLimit: number;
    subscribe: (
      id: string,
      listener: (record: StoredRecord) => void | Promise<void>,
    ) => () => void;
  },
) {
  if (
    options.streamConnectionRegistry.isShuttingDown() ||
    options.recordStreamBroker.isShuttingDown()
  ) {
    return respondServerShuttingDown(c);
  }

  if (options.getSubscriberCount(options.id) >= options.subscriptionLimit) {
    return tooManySubscriptions(
      c,
      options.scope,
      options.id,
      options.subscriptionLimit,
    );
  }

  return streamSSE(c, async (stream) => {
    const writer = createStreamWriter(stream);
    let releaseConnection = () => {};
    let stopHeartbeat = () => {};
    let unsubscribe = () => {};
    let settled = false;
    let resolveClosed = () => {};
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });

    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      stopHeartbeat();
      releaseConnection();
      unsubscribe();
      resolveClosed();
    };

    const releaseRegisteredConnection =
      options.streamConnectionRegistry.register({
        close: async (reason) => {
          await writer.writeClose(reason);
          cleanup();
          await stream.close();
        },
      });

    if (!releaseRegisteredConnection) {
      await writer.writeClose("server_shutdown");
      await stream.close();
      return;
    }

    releaseConnection = releaseRegisteredConnection;

    try {
      unsubscribe = options.subscribe(options.id, writer.writeRecord);
    } catch (error) {
      cleanup();

      if (error instanceof RecordStreamBrokerShutdownError) {
        await writer.writeClose("server_shutdown");
        await stream.close();
        return;
      }

      throw error;
    }

    stopHeartbeat = startHeartbeat(writer);
    stream.onAbort(cleanup);

    await closed;
  });
}

function tooManySubscriptions(
  c: Context,
  scope: "trace" | "session",
  id: string,
  limit: number,
) {
  return c.json(
    {
      error: {
        code: "TOO_MANY_SUBSCRIPTIONS",
        message: `too many active SSE subscriptions for ${scope} '${id}' (limit: ${limit})`,
      },
    },
    429,
  );
}

function createStreamWriter(stream: SSEStreamingApi) {
  let writeChain = Promise.resolve();
  let closing = false;

  const enqueueWrite = (write: () => Promise<unknown>) => {
    writeChain = writeChain.then(async () => {
      if (stream.aborted || stream.closed) {
        return undefined;
      }

      try {
        await write();
      } catch {
        // Transport errors are expected once clients disconnect.
      }
      return undefined;
    });

    return writeChain;
  };

  return {
    writeHeartbeat: () => {
      if (closing) {
        return writeChain;
      }

      return enqueueWrite(() => stream.write(HEARTBEAT_PAYLOAD));
    },
    writeRecord: (record: StoredRecord) => {
      if (closing) {
        return writeChain;
      }

      return enqueueWrite(() =>
        stream.writeSSE({
          event: "record",
          data: JSON.stringify(record),
        }),
      );
    },
    writeClose: (reason: string) => {
      if (closing) {
        return writeChain;
      }

      closing = true;
      return enqueueWrite(() =>
        stream.writeSSE({
          event: "close",
          data: JSON.stringify({ reason }),
        }),
      );
    },
  };
}

function startHeartbeat(writer: ReturnType<typeof createStreamWriter>) {
  const timer = setInterval(() => {
    void writer.writeHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(timer);
  };
}
