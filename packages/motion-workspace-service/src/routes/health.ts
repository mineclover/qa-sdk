// @def.boundary motion-workspace-service-spec
import { Hono } from "hono";
import type { MotionWorkspaceController } from "../controller.js";

export interface MotionWorkspaceHealthRouteDeps {
  readonly controller: MotionWorkspaceController;
}

export function createHealthRoutes(
  deps: MotionWorkspaceHealthRouteDeps,
) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json(deps.controller.health());
  });

  return app;
}
