import type { VerdictReport } from "../types/verdict.js";

/** VerdictReport 저장소 계약 */
export interface VerdictStore {
  insert(params: VerdictInsert): Promise<void>;
  findByScenarioAndTrace(scenarioId: string, traceId: string): Promise<StoredVerdict | null>;
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
