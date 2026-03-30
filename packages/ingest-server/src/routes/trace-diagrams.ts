/**
 * /v1/traces/diagrams — TracePath 기반 Mermaid 시퀀스 다이어그램 API.
 */
import { Hono } from "hono";
import type { Logger } from "pino";
import type { RecordStore } from "@qa-sdk/core";

export interface TraceDiagramDeps {
  recordStore: RecordStore;
  logger: Logger;
}

// spec-core/viz 동적 import 타입
interface VizModule {
  traceSequenceDiagram: (trace: { traceId: string; steps: readonly unknown[]; duration: number }) => string;
  extractTracePaths: (records: readonly unknown[], layerMap: unknown) => Array<{ traceId: string; steps: readonly unknown[]; duration: number; layerPath: readonly number[] }>;
  buildLayerMap: (catalog: unknown) => unknown;
}

export function createTraceDiagramRoutes(deps: TraceDiagramDeps) {
  const app = new Hono();

  let vizCache: VizModule | null = null;

  async function loadViz(): Promise<VizModule | null> {
    if (vizCache) return vizCache;
    try {
      vizCache = await import("@qa-sdk/spec-core/viz") as unknown as VizModule;
      return vizCache;
    } catch { return null; }
  }

  app.get("/recent-diagrams", async (c) => {
    return c.json({ hint: "Use GET /v1/traces/:traceId/diagram to get a specific trace diagram" });
  });

  app.get("/:traceId/diagram", async (c) => {
    const traceId = c.req.param("traceId");
    try {
      const records = await deps.recordStore.findByTraceId(traceId);
      if (!records || records.length === 0) {
        return c.json({ error: "trace not found" }, 404);
      }

      const viz = await loadViz();
      if (!viz) return c.json({ error: "spec-core/viz not available" }, 503);

      let catalog: unknown;
      try {
        catalog = (await import("demo-snapshot")).DEMO_CATALOG;
      } catch {
        return c.json({ error: "catalog not available" }, 503);
      }

      const layerMap = viz.buildLayerMap(catalog);
      const traceRecords = records
        .filter(r => r.addressContext && Object.keys(r.addressContext).length > 0)
        .map(r => ({
          traceId: r.traceId ?? traceId,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
          addressContext: r.addressContext ?? {},
        }));

      if (traceRecords.length === 0) {
        return c.json({ error: "no address_context data in trace" }, 404);
      }

      const paths = viz.extractTracePaths(traceRecords, layerMap);
      const path = paths[0];
      if (!path) {
        return c.json({ error: "could not extract trace path" }, 404);
      }

      const mmd = viz.traceSequenceDiagram(path);
      return c.json({ traceId, mmd, steps: path.steps.length, duration: path.duration });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "failed";
      deps.logger.error({ err, traceId }, "trace diagram generation failed");
      return c.json({ error: msg }, 500);
    }
  });

  return app;
}
