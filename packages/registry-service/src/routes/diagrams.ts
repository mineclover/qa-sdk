/**
 * /api/diagrams — DKG 기반 Mermaid 다이어그램 API.
 *
 * DKG graph에서 실시간으로 다이어그램을 생성하여 반환.
 * DevDkgProvider에서 graph를 가져오고, spec-core/viz의 다이어그램 함수를 동적 import.
 */
import { Hono } from "hono";
import type { GraphRegistryPort } from "../types/spec-core-ports.js";

type MermaidDiagramOptions = { showInvariants?: boolean };

interface DiagramFns {
  listAllDiagrams(graph: GraphRegistryPort, topo?: ServiceTopologyLike): Record<string, unknown>;
  intentLinkDiagram(graph: GraphRegistryPort, intentLinkId: string, options?: MermaidDiagramOptions): string;
  allIntentLinksDiagram(graph: GraphRegistryPort, options?: MermaidDiagramOptions): string;
  dslDiagram(graph: GraphRegistryPort, dslId: string, options?: MermaidDiagramOptions): string;
  domainDiagram(graph: GraphRegistryPort, domainId: string, options?: MermaidDiagramOptions): string;
  serviceDiagram(graph: GraphRegistryPort, topo: ServiceTopologyLike, serviceId: string, options?: MermaidDiagramOptions): string;
  constraintDiagram(graph: GraphRegistryPort, constraintId: string, options?: MermaidDiagramOptions): string;
  tableDiagram(graph: GraphRegistryPort, tableId: string, options?: MermaidDiagramOptions): string;
  observationLoopDiagram(graph: GraphRegistryPort, options?: MermaidDiagramOptions): string;
  tableErDiagram(graph: GraphRegistryPort, options?: MermaidDiagramOptions): string;
  transitionSpecDiagram(graph: GraphRegistryPort, specId: string, options?: MermaidDiagramOptions): string;
  transitionDagDiagram(graph: GraphRegistryPort, options?: MermaidDiagramOptions): string;
}

interface ServiceTopologyLike {
  listServices(): ReadonlyArray<{ serviceId: string; name: string; ownedPrefixes: readonly string[] }>;
  getConsumers(prefixId: string): string[];
}

interface AnalysisDiagramModule {
  createDemoTopology(): ServiceTopologyLike;
}

export interface DiagramRouteDeps {
  getGraph: () => GraphRegistryPort;
}

export function createDiagramRoutes(deps: DiagramRouteDeps) {
  const app = new Hono();
  let vizFns: DiagramFns | null = null;
  let cachedTopo: ServiceTopologyLike | null = null;

  async function getViz(): Promise<DiagramFns | null> {
    if (vizFns) return vizFns;
    try {
      const mod = await import("@qa-sdk/spec-core/viz");
      vizFns = mod as unknown as DiagramFns;
      return vizFns;
    } catch {
      return null;
    }
  }

  async function getTopo(): Promise<ServiceTopologyLike | undefined> {
    if (cachedTopo) return cachedTopo;
    try {
      const analysis = await import("@qa-sdk/spec-core/analysis") as unknown as AnalysisDiagramModule;
      cachedTopo = analysis.createDemoTopology();
      return cachedTopo ?? undefined;
    } catch {
      return undefined;
    }
  }

  // GET /api/diagrams — list all available diagrams
  app.get("/", async (c) => {
    const viz = await getViz();
    if (!viz) return c.json({ error: "spec-core/viz not available" }, 503);
    const graph = deps.getGraph();
    if (!graph) return c.json({ error: "DKG graph not initialized" }, 503);
    const topo = await getTopo();
    const diagrams = viz.listAllDiagrams(graph, topo);
    return c.json(diagrams);
  });

  // GET /api/diagrams/:kind/:id — get specific diagram mmd
  app.get("/:kind/:id", async (c) => {
    const viz = await getViz();
    if (!viz) return c.json({ error: "spec-core/viz not available" }, 503);
    const graph = deps.getGraph();
    if (!graph) return c.json({ error: "DKG graph not initialized" }, 503);
    const { kind, id } = c.req.param();
    const topo = await getTopo();
    const opts = { showInvariants: c.req.query("invariants") !== "false" };

    try {
      let mmd: string;
      switch (kind) {
        case "intent-links":
          mmd = id === "__all__"
            ? viz.allIntentLinksDiagram(graph, opts)
            : viz.intentLinkDiagram(graph, id, opts);
          break;
        case "dsl":
          mmd = viz.dslDiagram(graph, id, opts);
          break;
        case "domain":
          mmd = viz.domainDiagram(graph, id, opts);
          break;
        case "service":
          if (!topo) return c.json({ error: "topology not available" }, 503);
          mmd = viz.serviceDiagram(graph, topo, id, opts);
          break;
        case "constraint":
          mmd = viz.constraintDiagram(graph, id, opts);
          break;
        case "table":
          mmd = viz.tableDiagram(graph, id, opts);
          break;
        case "observation-loop":
          mmd = viz.observationLoopDiagram(graph, opts);
          break;
        case "table-er":
          mmd = viz.tableErDiagram(graph, opts);
          break;
        case "transition-spec":
          mmd = viz.transitionSpecDiagram(graph, id, opts);
          break;
        case "transition-dag":
          mmd = viz.transitionDagDiagram(graph, opts);
          break;
        default:
          return c.json({ error: `Unknown diagram kind: ${kind}` }, 400);
      }
      return c.json({ kind, id, mmd });
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "diagram generation failed" }, 400);
    }
  });

  return app;
}
