import type { ServerType } from "@hono/node-server";
import type { Logger } from "pino";
import type { AppLifecycle } from "./app-lifecycle.js";
import type { RecordStreamBroker } from "./record-stream-broker.js";
import type { StreamConnectionRegistry } from "./stream-connection-registry.js";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

type ExitFn = (code: number) => never | void;
type SignalHandler = () => void;
type SignalRegistrar = {
  on: (signal: NodeJS.Signals, listener: SignalHandler) => unknown;
};

export interface GracefulShutdownDeps {
  appLifecycle: AppLifecycle;
  closeDb: () => Promise<void>;
  exit?: ExitFn;
  logger: Logger;
  process?: SignalRegistrar;
  recordStreamBroker: RecordStreamBroker;
  server: ServerType;
  shutdownTimeoutMs?: number;
  streamConnectionRegistry: StreamConnectionRegistry;
}

export function installGracefulShutdown(
  deps: GracefulShutdownDeps,
) {
  const exit = deps.exit ?? process.exit;
  const signalRegistrar = deps.process ?? process;
  const shutdownTimeoutMs =
    deps.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (signal: NodeJS.Signals | string) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = performShutdown(signal);
    return shutdownPromise;
  };

  const performShutdown = async (signal: NodeJS.Signals | string) => {
    deps.logger.info({ signal }, "shutdown requested");
    deps.appLifecycle.beginShutdown();

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      deps.logger.error(
        {
          activeSseConnections: deps.streamConnectionRegistry.getConnectionCount(),
          inFlightIngestRequests:
            deps.appLifecycle.getInFlightIngestRequestCount(),
          timeoutMs: shutdownTimeoutMs,
        },
        "shutdown timed out",
      );
      closeAllConnections(deps.server);
      exit(1);
    }, shutdownTimeoutMs);

    try {
      const serverClosed = closeServer(deps.server);
      closeIdleConnections(deps.server);

      await deps.streamConnectionRegistry.shutdown("server_shutdown");
      deps.recordStreamBroker.shutdown();

      await Promise.all([
        serverClosed,
        deps.appLifecycle.waitForInFlightIngestRequests(),
      ]);

      await deps.closeDb();

      if (timedOut) {
        return;
      }

      clearTimeout(timeout);
      deps.logger.info("shutdown complete");
      exit(0);
    } catch (err) {
      if (!timedOut) {
        clearTimeout(timeout);
        deps.logger.error({ err }, "error during shutdown");
        exit(1);
      }
    }
  };

  signalRegistrar.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  signalRegistrar.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  return { shutdown };
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function closeIdleConnections(server: ServerType) {
  if (
    "closeIdleConnections" in server &&
    typeof server.closeIdleConnections === "function"
  ) {
    server.closeIdleConnections();
  }
}

function closeAllConnections(server: ServerType) {
  if (
    "closeAllConnections" in server &&
    typeof server.closeAllConnections === "function"
  ) {
    server.closeAllConnections();
  }
}
