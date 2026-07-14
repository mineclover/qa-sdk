// @def.boundary ingest-system
// @def.doc ingest-system

import { eq } from 'drizzle-orm';
import type { GraphStore } from '@qa-sdk/core';
import type { RuntimeGraph } from '@qa-sdk/core';
import { runtimeGraphs } from '../db/schema.js';
import type { D1Db } from './d1-db-type.js';

export class D1GraphStore implements GraphStore {
  constructor(private readonly db: D1Db) {}

  async upsert(traceId: string, graph: RuntimeGraph): Promise<void> {
    const nodes = graph.nodes?.length ?? 0;
    const edges = graph.edges?.length ?? 0;
    await this.db
      .insert(runtimeGraphs)
      .values({
        traceId,
        graph: JSON.stringify(graph),
        nodeCount: nodes,
        edgeCount: edges,
        builtAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: runtimeGraphs.traceId,
        set: {
          graph: JSON.stringify(graph),
          nodeCount: nodes,
          edgeCount: edges,
          builtAt: new Date().toISOString(),
        },
      });
  }

  async findByTraceId(traceId: string): Promise<RuntimeGraph | null> {
    const [row] = await this.db
      .select()
      .from(runtimeGraphs)
      .where(eq(runtimeGraphs.traceId, traceId));
    if (!row) return null;
    try {
      return JSON.parse(row.graph) as RuntimeGraph;
    } catch {
      return null;
    }
  }
}
