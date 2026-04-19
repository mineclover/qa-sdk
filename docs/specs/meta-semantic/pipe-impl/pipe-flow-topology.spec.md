---
def:
  id: pipe-flow-topology
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
sources:
  - packages/core/src/types/pipe-spec.ts
  - packages/core/src/pipe/pipe-fold.ts
---

# PipeFlow Fold Topology 분류

## 목적 ^purpose

하위 패싯과 경로를 단일 `PipeSpec` 인터페이스로 접을 때
외부에서 어떤 실행면을 보게 되는지 분류한다.

## 정의 ^defines

fold topology는 외부 포트 수와 숨겨지는 내부 실행 구조를 기준으로 분류한다.
rollback, feedback, observe 같은 side path는 외부 주 경로에 포함하지 않는다.

| topology | flow kind | 입력 포트 수 | 출력 포트 수 | 특이사항 |
|------|------|------|------|------|
| atomic | step | 1 | 1 | 하위 자식 없음 |
| linear | sequence | 1 | 1 | 내부 `steps` N개를 직렬로 접음 |
| conditional | branch, optional | 1 | 1 | 내부 후보 경로는 2+이지만 외부 결과는 1개 |
| concurrent | parallel, race, await | 1 | 1 | fan-out/join 또는 조건 대기를 숨기고 주 경로 1개로 환원 |
| resilient | retry, fallback, circuit-breaker | 1 | 1 | 재시도·대체·차단 상태를 같은 계약에 흡수 |
| iterative | loop, feedback | 1 | 1 | back-edge를 숨기고 수렴한 결과만 노출 |
| transactional | compensate, finally, transition-scope | 1 | 1 | rollback/cleanup은 내부 보조 경로 |
| signaling | emit | 0-1 | 1 | 입력 없이 신호 생성 가능 |
| temporal | timeout, throttle, debounce | 1 | 0-1 | 시간 게이트가 지연·소거·우회를 결정 |
| batch | map, reduce, buffer, filter | 1 | 1 | 외부 포트는 collection/batch 단위 1쌍 |
| transformation | split, enrich | 1-2 | 1-N | split은 fan-out, enrich는 side input 병합 |
| streaming | resequence, window | 1 | 1 | 내부 버퍼/윈도우 상태를 숨김 |
| stateful | dedup, correlation | 1-2 | 0-1 | 숨은 state store가 방출 시점을 결정 |
| observational | tap | 1 | 1 | 주 경로는 pass-through, 관측 branch는 side effect only |

총 14개 topology가 현재 flow kind 전체를 덮는다.

## 구현 참조

- `packages/core/src/types/pipe-spec.ts` — flow kind 정의
- `packages/core/src/pipe/pipe-fold.ts` — fold 대상 구조
- `packages/core/src/pipe/pipe-zoom.ts` — topology를 시각 요약으로 소비
