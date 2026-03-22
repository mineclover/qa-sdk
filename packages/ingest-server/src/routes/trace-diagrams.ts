/**
 * /v1/traces/diagrams — TracePath 기반 Mermaid 시퀀스 다이어그램 API.
 */
import { Hono } from "hono";
import type { Logger } from "pino";

export interface TraceDiagramDeps {
  recordStore: { findByTraceId(traceId: string): Promise<Array<{ traceId: string; timestamp: Date; addressContext?: Record<string, string> }>> };
  logger: Logger;
}

export function createTraceDiagramRoutes(deps: TraceDiagramDeps) {
  const app = new Hono();

  // GET /v1/traces/recent-diagrams — list recent trace IDs
  app.get("/recent-diagrams", async (c) => {
    // This would need a separate query to get distinct recent traceIds
    // For now, return a hint
    return c.json({ hint: "Use GET /v1/traces/:traceId/diagram to get a specific trace diagram" });
  });

  // GET /v1/traces/:traceId/diagram — generate mermaid for a trace
  app.get("/:traceId/diagram", async (c) => {
    const traceId = c.req.param("traceId");
    try {
      const records = await deps.recordStore.findByTraceId(traceId);
      if (!records || records.length === 0) {
        return c.json({ error: "trace not found" }, 404);
      }

      // Dynamic import to avoid hard dep on spec-core
      const [vizMod, layerMod] = await Promise.all([
        import("@qa-sdk/spec-core/viz").catch(() => null),
        import("@qa-sdk/spec-core/viz").catch(() => null),
      ]);

      if (!vizMod || !layerMod) {
        return c.json({ error: "spec-core/viz not available" }, 503);
      }

      const { traceSequenceDiagram } = vizMod as any;
      const { extractTracePaths, buildLayerMap } = layerMod as any;

      // Build layer map (static, from catalog shape)
      // We need a catalog — try to import demo-snapshot
      let catalog: any;
      try {
        catalog = (await import("demo-snapshot")).DEMO_CATALOG;
      } catch {
        return c.json({ error: "catalog not available" }, 503);
      }

      const layerMap = buildLayerMap(catalog);
      const traceRecords = records
        .filter((r: any) => r.addressContext && Object.keys(r.addressContext).length > 0)
        .map((r: any) => ({ traceId: r.traceId, timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp, addressContext: r.addressContext }));

      if (traceRecords.length === 0) {
        return c.json({ error: "no address_context data in trace" }, 404);
      }

      const paths = extractTracePaths(traceRecords, layerMap);
      const path = paths[0];
      if (!path) {
        return c.json({ error: "could not extract trace path" }, 404);
      }

      const mmd = traceSequenceDiagram(path);
      return c.json({ traceId, mmd, steps: path.steps.length, duration: path.duration });
    } catch (err: any) {
      deps.logger.error({ err, traceId }, "trace diagram generation failed");
      return c.json({ error: err?.message ?? "failed" }, 500);
    }
  });

  return app;
}
