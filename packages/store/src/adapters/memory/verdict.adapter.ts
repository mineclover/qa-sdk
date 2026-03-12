import type { StoredVerdict, VerdictInsert, VerdictStore } from "@qa-sdk/core";

/** VerdictStore의 in-memory 구현 */
export class InMemoryVerdictStore implements VerdictStore {
  private readonly verdicts = new Map<string, StoredVerdict>();
  private readonly verdictIdsByScenarioTrace = new Map<string, string>();

  async insert(params: VerdictInsert): Promise<void> {
    if (this.verdicts.has(params.id)) {
      throw new Error(`Verdict already exists for id: ${params.id}`);
    }

    const scenarioTraceKey = toScenarioTraceKey(params.scenarioId, params.traceId);

    if (this.verdictIdsByScenarioTrace.has(scenarioTraceKey)) {
      throw new Error(
        `Verdict already exists for scenarioId ${params.scenarioId} and traceId ${params.traceId}`,
      );
    }

    const stored: StoredVerdict = {
      ...structuredClone(params),
      computedAt: new Date(),
    };

    this.verdicts.set(stored.id, stored);
    this.verdictIdsByScenarioTrace.set(scenarioTraceKey, stored.id);
  }

  async removeByScenarioAndTrace(
    scenarioId: string,
    traceId: string,
  ): Promise<boolean> {
    const key = toScenarioTraceKey(scenarioId, traceId);
    const verdictId = this.verdictIdsByScenarioTrace.get(key);
    if (!verdictId) return false;

    this.verdicts.delete(verdictId);
    this.verdictIdsByScenarioTrace.delete(key);
    return true;
  }

  async findByScenarioAndTrace(
    scenarioId: string,
    traceId: string,
  ): Promise<StoredVerdict | null> {
    const verdictId = this.verdictIdsByScenarioTrace.get(
      toScenarioTraceKey(scenarioId, traceId),
    );

    if (!verdictId) return null;

    return structuredClone(this.verdicts.get(verdictId) ?? null);
  }

  async findByTraceId(traceId: string): Promise<StoredVerdict[]> {
    return Array.from(this.verdicts.values())
      .filter((verdict) => verdict.traceId === traceId)
      .map((verdict) => structuredClone(verdict));
  }

  async findBySessionId(sessionId: string): Promise<StoredVerdict[]> {
    return Array.from(this.verdicts.values())
      .filter((verdict) => verdict.qaSessionId === sessionId)
      .map((verdict) => structuredClone(verdict));
  }
}

function toScenarioTraceKey(scenarioId: string, traceId: string): string {
  return `${scenarioId}::${traceId}`;
}
