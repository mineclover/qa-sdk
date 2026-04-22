// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

const ROUTES: Array<{ path: string; targetService: string }> = [
  { path: "/auth", targetService: "sim-auth-api" },
  { path: "/projects", targetService: "sim-pm-api" },
  { path: "/approvals", targetService: "sim-approval-api" },
  { path: "/notifications", targetService: "sim-notification-api" },
  { path: "/reports", targetService: "sim-reporting-api" },
  { path: "/documents", targetService: "sim-document-api" },
  { path: "/audit", targetService: "sim-audit-browser-api" },
];

export function createPlaceholderRoutes() {
  const r = new Hono();
  for (const { path, targetService } of ROUTES) {
    r.all(`${path}/*`, (c) =>
      c.json(
        {
          error: "not-implemented",
          message: `Plan 12a will implement routing to ${targetService}`,
          targetService,
          path: c.req.path,
        },
        503,
      ),
    );
  }
  return r;
}

export const PLACEHOLDER_ROUTES = ROUTES;
