---
def:
  id: definition-management
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: definition-taxonomy
      type: depends_on
    - target: definition-level
      type: depends_on
    - target: definition-concern
      type: depends_on
    - target: definition-assembly
      type: depends_on
    - target: harness-architecture
      type: depends_on
    - target: definition-mgmt-coordinates
      type: contains
    - target: definition-mgmt-graph-links
      type: contains
    - target: definition-mgmt-state-tracking
      type: contains
    - target: definition-mgmt-feedback-loop
      type: contains
    - target: definition-mgmt-verification-loop
      type: contains
    - target: definition-mgmt-consistency-rules
      type: contains
---

# Definition Management — 좌표 기반 운영

## 목적 ^purpose

문서, 코드, 테스트, 관측을 하나의 좌표 체계로 관통 관리하는 운영 참조점. definition-catalog의 분류, 그래프 연결, 상태 추적, 피드백 루프를 한 흐름으로 읽게 한다.

## 구성 ^overview

- `definition-mgmt-coordinates`: 문서에 좌표를 부여하는 기준. layer, docType, level, scope×aspect, depth, tag를 어떤 질문으로 결정하는지 정리한다.
- `definition-mgmt-graph-links`: contains 계층과 횡방향 링크가 어떻게 함께 정의 그래프를 구성하는지 정리한다.
- `definition-mgmt-state-tracking`: harness와 quality gate가 definition 상태를 어떻게 추적하는지 정리한다.
- `definition-mgmt-feedback-loop`: 관측, feedback request, decision, infra 전이가 어떻게 순환하는지 정리한다.
- `definition-mgmt-verification-loop`: build, sync, validate, audit, quality, vitest 회귀를 어떤 순서로 반복해야 하는지 정리한다.
- `definition-mgmt-consistency-rules`: 주소 불변, 단일 개념 원칙, 상태 좌표화 등 운영 규칙을 정리한다.

## 관리 흐름

```
좌표 부여
  → 그래프 연결
    → 상태 추적
      → 관측/피드백 루프
        → 검증 루프
          → 운영 규칙으로 회수
```

이 문서는 위 5단계를 하나의 관리 흐름으로 읽게 하는 루트 모듈이다.

## 단계 요약

| 단계 | 질문 | 문서 |
|------|------|------|
| 1 | 이 정의는 어디에 놓이는가 | `definition-mgmt-coordinates` |
| 2 | 정의들이 어떻게 교류하는가 | `definition-mgmt-graph-links` |
| 3 | 이 정의의 현재 상태는 무엇인가 | `definition-mgmt-state-tracking` |
| 4 | 관측이 어떻게 정의를 다시 바꾸는가 | `definition-mgmt-feedback-loop` |
| 5 | 무엇을 어떤 순서로 검증하는가 | `definition-mgmt-verification-loop` |
| 6 | 무엇을 지켜야 일관성이 유지되는가 | `definition-mgmt-consistency-rules` |

## 사용 맥락 ^context

| 상황 | 우선 볼 문서 |
|------|-------------|
| 새 문서 생성 | `definition-mgmt-coordinates` |
| 문서 분류/이동 | `definition-mgmt-coordinates`, `definition-mgmt-graph-links` |
| 상태 조회/전이 | `definition-mgmt-state-tracking` |
| 피드백 루프 추적 | `definition-mgmt-feedback-loop` |
| 검증 순서 정하기 | `definition-mgmt-verification-loop` |
| 규칙 점검 | `definition-mgmt-consistency-rules` |

## 주의사항 ^caveat

- 이전 단일 리프 문서의 상세 설명은 하위 멤버 문서로 이동했다.
- 이 문서는 개요와 단계 지도를 유지하고, 세부 정의는 하위 문서가 소유한다.

## 관련 문서

| 문서 | 역할 |
|------|------|
| `definition-system-philosophy.md` | 좌표 기반 문서화 철학 |
| `definition-catalog.spec.md` | definition-catalog 전체 구조 |
| `review-ledger.spec.md` | feedback request와 definition 연동 |
