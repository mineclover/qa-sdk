/** QA Session 저장소 계약 */
export interface SessionStore {
  upsert(params: SessionUpsert): Promise<void>;
  findById(sessionId: string): Promise<StoredSession | null>;
  close(sessionId: string): Promise<void>;
}

export interface SessionUpsert {
  sessionId: string;
  scenarioId?: string;
  labels?: Record<string, string>;
}

export interface StoredSession {
  sessionId: string;
  scenarioId: string | null;
  labels: Record<string, string> | null;
  startedAt: Date;
  closedAt: Date | null;
}
