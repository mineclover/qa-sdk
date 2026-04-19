// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

/**
 * ScenarioSpec → PipeGraph 변환기
 *
 * ScenarioSpec(v1) 기반 시나리오를 PipeGraph(v2)로 변환한다.
 * 하위 호환 기간 동안 compat 계층으로 사용되며,
 * 모든 신규 시나리오는 PipeGraph로 직접 작성한다.
 *
 * 변환 규칙:
 *   scenario_id       → graphId
 *   version           → version
 *   각 step           → PipeSpec (pipeId = step.id)
 *   entry_conditions  → 첫 번째 파이프의 trigger.entryConditions
 *   step.kind optional → PipeOptional 래퍼
 *   step.branches     → conditional 연결
 *   step.next         → explicit 연결
 *   연결 정보 없음     → 순차 연결 자동 생성
 *
 * @def.doc meta-semantic-v2-migration
 */

import type {
  ScenarioSpec,
  ScenarioStep,
  StepConstraint,
  EntryCondition,
  PipeGraph,
  PipeSpec,
  PipeConnection,
  PipeFlow,
  PipeStep,
  Constraint,
} from "@qa-sdk/core";

export function convertScenarioToPipeGraph(spec: ScenarioSpec): PipeGraph {
  if (spec.steps.length === 0) {
    return {
      graphId: spec.scenario_id,
      version: spec.version,
      ...(spec.description ? { description: spec.description } : {}),
      pipes: [],
      connections: [],
      entryPipeId: "",
    };
  }

  const pipes: PipeSpec[] = spec.steps.map((step, i) => ({
    pipeId: step.id,
    version: spec.version,
    trigger: {
      eventKey: step.event_key,
      ...(i === 0 && spec.entry_conditions?.length
        ? { entryConditions: spec.entry_conditions.map(convertEntryCondition) }
        : {}),
    },
    flow: buildFlow(step),
  }));

  return {
    graphId: spec.scenario_id,
    version: spec.version,
    ...(spec.description ? { description: spec.description } : {}),
    pipes,
    connections: buildConnections(spec.steps),
    entryPipeId: spec.steps[0].id,
  };
}

// ── 내부 ─────────────────────────────────────────────────

function buildFlow(step: ScenarioStep): PipeFlow {
  const base: PipeStep = {
    kind: "step",
    facet: step.event_key,
    eventKey: step.event_key,
    ...(step.constraints?.length ? { constraints: step.constraints.map(convertStepConstraint) } : {}),
    ...(step.timeout_ms !== undefined ? { timeout: step.timeout_ms } : {}),
  };
  if (step.kind === "optional") {
    return { kind: "optional", step: base };
  }
  // "sequence" / "branch" — 분기는 connections으로 표현
  return base;
}

function buildConnections(steps: ScenarioStep[]): PipeConnection[] {
  const hasExplicit = steps.some(s => s.next?.length || s.branches?.length);

  if (!hasExplicit) {
    return steps.slice(0, -1).map((s, i) => ({
      from: s.id,
      to: steps[i + 1].id,
      kind: "next" as const,
    }));
  }

  const connections: PipeConnection[] = [];
  for (const step of steps) {
    if (step.branches?.length) {
      for (const branch of step.branches) {
        connections.push({
          from: step.id,
          to: branch.next.length === 1 ? branch.next[0] : branch.next,
          kind: "conditional",
          condition: formatCondition(branch.condition),
        });
      }
    } else if (step.next?.length) {
      connections.push({
        from: step.id,
        to: step.next.length === 1 ? step.next[0] : step.next,
        kind: "next",
      });
    }
  }
  return connections;
}

function formatCondition(c: StepConstraint): string {
  const val = c.value !== undefined ? ` ${JSON.stringify(c.value)}` : "";
  return `${c.field} ${c.op}${val}`;
}

function convertStepConstraint(c: StepConstraint): Constraint {
  return {
    field: c.field,
    op: c.op,
    ...(c.value !== undefined ? { value: c.value } : {}),
  };
}

function convertEntryCondition(c: EntryCondition): Constraint {
  return {
    field: c.field,
    op: c.op,
    ...(c.value !== undefined ? { value: c.value } : {}),
  };
}
