import type { GraphStore, RuntimeGraph } from "@qa-sdk/core";

/** GraphStore의 in-memory 구현 */
export class InMemoryGraphStore implements GraphStore {
  private readonly graphs = new Map<string, RuntimeGraph>();

  async upsert(traceId: string, graph: RuntimeGraph): Promise<void> {
    this.graphs.set(traceId, structuredClone(graph));
  }

  async findByTraceId(traceId: string): Promise<RuntimeGraph | null> {
    const graph = this.graphs.get(traceId);
    return graph ? structuredClone(graph) : null;
  }
}
