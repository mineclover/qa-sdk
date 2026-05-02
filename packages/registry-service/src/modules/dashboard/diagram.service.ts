// @def.boundary registry-system
// @def.doc registry-system

import { AppError } from "@qa-sdk/core";
import type { DevDkgProvider } from "../../lib/dev-dkg-provider.js";
import type { GraphRegistryPort } from "../../types/spec-core-ports.js";

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

export interface DiagramServiceDeps {
  provider?: DevDkgProvider;
  getGraph?: () => GraphRegistryPort;
}

export class DiagramService {
  private vizFns: DiagramFns | null = null;
  private cachedTopo: ServiceTopologyLike | null = null;

  constructor(private readonly deps: DiagramServiceDeps) {}

  static fromDeps(deps: DiagramServiceDeps) {
    return new DiagramService(deps);
  }

  async list() {
    const viz = await this.getViz();
    const topo = await this.getTopo();
    return viz.listAllDiagrams(this.getGraph(), topo);
  }

  async get(kind: string, id: string, showInvariants = true) {
    const viz = await this.getViz();
    const graph = this.getGraph();
    const topo = await this.getTopo();
    const opts = { showInvariants };

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
          if (!topo) {
            throw new AppError("SERVICE_UNAVAILABLE", "topology not available", 503);
          }
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
          throw new AppError("INVALID_INPUT", `Unknown diagram kind: ${kind}`, 400);
      }
      return { kind, id, mmd };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("INVALID_INPUT", error instanceof Error ? error.message : "diagram generation failed", 400);
    }
  }

  private getGraph() {
    const graph = this.deps.provider?.getGraph() ?? this.deps.getGraph?.();
    if (!graph) {
      throw new AppError("SERVICE_UNAVAILABLE", "DKG graph not initialized", 503);
    }
    return graph;
  }

  private async getViz(): Promise<DiagramFns> {
    if (this.vizFns) return this.vizFns;
    try {
      const mod = await import("@qa-sdk/spec-core/viz");
      this.vizFns = mod as unknown as DiagramFns;
      return this.vizFns;
    } catch {
      throw new AppError("SERVICE_UNAVAILABLE", "spec-core/viz not available", 503);
    }
  }

  private async getTopo(): Promise<ServiceTopologyLike | undefined> {
    if (this.cachedTopo) return this.cachedTopo;
    try {
      const analysis = await import("@qa-sdk/spec-core/dkg") as unknown as AnalysisDiagramModule;
      this.cachedTopo = analysis.createDemoTopology();
      return this.cachedTopo ?? undefined;
    } catch {
      return undefined;
    }
  }
}
