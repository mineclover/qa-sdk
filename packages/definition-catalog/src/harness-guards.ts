// @def.doc definition-harness

/**
 * 하네스 가드/캐스케이드 — 머신 간 의존 관계 검증.
 *
 * 순수 함수: HarnessRegistry + CompositeInstance만 입력.
 * harness-state-model에서 추출 — 테스트 격리 + 재사용 목적.
 */

import type {
  MachineDependency,
  HarnessRegistry,
  CompositeInstance,
} from "./harness-state-model.js";

/**
 * guard 의존성 검증.
 * targetMachine의 전이를 실행하기 전에 sourceMachine이 sourceState인지 확인.
 */
export function checkGuards(
  registry: HarnessRegistry,
  composite: CompositeInstance,
  machineId: string,
  targetState: string,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const dep of registry.dependencies) {
    if (dep.kind !== "guard") continue;
    if (dep.targetMachine !== machineId) continue;
    if (dep.targetState !== targetState) continue;

    const sourceInstance = composite.states.get(dep.sourceMachine);
    if (!sourceInstance) continue;
    if (sourceInstance.current !== dep.sourceState) {
      violations.push(
        `${dep.sourceMachine}이 ${dep.sourceState}여야 하지만 현재 ${sourceInstance.current} (${dep.label})`,
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * cascade 전이 수집.
 * machineId가 targetState에 진입했을 때 자동으로 전이해야 할 다른 머신들.
 */
export function collectCascades(
  registry: HarnessRegistry,
  machineId: string,
  targetState: string,
): readonly MachineDependency[] {
  return registry.dependencies.filter(
    (dep) =>
      dep.kind === "cascade" &&
      dep.sourceMachine === machineId &&
      dep.sourceState === targetState,
  );
}
