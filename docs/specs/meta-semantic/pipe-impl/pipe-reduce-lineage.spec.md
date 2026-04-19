---
def:
  id: pipe-reduce-lineage
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-static-lineage
      type: refines
---

# Reduce/Accumulator 계보 표현

## 목적 ^purpose

`PipeReduce`의 accumulator가 최종 출력 계보에 반영되도록 reduce 전용 lineage 규칙을 정의한다.

## ^defines

- `PipeReduce.accumulator`는 consumes+produces에 같은 필드가 나타나는 accumulator 패턴으로 표현한다
- `deriveStaticLineage`는 reduce step에서 내부 계보와 accumulate 패턴을 함께 처리한다
- transform kind는 `aggregate`를 사용해 집계형 계보를 표현한다
- accumulator가 빠진 reduce step은 계보 불완전 warning 대상이다

## ^consumes

- `PipeReduce` (`pipe-spec.ts`)
- `deriveStaticLineage`, `extractStepLineage` (`pipe-lineage.ts`)
