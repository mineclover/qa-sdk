// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** QA Session 저장소 계약 */
export interface SessionStore {
  upsert(params: SessionUpsert): Promise<void>;
  findById(sessionId: string): Promise<StoredSession | null>;
  findByScenarioId(scenarioId: string, limit?: number): Promise<StoredSession[]>;
  close(sessionId: string): Promise<void>;
}

export interface SessionUpsert {
  sessionId: string;
  scenarioId?: string;
  labels?: Record<string, string>;
  actorId?: string;
  userId?: string;
  userAttributes?: Record<string, string>;
}

export interface StoredSession {
  sessionId: string;
  scenarioId: string | null;
  labels: Record<string, string> | null;
  actorId: string | null;
  userId: string | null;
  userAttributes: Record<string, string> | null;
  startedAt: Date;
  closedAt: Date | null;
}
