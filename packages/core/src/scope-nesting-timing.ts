/**
 * Contract Timing — 계약 위임 시점 분석
 *
 * 시뮬레이션 결과(SimulationResult)와 마운트 바인딩(MountFlowBinding)을
 * 교차하여 계약의 시간적 가용성을 검증한다.
 */

import type { ContractRef } from "./scope-nesting.js";
import type { MountFlowBinding, ScopePipeBinding, ScopeContractRef } from "./scope-nesting-mount.js";
import type { SimulationResult } from "./pipe/pipe-simulate.js";

function normalizeContractId(ref: string | ScopeContractRef): string {
  return typeof ref === "string" ? ref : ref.contractId;
}

// ── 타입 ──────────────────────────────────────────────

export interface DelegationRef {
  contractId: string;
  completionEvent: string;
  /** 위임 중 stale data 허용 (기본: false) */
  tolerateStale?: boolean;
}

export interface TimedScopePipeBinding extends ScopePipeBinding {
  delegatesTo?: DelegationRef[];
}

export interface TimedMountFlowBinding extends MountFlowBinding {
  bindings: Record<string, TimedScopePipeBinding>;
}

export type TimingIssueCode =
  | "consume-before-ready"
  | "delegation-gap"
  | "readiness-event-missing"
  | "completion-event-missing";

export interface TimingIssue {
  severity: "error" | "warning";
  code: TimingIssueCode;
  /** 계약 수준 이슈(readiness-event-missing 등)에서는 미설정 */
  pipeId?: string;
  contractId: string;
  message: string;
}

export interface ReadinessEntry {
  contractId: string;
  /** 준비 시점 step 인덱스 (-1 = 즉시) */
  readyAtStep: number;
}

export interface DelegationGap {
  contractId: string;
  delegatorPipeId: string;
  gapStartStep: number;
  gapEndStep: number;
  staleConsumers: string[];
}

export interface TimingValidation {
  valid: boolean;
  issues: TimingIssue[];
  readinessTimeline: ReadinessEntry[];
  delegationGaps: DelegationGap[];
}

// ── 내부 유틸 ─────────────────────────────────────────

/** 시뮬 결과에서 이벤트 → step 인덱스 맵 구축 */
function buildEventStepMap(simResult: SimulationResult): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < simResult.steps.length; i++) {
    const s = simResult.steps[i];
    if (s.eventKey && !map.has(s.eventKey)) {
      map.set(s.eventKey, i);
    }
  }
  for (const e of simResult.producedEvents) {
    if (!map.has(e.eventKey)) {
      map.set(e.eventKey, simResult.steps.length);
    }
  }
  return map;
}

/** pipe별 첫 실행 step 인덱스 */
function buildPipeFirstStepMap(simResult: SimulationResult): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < simResult.steps.length; i++) {
    const s = simResult.steps[i];
    if (!map.has(s.pipeId)) {
      map.set(s.pipeId, i);
    }
  }
  return map;
}

/** override 반영한 effective provider 맵 구축 */
function buildEffectiveProviderMap(
  scopes: { provides: ContractRef[] }[],
): Map<string, ContractRef> {
  const map = new Map<string, ContractRef>();
  for (const scope of scopes) {
    for (const contract of scope.provides) {
      const existing = map.get(contract.contractId);
      if (!existing || contract.override) {
        map.set(contract.contractId, contract);
      }
    }
  }
  return map;
}

// ── 검증 함수 ─────────────────────────────────────────

/**
 * 계약 시점 검증 — 시뮬 결과와 마운트 바인딩을 교차 분석.
 *
 * 1. readyAfter: 해당 이벤트가 producedEvents에 나타난 후에야 소비 가능
 * 2. delegatesTo: completionEvent가 producedEvents에 있는지 확인
 * 3. delegation gap: 위임 시작~완료 사이에 해당 계약 소비하는 pipe 탐지
 */
export function validateContractTiming(
  binding: TimedMountFlowBinding,
  simResult: SimulationResult,
): TimingValidation {
  const issues: TimingIssue[] = [];
  const readinessTimeline: ReadinessEntry[] = [];
  const delegationGaps: DelegationGap[] = [];

  const { nesting, bindings } = binding;
  const eventStepMap = buildEventStepMap(simResult);
  const pipeFirstStep = buildPipeFirstStepMap(simResult);
  const effectiveProvider = buildEffectiveProviderMap(nesting.scopes);

  // readyAfter 분석
  for (const [, contract] of effectiveProvider) {
    if (contract.readyAfter) {
      const readyStep = eventStepMap.get(contract.readyAfter);
      if (readyStep === undefined) {
        issues.push({
          severity: "warning",
          code: "readiness-event-missing",
          contractId: contract.contractId,
          message: `계약 "${contract.contractId}"의 readyAfter 이벤트 "${contract.readyAfter}"가 시뮬 결과에 없음`,
        });
        readinessTimeline.push({ contractId: contract.contractId, readyAtStep: -1 });
      } else {
        readinessTimeline.push({ contractId: contract.contractId, readyAtStep: readyStep });
      }
    } else {
      readinessTimeline.push({ contractId: contract.contractId, readyAtStep: -1 });
    }
  }

  const readyAtMap = new Map(readinessTimeline.map(r => [r.contractId, r.readyAtStep]));

  // consume-before-ready 검사
  for (const [pipeId, scopeBinding] of Object.entries(bindings)) {
    const firstStep = pipeFirstStep.get(pipeId);
    if (firstStep === undefined) continue;

    for (const ref of scopeBinding.scopeContracts) {
      const contractId = normalizeContractId(ref);
      const readyAt = readyAtMap.get(contractId) ?? -1;
      if (readyAt > 0 && firstStep < readyAt) {
        issues.push({
          severity: "error",
          code: "consume-before-ready",
          pipeId,
          contractId,
          message: `pipe "${pipeId}"(step ${firstStep})가 계약 "${contractId}" 데이터 준비(step ${readyAt}) 전에 소비`,
        });
      }
    }
  }

  // delegation gap 분석
  for (const [pipeId, scopeBinding] of Object.entries(bindings)) {
    if (!scopeBinding.delegatesTo) continue;

    for (const delegation of scopeBinding.delegatesTo) {
      const completionStep = eventStepMap.get(delegation.completionEvent);
      if (completionStep === undefined) {
        issues.push({
          severity: "warning",
          code: "completion-event-missing",
          pipeId,
          contractId: delegation.contractId,
          message: `pipe "${pipeId}"의 위임 완료 이벤트 "${delegation.completionEvent}"가 시뮬 결과에 없음`,
        });
        continue;
      }

      const delegationStart = pipeFirstStep.get(pipeId);
      if (delegationStart === undefined) continue;

      const staleConsumers: string[] = [];
      for (const [otherPipeId, otherBinding] of Object.entries(bindings)) {
        if (otherPipeId === pipeId) continue;
        if (!otherBinding.scopeContracts.some(r => normalizeContractId(r) === delegation.contractId)) continue;

        const otherFirst = pipeFirstStep.get(otherPipeId);
        if (otherFirst !== undefined && otherFirst >= delegationStart && otherFirst < completionStep) {
          staleConsumers.push(otherPipeId);
        }
      }

      if (staleConsumers.length > 0) {
        delegationGaps.push({
          contractId: delegation.contractId,
          delegatorPipeId: pipeId,
          gapStartStep: delegationStart,
          gapEndStep: completionStep,
          staleConsumers,
        });

        issues.push({
          severity: delegation.tolerateStale ? "warning" : "error",
          code: "delegation-gap",
          pipeId,
          contractId: delegation.contractId,
          message: `pipe "${pipeId}"의 역방향 위임(step ${delegationStart}~${completionStep}) 중 ${staleConsumers.join(", ")}가 stale "${delegation.contractId}" 소비`,
        });
      }
    }
  }

  return {
    valid: !issues.some(i => i.severity === "error"),
    issues,
    readinessTimeline,
    delegationGaps,
  };
}
