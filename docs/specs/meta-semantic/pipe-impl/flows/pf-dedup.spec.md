---
def:
  id: pf-dedup
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# PipeFlow: dedup — 중복 제거

## 목적 ^purpose

같은 key 재입력 시 소멸. 카테고리: 상태.

## 정의 방식

필드: keyField(필수), ttl, step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

중복 소멸 + ttl 경과 후 재통과

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step) + 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
