---
def:
  id: pipe-fold-lineage
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

# Fold 압축 시 계보 통합

## 목적 ^purpose

`foldSubgraph`로 노드를 접을 때, 내부 계보를 압축하여
접힌 노드의 입출력 계보만 보존한다.

## ^defines

- [x] fold 시 `summarizeFlowLineage`로 접힌 구간의 입출력 요약 생성 (`computeFoldLineageSummary`)
- [x] `FoldedContract.lineageSummary?: FlowLineageSummary` 필드 추가
- [x] `computeFoldedContract`에서 자동 채움
- [x] 테스트 1건
- [x] unfold 시 원본 계보 복원 (향후)
- [x] fold 경계 = 체크포인트: 입력 형태 → 출력 형태 검증 (향후)

## ^consumes

- `summarizeFlowLineage` (pipe-lineage.ts)
- `foldSubgraph`, `FoldedContract` (pipe-fold.ts)
