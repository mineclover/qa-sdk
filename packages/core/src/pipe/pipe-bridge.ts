// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 브릿지 — 시뮬레이션↔계보, Constraint↔이벤트 연결
 */

import type { SimulationResult } from './pipe-simulate.js';
import type { FieldLineage, FieldSet, CompatibilityResult } from '../types/data-schema.js';
import { resolveStepSchemaId } from './pipe-schema-id.js';
import type { ConstraintResult } from '../types/constraint.js';
import type { PipeSpec, PipeStep, PipeFlow } from '../types/pipe-spec.js';
import type { LineageChainValidation } from '../data-object/types.js';
import { BindingRegistry } from '../data-object/registry.js';
import { validateLineageChain } from '../data-object/validate.js';
import { checkCompatibility, LineageCollector } from './data-contract.js';
import { resolveBindings } from './pipe-definition-bridge.js';
import type { PipeBindingInfo } from './pipe-definition-bridge.js';

// ── 시뮬레이션 → 자동 계보 추출 ─────────────────────

/**
 * 시뮬레이션 결과에서 dataContract가 있는 step들의 계보를 자동 추출.
 * step[i].produces → step[i+1].consumes 매핑을 lineage로 기록.
 */
export function extractLineageFromSimulation(
  result: SimulationResult,
  pipes: PipeSpec[],
): LineageCollector {
  const collector = new LineageCollector();
  const pipeMap = new Map(pipes.map((p) => [p.pipeId, p]));

  // step 간 produces → consumes 체인 추출
  // 주의: cross-pipe 체인이 생성됨 (시뮬레이션은 실행 순서 기반, 정적은 단일 pipe)
  let previousProduces: { schemaId: string; fields: Record<string, { type: string }> } | null =
    null;

  for (const step of result.steps) {
    if (step.kind !== 'step') continue;

    const pipe = pipeMap.get(step.pipeId);
    if (!pipe) continue;

    // PipeFlow 트리에서 해당 step의 dataContract 찾기
    const flowStep = findStepByPath(pipe.flow, step.flowPath);
    if (!flowStep || flowStep.kind !== 'step' || !flowStep.dataContract) {
      // dataContract 없는 step → chain 끊기 (인접하지 않은 step 간 false chain 방지)
      previousProduces = null;
      continue;
    }

    const dc = flowStep.dataContract;
    const schemaId = resolveStepSchemaId(flowStep, step.pipeId);

    // step 내부 계보: lineageHints 우선, 없으면 이름 매칭
    if (dc.produces) {
      for (const [outputField] of Object.entries(dc.produces)) {
        const hint = dc.lineageHints?.[outputField];
        if (hint) {
          // lineageHints 명시: sources가 이 출력에 기여
          collector.record({
            target: { schemaId, column: outputField },
            sources: hint.sources.map((s) => ({ schemaId, column: s })),
            transform: hint.transform,
            pipeId: step.pipeId,
            stepPath: step.flowPath,
          });
        }
        // hints 없는 이름 매칭 pass-through는 chain lineage에서 처리 (self-reference 방지)
      }
    }

    // 이전 step의 produces → 현재 step의 consumes 체인
    if (previousProduces && dc.consumes) {
      for (const [field] of Object.entries(dc.consumes)) {
        if (previousProduces.fields[field]) {
          collector.record({
            target: { schemaId, column: field },
            sources: [{ schemaId: previousProduces.schemaId, column: field }],
            transform: 'direct',
            pipeId: step.pipeId,
            stepPath: step.flowPath,
          });
        }
      }
    }

    // 현재 step의 produces 기록 — sink step(produces 없음)이면 체인 끊기
    if (dc.produces) {
      previousProduces = { schemaId, fields: dc.produces };
    } else if (dc.consumes) {
      previousProduces = null;
    }
  }

  return collector;
}

// ── 시뮬레이션 step 간 스키마 호환 자동 검증 ─────────

export interface StepCompatIssue {
  fromStep: string;
  toStep: string;
  result: CompatibilityResult;
}

/**
 * 시뮬레이션 결과에서 연속 step 간 스키마 호환 검증.
 * step[i].produces ↔ step[i+1].consumes 호환성 체크.
 */
export function validateStepContracts(
  result: SimulationResult,
  pipes: PipeSpec[],
): StepCompatIssue[] {
  const issues: StepCompatIssue[] = [];
  const pipeMap = new Map(pipes.map((p) => [p.pipeId, p]));

  let previousProduces: { stepPath: string; fields: FieldSet } | null = null;

  for (const step of result.steps) {
    if (step.kind !== 'step') continue;

    const pipe = pipeMap.get(step.pipeId);
    if (!pipe) continue;

    const flowStep = findStepByPath(pipe.flow, step.flowPath);
    if (!flowStep || flowStep.kind !== 'step' || !flowStep.dataContract) continue;

    const dc = flowStep.dataContract;

    if (previousProduces && dc.consumes) {
      const consumerFieldSet: FieldSet = {
        fields: Object.fromEntries(
          Object.entries(dc.consumes).map(([k, v]) => [k, { type: v.type, required: v.required }]),
        ),
      };

      const compat = checkCompatibility(previousProduces.fields, consumerFieldSet);
      if (!compat.compatible) {
        issues.push({
          fromStep: previousProduces.stepPath,
          toStep: step.flowPath,
          result: compat,
        });
      }
    }

    if (dc.produces) {
      previousProduces = {
        stepPath: step.flowPath,
        fields: {
          fields: Object.fromEntries(
            Object.entries(dc.produces).map(([k, v]) => [
              k,
              { type: v.type, required: v.required },
            ]),
          ),
        },
      };
    }
  }

  return issues;
}

export interface SimulationLineageValidation {
  lineages: readonly FieldLineage[];
  summary: LineageChainValidation;
  warnings: string[];
  bindings: PipeBindingInfo[];
}

/** 시뮬레이션 결과에서 계보를 추출하고 binding registry 기준으로 검증 */
export function validateSimulationLineage(
  result: SimulationResult,
  pipes: PipeSpec[],
  registry: BindingRegistry,
): SimulationLineageValidation {
  const collector = extractLineageFromSimulation(result, pipes);
  const lineages = collector.getAll();
  const bindings = resolveBindings(buildPipeBindingGraph(pipes), registry);

  return {
    lineages,
    summary: validateLineageChain(lineages, registry),
    warnings: bindings.flatMap((binding) => binding.warnings),
    bindings,
  };
}

// ── Constraint → 이벤트 변환 ─────────────────────────

export interface ConstraintEvent {
  event_key: 'constraint_verified';
  payload: {
    constraintId: string;
    specId: string;
    verdict: string;
    duration: number;
    breaking: boolean;
    subjectRef: string;
    predicateOp: string;
    contextWhen: string;
    failureHint?: string;
  };
  timestamp: string;
}

/** ConstraintResult → 이벤트 형식으로 변환 (기존 EventRecord 파이프라인에 주입 가능) */
export function constraintResultToEvent(result: ConstraintResult): ConstraintEvent {
  return {
    event_key: 'constraint_verified',
    payload: {
      constraintId: result.constraintId,
      specId: result.specId,
      verdict: result.verdict,
      duration: result.duration,
      breaking: result.verdict === 'fail',
      subjectRef: result.failureTrace?.subject.ref ?? '',
      predicateOp: result.failureTrace?.predicate.op ?? '',
      contextWhen: result.failureTrace?.context.when ?? '',
      failureHint: result.failureTrace?.hint,
    },
    timestamp: result.executedAt,
  };
}

// ── 내부 헬퍼 ─────────────────────────────────────────

function findStepByPath(flow: PipeFlow, path: string): PipeFlow | null {
  // "flow.steps[0]" → flow의 steps[0]
  const parts = path.replace(/^flow\.?/, '').split('.');
  let current: unknown = flow;

  for (const part of parts) {
    if (!part || !current) continue;

    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, idx] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) current = current[Number(idx)];
      else return null;
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current as PipeFlow | null;
}

// resolveStepSchemaId는 pipe-schema-id.ts에서 import (정적 계보와 공유)

function buildPipeBindingGraph(pipes: PipeSpec[]) {
  return {
    graphId: '__simulation_lineage__',
    version: 'v1',
    pipes,
    connections: [],
    entryPipeId: pipes[0]?.pipeId ?? '',
  };
}
