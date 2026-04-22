// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { proxyRequest } from "../lib/proxy.js";

export interface ProxyTarget {
  path: string; // gateway prefix (예: "/projects")
  serviceKey: string; // targets map의 키 (예: "sim-pm-api")
  description: string;
}

export const PROXY_TARGETS: readonly ProxyTarget[] = [
  { path: "/projects", serviceKey: "sim-pm-api", description: "PM domain" },
  { path: "/approvals", serviceKey: "sim-approval-api", description: "Approval workflows" },
  { path: "/notifications", serviceKey: "sim-notification-api", description: "Notifications" },
  { path: "/reports", serviceKey: "sim-reporting-api", description: "Reporting" },
  { path: "/documents", serviceKey: "sim-document-api", description: "Documents" },
  { path: "/audit", serviceKey: "sim-audit-browser-api", description: "Audit explorer" },
];

export interface CreateProxyRoutesOptions {
  /** serviceKey → base URL. PROXY_TARGETS의 모든 serviceKey가 등록되어야 함. */
  targets: Record<string, string>;
  timeoutMs: number;
}

export function createProxyRoutes(opts: CreateProxyRoutesOptions) {
  const r = new Hono();
  for (const target of PROXY_TARGETS) {
    const base = opts.targets[target.serviceKey];
    if (!base) {
      throw new Error(
        `createProxyRoutes: target ${target.serviceKey} URL missing`,
      );
    }
    r.all(`${target.path}/*`, async (c) => {
      const url = new URL(c.req.url);
      return proxyRequest({
        targetBaseUrl: base,
        sourcePath: url.pathname + url.search,
        request: c.req.raw,
        timeoutMs: opts.timeoutMs,
      });
    });
    r.all(target.path, async (c) => {
      const url = new URL(c.req.url);
      return proxyRequest({
        targetBaseUrl: base,
        sourcePath: url.pathname + url.search,
        request: c.req.raw,
        timeoutMs: opts.timeoutMs,
      });
    });
  }
  return r;
}
