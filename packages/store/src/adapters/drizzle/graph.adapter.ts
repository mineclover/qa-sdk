// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { eq } from "drizzle-orm";
import type { GraphStore } from "@qa-sdk/core";
import type { RuntimeGraph } from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { runtimeGraphs } from "../../db/schema.js";

/** GraphStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleGraphStore implements GraphStore {
  constructor(private readonly db: DbExecutor) {}

  async upsert(traceId: string, graph: RuntimeGraph): Promise<void> {
    const existing = await this.findByTraceId(traceId);

    if (existing) {
      await this.db
        .update(runtimeGraphs)
        .set({
          graph,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          builtAt: new Date(),
        })
        .where(eq(runtimeGraphs.traceId, traceId))
        .comment({ adapter: "GraphStore", method: "upsert.update" });
      return;
    }

    await this.db.insert(runtimeGraphs).values({
      traceId,
      graph,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }).comment({ adapter: "GraphStore", method: "upsert.insert" });
  }

  async findByTraceId(traceId: string): Promise<RuntimeGraph | null> {
    const [row] = await this.db
      .select()
      .from(runtimeGraphs)
      .where(eq(runtimeGraphs.traceId, traceId))
      .comment({ adapter: "GraphStore", method: "findByTraceId" });
    return row?.graph ?? null;
  }
}
