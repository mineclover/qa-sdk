---
def:
  id: conventions-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
---
# conventions-system

## 목적 ^purpose

좌표 시스템의 ID 네이밍, 예약 항목, 가속 지향 설계 등 핵심 컨벤션.

좌표 시스템의 ID 네이밍, 예약 항목, 가속 지향 설계 등 핵심 컨벤션.

## contains

| 문서 | id | 설명 |
|------|-----|------|
| [conv-naming.spec.md](conv-naming.spec.md) | conv-naming | 축/entry/prefix ID의 네이밍 제약 |
| [conv-reserved-entries.spec.md](conv-reserved-entries.spec.md) | conv-reserved-entries | Reserved Entry 규칙 |
| [conv-acceleration.spec.md](conv-acceleration.spec.md) | conv-acceleration | 가속 지향 설계 규칙 |

## overview

3개: ID 네이밍 제약, 예약 항목(Reserved Entry), 가속 지향 설계 규칙.

`weighted-index`와 `index-meta`를 사용하는 프로젝트에서 따라야 하는 규칙.
기반 원리는 `foundation.md`, 사용 패턴은 `patterns.md`를 참조한다.

## 원본

분할 전 원본: `docs/specs/indexing/conventions.md` (indexing-conventions)
