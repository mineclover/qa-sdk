// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// audit-recorder fetcher — Plan E Stage 11 §11.1.
//
// 시나리오 9~17은 controller가 audit-recorder에 적재한 결정 객체를
// (cycleId, pass) 키로 조회한다. fetcher는 controller 내부의 store 구현
// (in-memory/pg)에 직접 의존하지 않도록 globalThis 핸들을 wrapping한다.
// 핸들은 in-process 부트스트랩 단계에서 audit-recorder-provider가 바인딩한다
// (Task 11.1.1 SSOT — provider 측은 단계 11 후속 작업에서 wiring).
//
// 타입 alias는 sim-canary-controller `SafetyDecisionRecord`/`ResourceDecisionRecord`
// 구조와 동기. SSOT는 controller `src/decision/decision-builder.service.ts` —
// drift 시 `pnpm --filter @qa-sdk/sim-canary-controller test` red.

export type SafetyVerdict = 'promote' | 'hold' | 'rollback';
export type ResourceVerdict = 'scale-up' | 'scale-down' | 'hold' | 'rejected';
export type CategoryVerdictValue = 'PASS' | 'WARN' | 'FAIL';

export type SafetyTriggerCategory =
  | 'perf'
  | 'compatibility'
  | 'decisionQuality'
  | 'auditSafety'
  | 'replicationHealth';

export type ResourceRejectedBy = 'resourceHeadroom' | 'stability';

export interface DecisionEvidence {
  kind: 'data' | 'rule' | 'external' | 'precedent' | 'intuition';
  source: string;
  content: unknown;
  weight: number;
}

export interface SafetyDecisionRecordView {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: 'safety';
  verdict: SafetyVerdict;
  categoryVerdicts: {
    perf: CategoryVerdictValue;
    compatibility: CategoryVerdictValue;
    decisionQuality: CategoryVerdictValue;
    auditSafety: CategoryVerdictValue;
    replicationHealth: CategoryVerdictValue;
  };
  triggerCategory?: SafetyTriggerCategory;
  triggerSignals: string[];
  evidence: DecisionEvidence[];
  confidence: number;
  action?:
    | { kind: 'weight-update'; weight: 0 | 5 | 25 | 50 | 100; revision: number }
    | { kind: 'noop' };
}

export interface ResourceDecisionRecordView {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: 'resource';
  verdict: ResourceVerdict;
  categoryVerdicts: {
    loadPressure: CategoryVerdictValue;
    resourceHeadroom: CategoryVerdictValue;
    stability: CategoryVerdictValue;
  };
  rejectedBy?: ResourceRejectedBy;
  triggerSignals: string[];
  evidence: DecisionEvidence[];
  confidence: number;
  action?:
    | {
        kind: 'scale';
        target: { v1: number; v2: number };
        reason: string;
      }
    | { kind: 'noop' };
}

export type AnyDecision = SafetyDecisionRecordView | ResourceDecisionRecordView;

export interface AuditFetcher {
  queryDecisions(filter: { cycleIds: readonly string[] }): Promise<AnyDecision[]>;
  queryFirstDecision(filter: {
    pass: 'safety' | 'resource';
    cycleIds?: readonly string[];
  }): Promise<AnyDecision | null>;
  countAlerts(filter: { cycleIds: readonly string[]; kind: string }): Promise<number>;
}

export function getAuditFetcher(): AuditFetcher {
  const h = (globalThis as unknown as { __simAuditFetcher?: AuditFetcher }).__simAuditFetcher;
  if (!h) {
    throw new Error('__simAuditFetcher not bound — controller bootstrap required');
  }
  return h;
}

/**
 * sleep 금지 — Plan C audit-recorder write 이벤트로 cycle 완료 감지.
 *
 * waitForCycles는 in-process 부트스트랩이 노출하는 비동기 신호 wrapper다.
 * 사이클 N개가 audit-recorder에 적재될 때까지 대기 후 cycleId 배열을 반환한다.
 */
export async function waitForCycles(n: number, timeoutMs = 60_000): Promise<string[]> {
  const h = (
    globalThis as unknown as {
      __simWaitForCycles?: (n: number, timeoutMs: number) => Promise<string[]>;
    }
  ).__simWaitForCycles;
  if (!h) throw new Error('__simWaitForCycles not bound');
  return h(n, timeoutMs);
}
