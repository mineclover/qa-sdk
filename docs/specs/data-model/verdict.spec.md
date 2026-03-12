# VerdictReport + VerdictStore

> Spec Graph vs Runtime Graph 비교 결과(verdict)의 타입 정의와 저장소 포트.

## 상태

implemented (타입 + 포트), engine verdict computation은 hold

## VerdictReport 타입

```typescript
type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown";

interface VerdictReport {
  scenarioId: string;
  traceId: string;
  overallVerdict: Verdict;
  stepMatches: StepMatch[];
  latencyViolations: LatencyViolation[];
  unmatchedSpecSteps: string[];
  unmatchedRuntimeNodes: string[];
  computedAt: Date;
}

interface StepMatch {
  specStepId: string;
  runtimeNodeId: string;
  verdict: Verdict;
  constraintResults: { constraint: StepConstraint; passed: boolean; actual?: unknown }[];
}

interface LatencyViolation {
  nodeId: string;
  expected: number;
  actual: number;
}
```

## VerdictStore 포트

```typescript
interface VerdictStore {
  insert(params: VerdictInsert): Promise<void>;
  findByScenarioAndTrace(scenarioId: string, traceId: string): Promise<StoredVerdict | null>;
  findBySessionId(sessionId: string): Promise<StoredVerdict[]>;
}
```

## 동작

### insert
- verdict 결과를 JSON으로 저장
- (scenarioId, traceId) 복합 unique 제약

### findByScenarioAndTrace
- 특정 시나리오 × trace 조합의 verdict 조회
- re-computation 전 기존 결과 확인용

### findBySessionId
- QA 세션 내 모든 verdict 목록
- 세션 단위 검증 결과 대시보드용

## 제약 조건

- (scenarioId, traceId) 복합 unique
- overallVerdict enum: pass, fail, warn, degraded, unknown
- report는 VerdictReport JSON 전체를 JSONB로 저장
