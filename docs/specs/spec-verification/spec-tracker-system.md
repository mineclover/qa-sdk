---
def:
  id: spec-tracker-system
  level: module
  address: def_document:v2:68810
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

참조: `packages/spec-tracker/src/types.ts` — ContractEvidence, ContractReport, VerificationSummary

3계층: 증거(ContractEvidence) → specId별 집계(ContractReport) → 전체 요약(VerificationSummary)

## 퍼블릭 API ^api-surface

참조: `packages/spec-tracker/src/index.ts` — 전체 export surface

- `SpecCollector` — 인메모리 증거 수집기 (`packages/spec-tracker/src/collector.ts`)
- `generateReport()` — 수집된 증거를 specId별로 집계 (`packages/spec-tracker/src/reporter.ts`)
- `spec(specId)` — vitest describe/it 래퍼 (`packages/spec-tracker/src/vitest-adapter.ts`)
- `getGlobalCollector()` — 프로세스 글로벌 수집기

## 사용 예시

참조: `packages/spec-tracker/src/spec-tracker.test.ts` — 전체 사용 패턴

기본 패턴: `spec(specId)` → `s.describe()` / `s.it()` / `s.marker("inputs").it()`

## 제약 조건 ^constraint

- spec-tracker는 순수 라이브러리 — DB/네트워크 직접 접근 없음
- definition-service 동기화는 선택적 (CLI 또는 CI에서 호출)
- 테스트 프레임워크 의존: vitest 어댑터만 제공 (확장 가능)
- ContractEvidence는 불변 — 수집 후 변경 불가
- specId는 definition-catalog에 존재하는 문서 ID여야 함 (존재 검증은 sync 시점)
