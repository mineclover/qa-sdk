// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from "@nestjs/common";
import type { CatalogStore } from "../../stores/catalog-store.js";
import type { AxisProfileStore } from "../../stores/axis-profile-store.js";
import { CATALOG_STORE } from "../catalog/catalog.service.js";
import { AXIS_STORE } from "../axes/axis.service.js";

function gauge(
  name: string,
  value: number,
  help?: string,
  labels: Record<string, string> = {},
) {
  const lines: string[] = [];
  if (help) {
    lines.push(`# HELP ${name} ${help}`);
  }
  lines.push(`# TYPE ${name} gauge`);
  const labelString = Object.keys(labels).length > 0
    ? `{${Object.entries(labels).map(([key, currentValue]) => `${key}="${currentValue}"`).join(",")}}`
    : "";
  lines.push(`${name}${labelString} ${value}`);
  return lines;
}

@Injectable()
export class MetricsService {
  constructor(
    @Optional() @Inject(CATALOG_STORE) private readonly catalogStore?: CatalogStore,
    @Optional() @Inject(AXIS_STORE) private readonly axisStore?: AxisProfileStore,
  ) {}

  async render() {
    const lines: string[] = [];
    lines.push(
      ...gauge("process_uptime_seconds", Math.round(process.uptime()), "Process uptime in seconds"),
    );

    const memory = process.memoryUsage();
    lines.push(...gauge("process_heap_used_bytes", memory.heapUsed, "Process heap used bytes"));
    lines.push(...gauge("process_rss_bytes", memory.rss, "Process resident set size bytes"));

    if (this.catalogStore) {
      try {
        const catalogs = await this.catalogStore.list();
        lines.push(...gauge("registry_catalogs_total", catalogs.length, "Total registered catalogs"));
      } catch {
        lines.push(...gauge("registry_catalogs_total", -1, "Total registered catalogs"));
      }
    }

    if (this.catalogStore && this.axisStore) {
      try {
        const catalogs = await this.catalogStore.list();
        let totalAxes = 0;
        for (const catalog of catalogs) {
          const axes = await this.axisStore.list(catalog.id);
          totalAxes += axes.length;
        }
        lines.push(...gauge("registry_axes_total", totalAxes, "Total registered axis profiles"));
      } catch {
        lines.push(...gauge("registry_axes_total", -1, "Total registered axis profiles"));
      }
    }

    return `${lines.join("\n")}\n`;
  }
}
