---
def:
  id: def-svc-semantic-grounding-module
  tier: component
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, search, structural]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-data-model
      type: depends_on
    - target: coord-semantic-indexing-logic
      type: traces_to
sources:
  - packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts
  - packages/definition-service/src/stores/semantic-grounding-store.ts
  - packages/definition-service/src/core/semantic-grounding/types.ts
  - packages/definition-service/src/core/semantic-grounding/resolver.ts
  - packages/definition-service/src/core/semantic-grounding/planner.ts
  - packages/definition-service/src/core/semantic-grounding/feedback.ts
---
# Definition Service — Semantic Grounding Module

## 목적 ^purpose

definition-service 문서를 semantic term/alias snapshot으로 materialize하고, 사용자 검색어를 canonical 문서 후보로 grounding하며, 실패 신호를 feedback proposal로 되돌리는 모듈이다.

## 구성 ^overview

| 책임 | 구현 | 설명 |
|------|------|------|
| catalog projection | `SqlSemanticGroundingStore` | semantic_terms/aliases/relations/events/feedback_proposals SQLite 테이블 소유 |
| resolver | `resolveSemanticCandidates()` | normalized label, alias, token overlap 기반 후보와 confidence 산출 |
| materializer | `SemanticGroundingService.materializeDocuments()` | DocRecord에서 term/alias를 생성하고 stale doc term을 제거 |
| grounding planner | `planDocumentSearch()` | confident candidate에서 candidateDocIds를 만들고 fallbackReason을 부여 |
| feedback promoter | `recordDocumentSearch()` + `buildFeedbackProposal()` | no-hit, wrong-scope, semantic/legacy disagreement를 proposal로 dedupe |

## 런타임 흐름

```txt
SyncService.run()
  -> rebuildSearchIndex()
  -> SemanticGroundingService.materializeDocuments(allDocs, replaceSnapshot=true)

DocsService.listPaginated(q)
  -> SemanticGroundingService.planDocumentSearch(q)
  -> SqlDocStore.getMany(candidateDocIds)
  -> SearchService.search/searchCount/matchDocIds
  -> mergeSemanticDocumentResults()
  -> SemanticGroundingService.recordDocumentSearch()
```

## 경계 규칙

- resolver는 catalog를 수정하지 않고 후보만 만든다.
- materializer는 DocRecord snapshot에서 deterministic alias만 만든다. 사용자 feedback 승격은 proposal 상태로 남긴다.
- DocsService는 semantic candidate와 FTS/LIKE 결과를 병합하지만, semantic store를 직접 수정하지 않는다.
- legacy 전체 결과를 재조회하지 않는다. 후보 overlap은 `SearchService.matchDocIds(query, candidateDocIds)`로 제한한다.
- sync snapshot은 페이지 단위 전체 순회 결과를 입력으로 받아 10k 같은 고정 상한에 의존하지 않는다.

## 검증

- `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`
- `packages/definition-service/src/stores/semantic-grounding-store.test.ts`
- `packages/definition-service/src/core/semantic-grounding/resolver.test.ts`
- `packages/definition-service/src/core/semantic-grounding/planner.test.ts`
- `packages/definition-service/src/modules/docs/semantic-search.integration.test.ts`
