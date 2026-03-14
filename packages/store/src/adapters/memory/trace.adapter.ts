import type { StoredTrace, TraceStore, TraceUpsert } from "@qa-sdk/core";

/** TraceStore의 in-memory 구현 */
export class InMemoryTraceStore implements TraceStore {
  private readonly traces = new Map<string, StoredTrace>();

  async upsert(params: TraceUpsert): Promise<void> {
    const existing = this.traces.get(params.traceId);

    if (!existing) {
      const now = new Date();
      const stored: StoredTrace = {
        traceId: params.traceId,
        sessionId: params.sessionId ?? null,
        serviceName: params.serviceName ?? null,
        actorId: params.actorId ?? null,
        userId: params.userId ?? null,
        userAttributes: params.userAttributes ? structuredClone(params.userAttributes) : null,
        recordCount: params.recordCount,
        firstTimestamp: new Date(params.firstTimestamp),
        lastTimestamp: new Date(params.lastTimestamp),
        reconstructed: false,
        createdAt: now,
        updatedAt: now,
      };

      this.traces.set(params.traceId, stored);
      return;
    }

    const updated: StoredTrace = {
      ...existing,
      recordCount: existing.recordCount + params.recordCount,
      firstTimestamp: minTimestamp(existing.firstTimestamp, params.firstTimestamp),
      lastTimestamp: maxTimestamp(existing.lastTimestamp, params.lastTimestamp),
      updatedAt: new Date(),
    };

    this.traces.set(params.traceId, updated);
  }

  async findById(traceId: string): Promise<StoredTrace | null> {
    const trace = this.traces.get(traceId);
    return trace ? structuredClone(trace) : null;
  }

  async findUnreconstructed(limit = 100): Promise<StoredTrace[]> {
    return Array.from(this.traces.values())
      .filter((trace) => !trace.reconstructed)
      .slice(0, limit)
      .map((trace) => structuredClone(trace));
  }

  async markReconstructed(traceId: string): Promise<void> {
    const existing = this.traces.get(traceId);

    if (!existing) return;

    this.traces.set(traceId, {
      ...existing,
      reconstructed: true,
      updatedAt: new Date(),
    });
  }
}

function minTimestamp(current: Date | null, candidate: Date): Date {
  if (!current || candidate.getTime() < current.getTime()) {
    return new Date(candidate);
  }

  return new Date(current);
}

function maxTimestamp(current: Date | null, candidate: Date): Date {
  if (!current || candidate.getTime() > current.getTime()) {
    return new Date(candidate);
  }

  return new Date(current);
}
