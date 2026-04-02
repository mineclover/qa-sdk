---
def:
  id: prefix-colocation
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: mediation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
---

# Prefix Colocation — 선언 위치 기반 prefix 출처 관리

## 목적 ^purpose

prefix 메타데이터를 소스 선언 위치에 colocate하여 drift를 방지하고 DX를 개선한다.
drizzle 스키마 → table_ref, Enum → axis entries, 쿼리 → event-catalog, 
트랜잭션 → transition 단위로 연결한다.

## ^overview

- drizzle 스키마 `.comment()` → `table_ref` dim 출처 선언
- Enum/const annotation → axis entries 자동 파생
- 쿼리 `.comment({ event_key })` → event-catalog 매핑
- 비즈니스 트랜잭션 → `PipeTransitionScope`로 원자 경계 + 하위 이벤트 소속
- DEMO_CATALOG SSOT 불변 — colocation은 입력 경로 개선

## 상세 TODO

`tasks/todo-prefix-colocation.md` 참조
