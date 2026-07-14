// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { RuntimeGraph } from '../types/graph.js';

/** RuntimeGraph 저장소 계약 */
export interface GraphStore {
  upsert(traceId: string, graph: RuntimeGraph): Promise<void>;
  findByTraceId(traceId: string): Promise<RuntimeGraph | null>;
}
