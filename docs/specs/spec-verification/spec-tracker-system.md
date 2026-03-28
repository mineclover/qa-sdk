---
def:
  id: spec-tracker-system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: spec-tracker
  tags: [testing, observability, tier-system]
  links:
    - target: spec-verification-system
      type: refines
    - target: definition-service-system
      type: depends_on
    - target: spec-tracker-types
      type: contains
    - target: spec-tracker-collector
      type: contains
    - target: spec-tracker-reporter
      type: contains
    - target: spec-tracker-vitest-adapter
      type: contains
---
# Spec Tracker — 런타임 계약 수집기

## 목적 ^purpose

테스트 실행과 런타임 로깅에서 계약 동작 여부를 수집하고, definition-catalog의 문서(specId)에 연결하는 도구. "이 spec에 적힌 계약이 실제로 동작하는가?"를 테스트 증거 기반으로 답한다.

## 구성 ^overview

- `spec-tracker-types`: ContractEvidence, ContractReport 등 핵심 타입
- `spec-tracker-collector`: 테스트/런타임에서 증거를 수집하는 수집기
- `spec-tracker-reporter`: 수집된 증거를 specId별로 집계하여 리포트 생성
- `spec-tracker-vitest-adapter`: vitest describe/it에 specId를 연결하는 어댑터

## 수집 흐름 ^flow-steps

```
1. 테스트 파일에서 spec(specId) 헬퍼로 테스트↔문서 연결
2. 테스트 실행 시 ContractEvidence 수집 (pass/fail/skip + 마커)
3. 실행 종료 후 specId별 aggregation → ContractReport
4. ContractReport를 definition-service에 전송 (선택)
```

## 핵심 타입 ^inputs

```typescript
/** 계약 증거 1건 — 테스트 또는 런타임에서 수집 */
interface ContractEvidence {
  specId: string;                    // definition-catalog 문서 ID
  marker?: ContractMarkerKind;       // inputs, precondition 등 (선택)
  status: "pass" | "fail" | "skip";
  source: "test" | "runtime";
  testFile?: string;                 // 테스트 파일 경로
  testName?: string;                 // 테스트 이름
  timestamp: string;                 // ISO-8601
}

/** specId별 집계 리포트 */
interface ContractReport {
  specId: string;
  evidences: number;                 // 총 증거 수
  passed: number;
  failed: number;
  skipped: number;
  markers: Record<string, { total: number; passed: number; failed: number }>;
  coverage: number;                  // 0~1 (passed / (passed + failed))
  lastVerified: string;              // 가장 최근 증거 시각
}

/** 전체 리포트 */
interface VerificationSummary {
  reports: readonly ContractReport[];
  totalSpecs: number;
  verifiedSpecs: number;             // 1건 이상 evidence가 있는 spec
  fullyPassed: number;               // failed=0인 spec
  generatedAt: string;
}
```

## 퍼블릭 API ^api-surface

```typescript
/** 수집기 생성 */
createSpecTracker(options?: { autoSync?: boolean }): SpecTracker;

/** vitest describe/it에 연결하는 헬퍼 */
spec(specId: string): { describe: typeof describe; it: typeof it };

/** 수동 증거 기록 */
tracker.record(evidence: ContractEvidence): void;

/** specId별 리포트 집계 */
tracker.report(specIds?: string[]): VerificationSummary;

/** definition-service에 결과 전송 */
tracker.sync(serviceUrl: string): Promise<void>;
```

## 사용 예시

```typescript
import { spec } from "spec-tracker";

const { describe, it } = spec("registry-api");

describe("POST /prefixes", () => {
  it("prefix를 등록한다", async () => {
    // 이 테스트가 통과하면 registry-api spec의 증거로 기록
    const res = await api.post("/prefixes", body);
    expect(res.status).toBe(201);
  });
});
```

## 제약 조건 ^constraint

- spec-tracker는 순수 라이브러리 — DB/네트워크 직접 접근 없음
- definition-service 동기화는 선택적 (CLI 또는 CI에서 호출)
- 테스트 프레임워크 의존: vitest 어댑터만 제공 (확장 가능)
- ContractEvidence는 불변 — 수집 후 변경 불가
- specId는 definition-catalog에 존재하는 문서 ID여야 함 (존재 검증은 sync 시점)
