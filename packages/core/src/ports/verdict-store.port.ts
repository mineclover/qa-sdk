// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { VerdictReport } from "../types/verdict.js";

/** VerdictReport 저장소 계약 */
export interface VerdictStore {
  insert(params: VerdictInsert): Promise<void>;
  removeByScenarioAndTrace(scenarioId: string, traceId: string): Promise<boolean>;
  findByScenarioAndTrace(scenarioId: string, traceId: string): Promise<StoredVerdict | null>;
  findByTraceId(traceId: string): Promise<StoredVerdict[]>;
  findBySessionId(sessionId: string): Promise<StoredVerdict[]>;
}

export interface VerdictInsert {
  id: string;
  scenarioId: string;
  traceId: string;
  qaSessionId?: string;
  overallVerdict: string;
  report: VerdictReport;
}

export interface StoredVerdict extends VerdictInsert {
  computedAt: Date;
}
