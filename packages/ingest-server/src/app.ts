import { Hono } from "hono";
import type { RecordStore, TraceStore, TransmissionStore, SessionStore } from "@qa-sdk/core";
import healthRoutes from "./routes/health.js";
import { createIngestRoutes } from "./routes/ingest.js";
import { errorHandler } from "./middleware/error-handler.js";

export interface AppDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  transmissionStore: TransmissionStore;
  sessionStore: SessionStore;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.onError(errorHandler);

  app.route("/", healthRoutes);
  app.route("/", createIngestRoutes(deps));

  return app;
}
