import type { RuntimeGraph } from "../types/graph.js";

/** RuntimeGraph 저장소 계약 */
export interface GraphStore {
  upsert(traceId: string, graph: RuntimeGraph): Promise<void>;
  findByTraceId(traceId: string): Promise<RuntimeGraph | null>;
}
