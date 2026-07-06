---
def:
  id: spec-tracker-system
  tier: system
  address: def_document:v2:68810
  scope: feature
  aspect: analyzer_func
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-tracker
  tags: [testing, observability, cross-scope]
  links:
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
  sources:
    - packages/spec-tracker/src/index.ts
    - packages/spec-tracker/src/types.ts
    - packages/spec-tracker/src/collector.ts
    - packages/spec-tracker/src/reporter.ts
    - packages/spec-tracker/src/vitest-adapter.ts
    - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — 런타임 계약 수집기

## 목적 ^purpose

테스트 실행과 런타임 로깅에서 계약 동작 여부를 수집하고, definition-catalog의 문서(specId)에 연결하는 도구. "이 spec에 적힌 계약이 실제로 동작하는가?"를 테스트 증거 기반으로 답한다.

## 구성 ^overview

- `spec-tracker-types`: ContractEvidence, ContractReport 등 핵심 타입
- `spec-tracker-collector`: 테스트/런타임에서 증거를 수집하는 수집기
- `spec-tracker-reporter`: 수집된 증거를 specId별로 집계하여 리포트 생성
- `spec-tracker-vitest-adapter`: `linkSpec`/`specIt`와 legacy `spec()`로 vitest 테스트를 specId에 연결하는 어댑터

## 수집 흐름 ^flow-steps

```
1. 테스트 파일에서 spec(specId) 헬퍼로 테스트↔문서 연결
2. 테스트 실행 시 ContractEvidence 수집 (pass/fail/skip + 마커)
3. 실행 종료 후 specId별 aggregation → ContractReport
4. ContractReport를 definition-service에 전송 (선택)
```

## 핵심 타입 ^inputs

참조: `packages/spec-tracker/src/types.ts` — ContractEvidence, ContractReport, VerificationSummary

3계층: 증거(ContractEvidence) → specId별 집계(ContractReport) → 전체 요약(VerificationSummary)

## 퍼블릭 API ^api-surface

참조: `packages/spec-tracker/src/index.ts` — 전체 export surface

- `SpecCollector` — 인메모리 증거 수집기 (`packages/spec-tracker/src/collector.ts`)
- `generateReport()` — 수집된 증거를 specId별로 집계 (`packages/spec-tracker/src/reporter.ts`)
- `linkSpec(specId)` — 파일 단위 specId 연결 (`packages/spec-tracker/src/vitest-adapter.ts`)
- `specIt(specId, name, fn)` — 개별 테스트 specId 연결
- `getGlobalCollector()` — 프로세스 글로벌 수집기
- `spec(specId)` — deprecated, linkSpec/specIt 사용 권장

## 사용 예시

참조: `packages/core/src/error-convention.test.ts` — 실제 사용 예시

vitest describe/it을 그대로 사용하되, collector.record()로 증거를 기록:

```typescript
import { describe, it, expect } from "vitest";
import { SpecCollector, generateReport } from "spec-tracker";

const collector = new SpecCollector();

describe("컨벤션 준수", () => {
  it("AppError 인터페이스", () => {
    expect(err.code).toBe("NOT_FOUND");
    collector.record({ specId: "error-handling-convention", status: "pass", testName: "AppError" });
  });

  it("리포트", () => {
    const report = generateReport(collector, ["error-handling-convention"]);
    // coverage: 100%
  });
});
```

## 제약 조건 ^constraint

- spec-tracker는 순수 라이브러리 — DB/네트워크 직접 접근 없음
- definition-service 동기화는 선택적 (CLI 또는 CI에서 호출)
- 테스트 프레임워크 의존: vitest 어댑터만 제공 (확장 가능)
- ContractEvidence는 readonly 타입이며 collector는 추가/조회 중심으로 사용한다
- specId는 definition-catalog에 존재하는 문서 ID여야 함 (존재 검증은 sync 시점)
