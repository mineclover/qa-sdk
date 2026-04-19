---
def:
  id: pipe-connection-catalog
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope]
  links:
    - target: meta-semantic-pipe-catalog
      type: refines
    - target: pipe-types
      type: refines
    - target: pc-next
      type: contains
    - target: pc-conditional
      type: contains
    - target: pc-event
      type: contains
    - target: pc-error
      type: contains
    - target: pc-compensate
      type: contains
    - target: pc-fan-out
      type: contains
    - target: pc-join
      type: contains
    - target: pc-feedback
      type: contains
---

# ConnectionKind 카탈로그 — 8종 파이프 간 연결

## 목적 ^purpose

PipeGraph에서 파이프 노드를 연결하는 8종 `ConnectionKind`의
표현 방식, 정의 방식, 검증 방식, 경로 계산 규칙을 카탈로그 관점에서 정리한다.
개별 연결의 의미와 예시는 각 `pc-*` 문서가 책임진다.

## 방법 ^method

이 문서는 연결 자체의 실행 순서보다 "연결 kind 분류와 semantics 표"를 다루므로
runtime flow 문서가 아니라 카탈로그 문서로 본다. 그래서 상위 module 좌표는 `data/domain_data`를 유지한다.

## ^overview

`pipe-connection-catalog`은 연결을 세 층으로 묶는다.

- 순차/조건 연결:
  `pc-next`, `pc-conditional`
- 이벤트/에러/보상 연결:
  `pc-event`, `pc-error`, `pc-compensate`
- 동시성/제어 연결:
  `pc-fan-out`, `pc-join`, `pc-feedback`

모든 연결은 `PipeConnection` 타입 위에서 정의되고,
경로 계산, 시뮬레이션, 검증, concern 전파가 공통 소비층으로 연결된다.

## 위임 ^delegates

| family | 하위 문서 |
|--------|-----------|
| 순차 | `pc-next`, `pc-conditional` |
| 이벤트/에러 | `pc-event`, `pc-error`, `pc-compensate` |
| 동시성/제어 | `pc-fan-out`, `pc-join`, `pc-feedback` |

## 연결 family 개요

| family | kind | 설명 |
|--------|------|------|
| 순차 | `next`, `conditional` | 완료 후 다음 실행 또는 조건부 실행 |
| 이벤트 | `event` | 생산 이벤트가 후속 파이프를 트리거 |
| 에러/보상 | `error`, `compensate` | 실패 처리와 saga 보상 |
| 동시성 | `fan-out`, `join` | 1:N 분기와 N:1 합류 |
| 제어 | `feedback` | 폐루프 재트리거와 수렴 |

## 소비 ^consumes

- `pipe-types` — `ConnectionKind`, `PipeConnection` 타입 정의
- `pipe-path` — 연결별 경로 수 계산
- `pipe-simulate` — 연결 semantics 실행
- `pipe-validate` — 연결 정합성 검증
- `pipe-interpret` — 연결별 concern 전파 규칙
