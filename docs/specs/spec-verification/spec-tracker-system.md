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
      type: refs
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
  - packages/spec-tracker/src/verification-artifact.ts
  - packages/spec-tracker/src/verification-artifact.test.ts
  - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — 런타임 계약 수집기

## 목적 ^purpose

테스트 실행과 런타임 로깅에서 계약 동작 여부를 수집하고, `specId` grouping key에 연결하는 순수 라이브러리. `specId`가 definition 문서를 가리키는 것은 상위 CLI/CI의 convention이며 tracker는 definition-service나 datasource에 접근하지 않는다. "이 spec에 적힌 계약이 실제로 동작하는가?"를 테스트 증거 기반으로 답한다.

## 구성 ^overview

- `spec-tracker-types`: ContractEvidence, ContractReport 등 핵심 타입
- `spec-tracker-collector`: 테스트/런타임에서 증거를 수집하는 수집기
- `spec-tracker-reporter`: 수집된 증거를 specId별로 집계하여 리포트 생성
- `spec-tracker-vitest-adapter`: `linkSpec`/`specIt`와 legacy `spec()`로 vitest 테스트를 specId에 연결하는 어댑터
- `spec-tracker-verification-artifact`: run-start definition binding과 report를 transport artifact로 묶고 구조를 검증하는 순수 helper

## 수집 흐름 ^flow-steps

```
1. Vitest globals mode에서는 linkSpec(specId) 또는 specIt(specId, ...)로 테스트↔specId 연결
2. globals mode가 아니거나 런타임에서는 SpecCollector.record()로 명시적으로 ContractEvidence 기록
3. 테스트 실행 시 pass/fail/skip + marker 수집
4. 실행 종료 후 specId별 aggregation → ContractReport
5. 상위 CLI/CI가 run-start binding을 캡처하고 binding + reports → VerificationArtifact 생성
6. 상위 CLI/CI가 `def verification-artifact`로 ContractReport와 binding을 파일로 묶고 `def state --verification-artifact`로 소비 (spec-tracker 자체는 전송하지 않음)
```

## 핵심 타입 ^inputs

참조: `packages/spec-tracker/src/types.ts` — ContractEvidence, ContractReport, VerificationSummary

참조: `packages/spec-tracker/src/verification-artifact.ts` — VerificationArtifact, VerificationDefinitionBinding, 구조 검증

3계층: 증거(ContractEvidence) → specId별 집계(ContractReport) → 전체 요약(VerificationSummary). `ContractReport.coverage`는 `passed / (passed + failed)`인 **0..1 ratio**이며 skipped evidence는 분모에서 제외한다.

## 퍼블릭 API ^api-surface

참조: `packages/spec-tracker/src/index.ts` — 전체 export surface

- `SpecCollector` — 인메모리 증거 수집기 (`packages/spec-tracker/src/collector.ts`)
- `generateReport()` — 수집된 증거를 specId별로 집계 (`packages/spec-tracker/src/reporter.ts`)
- `createVerificationArtifact()` / `validateVerificationArtifact()` — report와 run-start binding을 transport artifact로 생성·검증 (`packages/spec-tracker/src/verification-artifact.ts`)
- `linkSpec(specId)` — 파일 단위 specId 연결 (`packages/spec-tracker/src/vitest-adapter.ts`)
- `specIt(specId, name, fn)` — 개별 테스트 specId 연결
- `getGlobalCollector()` — 프로세스 글로벌 수집기
- `spec(specId)` — deprecated, linkSpec/specIt 사용 권장

## 사용 예시

globals mode가 아닌 Vitest와 런타임에서는 collector를 명시적으로 기록한다:

```typescript
import { afterAll, describe, expect, it } from "vitest";
import { SpecCollector, generateReport } from "spec-tracker";

const collector = new SpecCollector();
const err = { code: "NOT_FOUND" };

describe("컨벤션 준수", () => {
  it("AppError 인터페이스", () => {
    expect(err.code).toBe("NOT_FOUND");
    collector.record({ specId: "error-handling-convention", status: "pass", testName: "AppError" });
  });

  afterAll(() => {
    const [report] = generateReport(collector, ["error-handling-convention"]).reports;
    expect(report?.coverage).toBe(1);
  });
});
```

## 제약 조건 ^constraint

- spec-tracker는 순수 라이브러리 — DB/네트워크 직접 접근 없음
- definition-service 동기화는 현재 tracker의 기능이 아니다. CLI/CI adapter는 artifact file transport와 read-model 조합만 수행하며, definition-service/graph write는 별도 계약이 필요하다
- spec-tracker 자체에는 ContractReport를 전송하거나 definition-service/graph에 쓰는 consumer가 없다. 상위 `packages/cli`가 `def verification-artifact` file producer와 `def state --verification-artifact` read-model consumer를 제공하지만, definition-service/graph 자동 반영은 하지 않는다.
- artifact producer의 command registration, datasource snapshot, exit-code 정책은 `packages/cli`와 `definition-data-source`의 책임이다. tracker는 유효한 wire artifact를 생성·검증하는 순수 helper만 제공한다.
- CI lane 조합과 artifact 보존 정책은 `scripts/spec-verification-runner.ts`와 `.github/workflows/def-verification.yml`이 소유한다. runner는 tracker collector를 통해 summary를 만들지만 tracker 내부에 CI/workflow 의존성을 추가하지 않는다.
- 테스트 프레임워크 의존: vitest 어댑터만 제공 (확장 가능)
- `linkSpec`과 `specIt`은 `globalThis.afterEach`/`globalThis.it`를 사용하므로 Vitest globals mode가 필요하다. globals mode가 아니면 이 문서의 명시적 `collector.record()` 경로를 사용한다.
- ContractEvidence는 readonly 타입이며 collector는 추가/조회 중심으로 사용한다
- specId는 definition-catalog에 존재하는 문서 ID를 가리키는 convention이다. 현재 tracker 라이브러리 자체는 존재 여부를 검증하지 않으며, 검증은 별도 상위 sync/adapter 책임이다.
