---
def:
  tier: component
  id: coord-semantic-indexing-logic
  type: knowledge
  knowledge_kind: adr
  scope: flow
  aspect: process_flow
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, search, runtime]
  links:
    - target: coord-foundation
      type: refines
    - target: coord-id-allocation-design
      type: depends_on
    - target: data-design-catalog
      type: depends_on
    - target: address-index-spec
      type: depends_on
    - target: axis-decision-guide
      type: traces_to
    - target: def-svc-semantic-grounding-module
      type: traces_to
---

# 의미론 인덱싱 기본 로직

## 목적 ^purpose

qa-sdk를 RAG, text-to-SQL, 사용자 친화적 검색 인덱스 관리를 위한 의미론 관리 + 인덱싱 솔루션으로 운용할 때의 기본 처리 흐름과 컴포넌트 책임을 정의한다.

## 기본 명제

qa-sdk는 검색 엔진 자체가 아니다. qa-sdk는 검색, RAG, SQL 생성기가 공유할 **의미 기준점**을 관리한다.

| 하지 않는 것 | 하는 것 |
|---|---|
| 벡터 DB 대체 | 벡터 검색 전후의 의미 범위 제한 |
| SQL 생성기 대체 | 자연어를 schema/entity/relation 후보로 grounding |
| 전문 검색 엔진 대체 | label/alias/tag와 semantic address 연결 |
| 분산 ID 생성기 대체 | record identity와 semantic address 분리 |

## 처리 루프

```txt
raw docs / schema / events / code
  -> semantic extraction
  -> canonical labels / aliases / entities / relations
  -> 5Q axis decision
  -> prefix + version + address
  -> address index + text index + vector index + SQL metadata index
  -> RAG / text-to-SQL / user search grounding
  -> unresolved terms + feedback
  -> alias 추가 / entry 추가 / axis 승격 / version 전환
```

이 루프의 핵심은 자연어를 바로 검색/SQL로 보내지 않고, 먼저 의미 후보와 좌표 후보로 제한하는 것이다.

## 컴포넌트 책임

| 컴포넌트 | 입력 | 출력 | 책임 |
|---|---|---|---|
| `SemanticCatalog` | 축, entry, prefix, relation, label, alias | canonical semantic graph | 의미 SSOT. 사람이 이해하는 이름과 기계 좌표를 함께 보관 |
| `SemanticResolver` | user text, query, schema phrase | candidate list + confidence + evidence | 자연어를 canonical 후보로 해석. 애매하면 여러 후보를 유지 |
| `IndexMaterializer` | catalog snapshot | address/FTS/vector/SQL metadata indices | 같은 semantic source를 여러 검색 인덱스로 투영 |
| `GroundingPlanner` | intent + candidates + context | retrieval/search/SQL plan | RAG, text-to-SQL, 검색별 후보 공간과 fallback 결정 |
| `FeedbackPromoter` | unresolved term, wrong hit, failed SQL | alias/entry/axis/version proposal | 실패를 catalog 변경 후보로 되돌림 |

## 현재 구현 매핑

definition-service의 1차 구현은 메모리 상주 catalog가 아니라 SQLite projection을 기준으로 둔다. 문서 수가 커져도 semantic snapshot과 feedback event를 프로세스 메모리에 전부 들고 있지 않기 위해서다.

| 개념 컴포넌트 | 현재 구현 |
|---|---|
| `SemanticCatalog` | `semantic_terms`/`semantic_aliases`/`semantic_relations` + `SqlSemanticGroundingStore` |
| `SemanticResolver` | `resolveSemanticCandidates()` |
| `IndexMaterializer` | `SemanticGroundingService.materializeDocuments()` + `SyncService.rebuildSearchIndex()` |
| `GroundingPlanner` | `planDocumentSearch()` + `DocsService.searchWithSemanticGrounding()` |
| `FeedbackPromoter` | `recordDocumentSearch()` + `semantic_feedback_proposals` |

관련 소스는 `def-svc-semantic-grounding-module`의 `sources`를 따른다. 현재 채택한 단순화는 docId 직접 조회, candidate subset overlap, no-candidate 경로의 요청 `limit/offset` 유지, sync rebuild의 페이지 순회다.

## RAG 기본 로직

RAG는 텍스트 유사도만으로 시작하지 않는다.

```txt
query
  -> SemanticResolver
  -> prefix/version/address 후보
  -> address filter + FTS/vector search
  -> evidence rerank
  -> answer with cited semantic scope
```

실패 신호:
- 검색 결과가 많지만 같은 semantic scope가 없다 -> alias/tag 부족
- 답변은 맞지만 citation scope가 흔들린다 -> chunk materialization 문제
- 사용자가 같은 표현을 반복 검색한다 -> canonical alias 후보

## text-to-SQL 기본 로직

text-to-SQL은 SQL 생성 전에 schema 의미를 고정한다.

```txt
natural language
  -> intent + entity + metric + relation 후보
  -> table/field/join 후보 제한
  -> SQL 생성
  -> execution/evidence 검증
```

`timestamp`, `user_id`, request id처럼 무한 증가하거나 인스턴스별 값은 axis가 아니라 payload/table_ref로 남긴다. axis에는 stable하고 공유되는 의미 분류만 올린다.

## 사용자 검색 기본 로직

사용자는 canonical id를 모르므로 표현 계층이 1급이다.

```txt
"상품 담기"
  -> alias match: cart add, add to cart
  -> canonical entry
  -> cart_event:v2:<address>
  -> linked docs/events/schema/search results
```

검색 UX는 raw text hit보다 "왜 이 결과가 같은 의미인지"를 설명해야 한다. label, alias, tag, relation evidence가 이 설명의 재료다.

## 경계 규칙

1. canonical semantic graph는 `SemanticCatalog`가 소유한다.
2. resolver는 후보와 confidence를 만들 뿐 catalog를 직접 수정하지 않는다.
3. materializer는 파생 인덱스를 만든다. 의미 판단을 새로 하지 않는다.
4. planner는 목적별 검색 계획을 만든다. RAG/text-to-SQL/search의 scoring을 한 함수에 합치지 않는다.
5. feedback은 즉시 catalog 변경이 아니라 proposal로 남긴다. axis 승격은 5Q를 통과해야 한다.

## 채택 기준

| 질문 | 통과 기준 |
|---|---|
| 사람이 이해 가능한가 | query 표현에서 canonical label/alias까지 추적 가능 |
| RAG에 도움이 되는가 | vector search 전에 semantic scope를 좁힐 수 있음 |
| text-to-SQL에 도움이 되는가 | table/field/relation 후보가 semantic evidence로 제한됨 |
| 검색 인덱스 관리에 도움이 되는가 | FTS/vector/address/SQL metadata index가 같은 catalog snapshot에서 생성됨 |
| 운영 가능한가 | unresolved term이 alias/entry/axis/version proposal로 돌아옴 |
