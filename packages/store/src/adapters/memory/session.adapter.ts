import type { SessionStore, SessionUpsert, StoredSession } from "@qa-sdk/core";

/** SessionStore의 in-memory 구현 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  async upsert(params: SessionUpsert): Promise<void> {
    const existing = this.sessions.get(params.sessionId);

    if (existing) {
      return;
    }

    const stored: StoredSession = {
      sessionId: params.sessionId,
      scenarioId: params.scenarioId ?? null,
      labels: params.labels ? structuredClone(params.labels) : null,
      startedAt: new Date(),
      closedAt: null,
    };

    this.sessions.set(params.sessionId, stored);
  }

  async findById(sessionId: string): Promise<StoredSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  async close(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);

    if (!existing) return;

    this.sessions.set(sessionId, {
      ...existing,
      closedAt: new Date(),
    });
  }
}
