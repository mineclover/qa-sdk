---
def:
  id: analysis-path-observation-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: analysis-path-observation
      type: depends_on
---

# Path Observation — 구현 TODO

## 목적 ^purpose

경로 관측 엔진에서 아직 spec로 승격되지 않은 잔여 구현 항목과 후속 정리 작업을 추적한다.

## 완료 → spec 병합됨

- recovery_used 추적 → `analysis-path-observation.spec.md` §recovery_used 판정

## 비선형 경로 순회 — 완료 (2026-04-05)

코드: `packages/engine/src/path-observation/observe-path.ts`
테스트: 5건 추가 (총 18 tests)

- [x] `deriveBranchPaths(specGraph, observation)` — 분기 지점 탐지 + taken/untaken 분류
- [x] `deriveNonLinearObservation(match, spec, runtime)` — PathObservation + 분기 분석 합성
- [x] `BranchPoint`, `BranchPath`, `NonLinearPathObservation` 타입
- [x] 분기 커버리지 (taken/total/rate)
- [x] 분기별 독립 관측 노드 수집 (DFS)
