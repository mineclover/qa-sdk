// @def.boundary persistence-system-root
// @def.doc test-scenario-store

export { SqliteTestScenarioStore } from './store.js';
export { canTransitionTestScenario, TEST_SCENARIO_LIFECYCLE_TRANSITIONS } from './port.js';
export type { TestScenarioStore, TestScenarioRunContract } from './port.js';
export type {
  TestKind,
  TestScope,
  TestPhaseLabel,
  TestLifecycle,
  TestScenario,
  TestScenarioRun,
  CreateTestScenarioInput,
} from './types.js';
