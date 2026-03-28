---
def:
  id: spec-temporal-infra
  address: def_document:v1:2153
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [entry-point]
  links:
    - target: temporal-relations
      type: refines
---

# Spec 시간 관계 인프라

## 목적 ^purpose

시간 관계 수집의 구현 우선순위, 인프라 요구사항, 불변식을 분리해 temporal relation 기능의 도입 규칙을 정리한다.

## 구성 ^overview

- `구현 우선순위`: 수집 가능성 검증 → 저장 경계 설계 → 분석 기능 연결 순서를 정의한다.
- `인프라 요구사항`: 이벤트 순서 보존, 지연 허용 범위, 재계산 비용의 기준을 기술한다.
- `불변식`: trace/session 내 순서 일관성과 복구 최소 단위를 명시한다.
- `타임스탬프 처리 규칙`: ISO-8601 비교, normalizeTimestamp, compareTimestamps 규칙을 정리한다.

## 구현 우선순위

시간 관계 기능 도입은 3단계 순서:

1. **수집 가능성 검증**: 기존 EventRecord의 timestamp, qa_session_id, trace_id 필드만으로 순서 추출이 가능한지 확인한다. 추가 필드 없이 session 단위 정렬이 가능하면 통과.
2. **저장 경계 설계**: 추출된 순서 패턴을 어디에 저장할지 결정한다. RecordStore에 부가 인덱스를 추가하거나, 별도 temporal store를 도입하거나, convergence 파이프라인의 결과로 DKG에 기록한다.
3. **분석 기능 연결**: 저장된 순서 패턴을 FlowDefinition과 비교하고, ScenarioSpec verdict 계산에 활용한다.

각 단계는 이전 단계가 검증된 후에만 진행한다. 2단계에서 추가 저장소가 필요하면 STORE_DRIVER 확장 패턴을 따른다.

## 인프라 요구사항

| 요구사항 | 기준 | 비고 |
|----------|------|------|
| 이벤트 순서 보존 | timestamp 정밀도 ms 이상 | ISO-8601 datetime |
| 지연 허용 범위 | 같은 session 내 ±5초 | 네트워크 지연 감안 |
| 재계산 비용 | session 완료 후 1회 | 실시간 계산 아님 |
| 저장 비용 | 원본 record 대비 5% 이하 | 순서 메타데이터만 |

- Phase 2 비동기 경로에서 처리한다. Phase 1 동기 경로에 부하를 주지 않는다.
- convergence 실패가 verdict/활성화를 차단하지 않는다 (에러 격리 원칙).

## 불변식

같은 trace/session에서 순서 정보의 일관성을 보장하는 규칙:

1. **단조 증가 보장 불가**: 분산 환경에서 timestamp가 역전될 수 있다. 역전 감지 시 경고를 기록하되 데이터를 거부하지 않는다.
2. **복구 최소 단위**: session이 복구 최소 단위이다. session 내 이벤트가 모두 수집되면 순서를 재계산할 수 있다. 부분 수집은 불완전 순서로 표기한다.
3. **trace vs session**: trace는 SDK flush 타이밍(전송 단위), session이 사용자 행동 단위이다. 시간 관계는 session 기준으로 수집한다.
4. **synthetic/system 이벤트 제외**: 자동 생성된 이벤트는 사용자 행동 순서에서 제외한다 (Auto IL과 동일 규칙).

## 타임스탬프 처리 규칙

ISO-8601 타임스탬프의 비교와 정규화:

- **문자열 비교 금지**: `<`, `>`, `localeCompare` 사용 금지.
- **compareTimestamps(a, b) 사용**: @qa-sdk/core에서 제공하는 비교 함수.
- **외부 입력 정규화**: `normalizeTimestamp()`를 거친 후 비교한다.
- 정밀도: 밀리초(ms) 단위까지 보존한다. 마이크로초 이하는 절삭한다.
