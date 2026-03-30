import type { ScenarioSpecStore, ScenarioSpec } from "@qa-sdk/core";

/** ScenarioSpecStore의 in-memory 구현 */
export class InMemoryScenarioSpecStore implements ScenarioSpecStore {
  private readonly specs = new Map<string, ScenarioSpec>();

  async upsert(spec: ScenarioSpec): Promise<void> {
    this.specs.set(spec.scenario_id, structuredClone(spec));
  }

  async findById(scenarioId: string): Promise<ScenarioSpec | null> {
    const spec = this.specs.get(scenarioId);
    return spec ? structuredClone(spec) : null;
  }

  async findAll(limit?: number): Promise<ScenarioSpec[]> {
    const all = Array.from(this.specs.values()).map((s) => structuredClone(s));
    return limit ? all.slice(0, limit) : all;
  }

  async findByDomain(domain: string, limit?: number): Promise<ScenarioSpec[]> {
    const filtered = Array.from(this.specs.values())
      .filter((s) => s.domain === domain)
      .map((s) => structuredClone(s));
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async remove(scenarioId: string): Promise<boolean> {
    return this.specs.delete(scenarioId);
  }
}
