// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { ScenarioSpec } from "../types/scenario.js";

/** ScenarioSpec 저장소 계약 */
export interface ScenarioSpecStore {
  upsert(spec: ScenarioSpec): Promise<void>;
  findById(scenarioId: string): Promise<ScenarioSpec | null>;
  findAll(limit?: number): Promise<ScenarioSpec[]>;
  findByDomain(domain: string, limit?: number): Promise<ScenarioSpec[]>;
  remove(scenarioId: string): Promise<boolean>;
}
