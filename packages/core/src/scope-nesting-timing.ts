/**
 * Contract Timing — 계약 위임 시점 분석
 *
 * 시뮬레이션 결과(SimulationResult)와 마운트 바인딩(MountFlowBinding)을
 * 교차하여 계약의 시간적 가용성을 검증한다.
 */

import type { MountFlowBinding, ScopePipeBinding } from "./scope-nesting-mount.js";
import type { SimulationResult } from "./pipe/pipe-simulate.js";

// ── 타입 ──────────────────────────────────────────────

/** pipe의 역방향 위임 선언 */
export interface DelegationRef {
  /** 위임 대상 계약 */
  contractId: string;
  /** 위임 완료를 알리는 이벤트 */
  completionEvent: string;
  /** 위임 중 stale data 허용 (기본: false) */
  tolerateStale?: boolean;
}

/** 확장된 ScopePipeBinding — 위임 포함 */
export interface TimedScopePipeBinding extends ScopePipeBinding {
  /** 이 pipe가 상위 scope 계약에 역방향 위임하는 목록 */
  delegatesTo?: DelegationRef[];
}

/** 시점 검증용 바인딩 */
export interface TimedMountFlowBinding extends MountFlowBinding {
  bindings: Record<string, TimedScopePipeBinding>;
}

// ── 검증 결과 ─────────────────────────────────────────

export type TimingIssueCode =
  | "consume-before-ready"
  | "delegation-gap"
  | "readiness-event-missing"
  | "completion-event-missing";

export interface TimingIssue {
  severity: "error" | "warning";
  code: TimingIssueCode;
  pipeId: string;
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
  /** gap 동안 해당 계약을 소비하는 pipe */
  staleConsumers: string[];
}

export interface TimingValidation {
  valid: boolean;
  issues: TimingIssue[];
  readinessTimeline: ReadinessEntry[];
  delegationGaps: DelegationGap[];
}

// ── 검증 함수 ─────────────────────────────────────────

/**
 * 계약 시점 검증 — 시뮬 결과와 마운트 바인딩을 교차 분석.
 *
 * 1. readyAfter가 있는 계약: 해당 이벤트가 producedEvents에 나타난 후에야 소비 가능
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

  // 이벤트 → step 인덱스 맵
  const eventStepMap = new Map<string, number>();
  for (let i = 0; i < simResult.steps.length; i++) {
    const s = simResult.steps[i];
    if (s.eventKey && !eventStepMap.has(s.eventKey)) {
      eventStepMap.set(s.eventKey, i);
    }
  }
  // producedEvents도 포함
  for (const e of simResult.producedEvents) {
    if (!eventStepMap.has(e.eventKey)) {
      eventStepMap.set(e.eventKey, simResult.steps.length); // 마지막 이후
    }
  }

  // pipe → 첫 실행 step 인덱스
  const pipeFirstStep = new Map<string, number>();
  for (let i = 0; i < simResult.steps.length; i++) {
    const s = simResult.steps[i];
    if (!pipeFirstStep.has(s.pipeId)) {
      pipeFirstStep.set(s.pipeId, i);
    }
  }

  // 1단계: readyAfter 분석 — 계약별 준비 시점 계산
  for (const scope of nesting.scopes) {
    for (const contract of scope.provides) {
      if (contract.readyAfter) {
        const readyStep = eventStepMap.get(contract.readyAfter);
        if (readyStep === undefined) {
          issues.push({
            severity: "warning",
            code: "readiness-event-missing",
            pipeId: "",
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
  }

  // readyAfter가 있는 계약의 준비 시점 맵
  const readyAtMap = new Map(readinessTimeline.map(r => [r.contractId, r.readyAtStep]));

  // 2단계: consume-before-ready 검사
  for (const [pipeId, scopeBinding] of Object.entries(bindings)) {
    const firstStep = pipeFirstStep.get(pipeId);
    if (firstStep === undefined) continue; // 시뮬에서 실행되지 않은 pipe

    for (const contractId of scopeBinding.scopeContracts) {
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

  // 3단계: delegation gap 분석
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

      // 위임 시작 = 이 pipe의 첫 실행 step
      const delegationStart = pipeFirstStep.get(pipeId);
      if (delegationStart === undefined) continue;

      // gap 동안 해당 계약을 소비하는 다른 pipe 찾기
      const staleConsumers: string[] = [];
      for (const [otherPipeId, otherBinding] of Object.entries(bindings)) {
        if (otherPipeId === pipeId) continue;
        if (!otherBinding.scopeContracts.includes(delegation.contractId)) continue;

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

        const severity = delegation.tolerateStale ? "warning" : "error";
        issues.push({
          severity,
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
