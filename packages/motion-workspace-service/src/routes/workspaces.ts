import { Hono } from "hono";
import type { Context } from "hono";
import type { MotionWorkspaceController } from "../controller.js";
import { createInvalidJsonError } from "../errors.js";

async function parseJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw createInvalidJsonError(reason);
  }
}

export interface MotionWorkspaceRouteDeps {
  readonly controller: MotionWorkspaceController;
}

export function createWorkspaceRoutes(
  deps: MotionWorkspaceRouteDeps,
) {
  const app = new Hono();

  app.get("/workspaces", async (c) => {
    return c.json(await deps.controller.listWorkspaces());
  });

  app.get("/workspaces/:id", async (c) => {
    return c.json(await deps.controller.getWorkspace(c.req.param("id")));
  });

  app.put("/workspaces/:id", async (c) => {
    const body = await parseJsonBody(c);
    return c.json(await deps.controller.createWorkspace(c.req.param("id"), body));
  });

  app.post("/workspaces/:id", async (c) => {
    const body = await parseJsonBody(c);
    return c.json(await deps.controller.updateWorkspace(c.req.param("id"), body));
  });

  app.post("/workspaces/:id/apply-command", async (c) => {
    const body = await parseJsonBody(c);
    return c.json(await deps.controller.applyCommand(c.req.param("id"), body));
  });

  app.delete("/workspaces/:id", async (c) => {
    await deps.controller.deleteWorkspace(c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
