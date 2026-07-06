---
def:
  id: pipe-fold-lineage
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
sources:
  - packages/core/src/pipe/pipe-lineage.ts
  - packages/core/src/pipe/pipe-lineage.test.ts
  - packages/core/src/pipe/pipe-fold.ts
  - packages/core/src/pipe/pipe-fold.test.ts
---

# Fold 압축 시 계보 통합

## 목적 ^purpose

`foldSubgraph`가 내부 계보를 접을 때, 접힌 노드의 입출력 계보만 보존하는 압축 규칙을 정의한다.

## ^defines

- fold 시 `summarizeFlowLineage`로 접힌 구간의 입출력 요약을 생성한다 (`computeFoldLineageSummary`)
- `FoldedContract.lineageSummary?: FlowLineageSummary` 필드가 접힌 계보 요약을 보존한다
- `computeFoldedContract`가 fold 시 자동으로 `lineageSummary`를 채운다
- fold 경계는 입력 형태와 출력 형태를 검증하는 체크포인트가 된다

## ^consumes

- `summarizeFlowLineage` (`pipe-lineage.ts`)
- `foldSubgraph`, `FoldedContract` (`pipe-fold.ts`)
