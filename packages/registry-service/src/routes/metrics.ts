import { Hono } from "hono";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { AxisProfileStore } from "../stores/axis-profile-store.js";

export interface MetricsRouteDeps {
  catalogStore?: CatalogStore;
  axisStore?: AxisProfileStore;
  getUptimeSeconds?: () => number;
}

function gauge(
  name: string,
  value: number,
  help?: string,
  labels: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  if (help) lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  const labelStr =
    Object.keys(labels).length > 0
      ? `{${Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",")}}`
      : "";
  lines.push(`${name}${labelStr} ${value}`);
  return lines;
}

export function createMetricsRoutes(deps: MetricsRouteDeps) {
  const routes = new Hono();
  const getUptimeSeconds = deps.getUptimeSeconds ?? (() => process.uptime());

  routes.get("/metrics", async (c) => {
    const lines: string[] = [];

    // ── process metrics ──
    lines.push(
      ...gauge(
        "process_uptime_seconds",
        Math.round(getUptimeSeconds()),
        "Process uptime in seconds",
      ),
    );

    const mem = process.memoryUsage();
    lines.push(
      ...gauge("process_heap_used_bytes", mem.heapUsed, "Process heap used bytes"),
    );
    lines.push(
      ...gauge("process_rss_bytes", mem.rss, "Process resident set size bytes"),
    );

    // ── catalog count ──
    if (deps.catalogStore) {
      try {
        const catalogs = await deps.catalogStore.list();
        lines.push(
          ...gauge(
            "registry_catalogs_total",
            catalogs.length,
            "Total registered catalogs",
          ),
        );
      } catch {
        lines.push(
          ...gauge("registry_catalogs_total", -1, "Total registered catalogs"),
        );
      }
    }

    // ── axis count (카탈로그별 집계) ──
    if (deps.axisStore && deps.catalogStore) {
      try {
        const catalogs = await deps.catalogStore.list();
        let totalAxes = 0;
        for (const catalog of catalogs) {
          const axes = await deps.axisStore.list(catalog.id);
          totalAxes += axes.length;
        }
        lines.push(
          ...gauge(
            "registry_axes_total",
            totalAxes,
            "Total registered axis profiles",
          ),
        );
      } catch {
        lines.push(
          ...gauge("registry_axes_total", -1, "Total registered axis profiles"),
        );
      }
    }

    return c.text(lines.join("\n") + "\n", 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  return routes;
}
