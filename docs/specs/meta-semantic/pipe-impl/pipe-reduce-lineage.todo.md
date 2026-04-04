---
def:
  id: pipe-reduce-lineage
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: implemented
  layer: domain
  links:
    - target: pipe-static-lineage
      type: depends_on
---

# Reduce/Accumulator 계보 표현

## 목적 ^purpose

`PipeReduce`의 `accumulator` 변수가 계보에서 표현되지 않는 갭을 해결한다.
reduce step이 accumulator를 통해 입력을 집계할 때, 최종 출력의 계보에
accumulator를 거친 입력들이 포함되어야 한다.

## ^defines

- [x] `PipeReduce.accumulator`를 lineageHints에서 표현하는 컨벤션: consumes+produces에 같은 필드 = accumulator 패턴
- [x] `deriveStaticLineage`에서 reduce step 처리 — step 내부 계보 + accumulate 패턴 (transform: "aggregate")
- [x] 테스트 2건: hints 있는 reduce + hints 없는 reduce
- [x] accumulator가 없는 reduce step → warning (계보 불완전)

## ^consumes

- `PipeReduce` (pipe-spec.ts) — `step`, `initial`, `accumulator` 필드
- `deriveStaticLineage`, `extractStepLineage` (pipe-lineage.ts)
