import { Hono } from "hono";
import {
  createMotionWorkspaceController,
  type MotionWorkspaceControllerDeps,
} from "./controller.js";
import {
  createErrorHandler,
  type MotionWorkspaceServiceLogger,
} from "./error-handler.js";
import type { MotionWorkspaceRepository } from "./repository.js";
import { createMotionWorkspaceRepository } from "./sqlite-repository.js";
import { createHealthRoutes } from "./routes/health.js";
import { createWorkspaceRoutes } from "./routes/workspaces.js";

export interface MotionWorkspaceAppDeps
  extends Omit<MotionWorkspaceControllerDeps, "repository"> {
  readonly repository?: MotionWorkspaceRepository;
  readonly logger?: MotionWorkspaceServiceLogger;
}

export function createApp(deps: MotionWorkspaceAppDeps = {}) {
  const app = new Hono();
  const controller = createMotionWorkspaceController({
    repository: deps.repository ?? createMotionWorkspaceRepository(),
    getUptimeSeconds: deps.getUptimeSeconds,
    getNow: deps.getNow,
    version: deps.version,
  });

  app.route("/", createHealthRoutes({ controller }));
  app.route("/", createWorkspaceRoutes({ controller }));
  app.onError(createErrorHandler(deps.logger ?? console));

  return app;
}
