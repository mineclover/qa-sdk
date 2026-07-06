---
def:
  id: def-svc-api-contract
  tier: component
  address: def_document:v2:412808
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [entry-point, contract, runtime]
  links:
    - target: definition-service-system
      type: refines
sources:
  - packages/definition-service/src/modules/docs/docs.controller.ts
  - packages/definition-service/src/modules/sync/sync.controller.ts
  - packages/definition-service/src/modules/graph/graph.controller.ts
  - packages/definition-service/src/modules/graphql/doc.resolver.ts
  - packages/definition-service/src/modules/graphql/doc.object.ts
  - packages/definition-service/src/modules/tests/tests.controller.ts
  - packages/definition-service/src/modules/prefixes/prefixes.controller.ts
  - packages/definition-service/src/modules/intents/intents.controller.ts
  - packages/definition-service/src/modules/consumption/consumption.controller.ts
---
# Definition Service — API 계약

## 목적 ^purpose

definition-service의 REST + GraphQL 엔드포인트 명세. 요청/응답 형식, 필터 파라미터, 에러 코드를 정의한다.

## REST API ^overview

### 문서 (DocsController)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/docs` | 목록 (type, knowledge-kind, level, scope, aspect, depth, lifecycle, layer, svc, tag, address, q, limit, offset, sort) |
| GET | `/docs/by-file?path=` | code reference 기준 문서/바운더리 해석 |
| GET | `/docs/by-address/:address` | 주소 기준 단건 조회 |
| GET | `/docs/by-address/:address/incoming-links` | 주소 기준 역링크 |
| GET | `/docs/by-address/:address/outgoing-links` | 주소 기준 순방향 링크 |
| GET | `/docs/:id` | 단건 조회 |
| GET | `/docs/:id/body` | 본문 snapshot 조회 |
| PATCH | `/docs/:id` | 메타데이터 업데이트 (AxisRegistry 검증 + address 재계산) |
| GET | `/docs/:id/children` | contains 자식 |
| GET | `/docs/:id/parent` | contains 부모 |
| GET | `/docs/:id/incoming-links` | 역링크 |
| GET | `/docs/:id/synthetic-incoming-links` | synthetic 역링크 (`feedback_request`) |
| GET | `/docs/:id/outgoing-links` | 순방향 링크 |
| GET | `/docs/:id/feedback-requests` | 문서와 연결된 feedback request 요약 |
| GET | `/docs/:id/boundary` | 바운더리 구조 + direct coupling (`level=purpose|overview`) |
| POST | `/docs/:id/links` | 단일 링크 추가 `{target, type}` |
| DELETE | `/docs/:id/links/:target/:type` | 단일 링크 삭제 |
| POST | `/docs/:id/tags/:tag` | 단일 태그 추가 |
| DELETE | `/docs/:id/tags/:tag` | 단일 태그 삭제 |
| GET | `/docs/:id/history` | 버전 이력 |
| GET | `/docs/:id/history/:version` | 특정 버전 body 포함 조회 |

### 동기화 (SyncController)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/sync` | file → DB |
| POST | `/sync/to-files` | DB → file (frontmatter 역동기화) |
| GET | `/sync` | 마지막 동기화 결과 |
| GET | `/sync/to-files` | 마지막 역동기화 결과 |

### 그래프 (GraphController)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/graph/:id/impact` | 영향 분석 (blast radius, BFS) |
| GET | `/graph/by-address/:address/impact` | 주소 기준 영향 분석 |
| GET | `/graph/:id/concerns` | concern 전파 (직접 + 상속) |
| GET | `/graph/:id/boundary-context` | boundary + concerns + impact + feedback trace (`level`, `mode=direct|transitive`) |
| GET | `/graph/by-address/:address/boundary-context` | 주소 기준 boundary context |
| POST | `/graph/validate` | 깨진 링크, 순환 참조, 고아 문서 |

## GraphQL API

엔드포인트: `POST /graphql` (GraphiQL: `GET /graphql`)

```graphql
type Query {
  doc(id: String!): Doc
  docByAddress(address: String!): Doc
  docList(scope, aspect, depth, layer, svc, tag, q, limit, offset): [Doc!]!
  boundary(docId: String!, level: String): BoundaryResultType
  boundaryContext(docId: String!, level: String, mode: String): BoundaryContextResultType
  impact(docId: String!): ImpactAnalysisResult
  concerns(docId: String!): ConcernsResult
  validateGraph: ValidationResultType
}

type Doc {
  docId, scope, aspect, depth, lifecycle, layer, tags, links, address, purpose, ...
  children: [Doc!]!       # lazy — contains 링크 자식
  parent: Doc             # lazy — contains 링크 부모
  incomingLinks: [IncomingLink!]!  # lazy — 역링크
  syntheticIncomingLinks: [SyntheticIncomingLink!]!  # lazy — feedback_request 등 synthetic 역링크
  feedbackRequests: [FeedbackRequestSummary!]!       # lazy — 연결된 feedback request 요약
  boundary: BoundaryResultType       # lazy — 이 문서의 boundary 구조 + direct coupling
  boundaryContext: BoundaryContextResultType  # lazy — 이 문서의 복합 boundary context (기본 overview/transitive)
}

type BoundaryResultType {
  boundary: BoundaryDoc!
  members: [BoundaryMember!]!
  couplings: BoundaryCouplings!
}

type BoundaryContextResultType {
  mode: String!
  level: String!
  boundary: BoundaryResultType!
  concerns: BoundaryContextConcernsResultType!
  impact: BoundaryContextImpactResultType!
  feedbackTrace: [FeedbackRequestSummary!]!
}

type ImpactAnalysisResult {
  sourceId: String!
  impacted: [ImpactedDoc!]!
  blastRadius: Int!
  feedbackTrace: [FeedbackRequestSummary!]!          # source + impacted docs에 걸린 최근 feedback request 집계
}
```

### GET /docs 응답 형식

```json
{
  "docs": [{ "docId": "...", "scope": "...", ... }],
  "total": 151,   // 필터 조건 전체 매칭 건수 (limit 무관)
  "offset": 0,    // 현재 오프셋
  "limit": 50     // 요청된 페이지 크기
}
```

### GET /docs/:id/boundary 응답 형식

```json
{
  "boundary": {
    "docId": "viteplus-playbook-template-implementation",
    "title": "Vite+ Playbook Template 구현",
    "scope": "feature",
    "aspect": "func_def",
    "depth": "implementation",
    "lifecycle": "approved",
    "purpose": "..."
  },
  "members": [
    { "docId": "child-doc", "scope": "state", "aspect": "app_state", "summary": "..." }
  ],
  "couplings": {
    "outgoing": [
      { "type": "depends_on", "target": "sdk-usage-guide", "summary": "..." }
    ],
    "incoming": [
      { "type": "depends_on", "source": "feature-doc", "summary": "..." }
    ]
  }
}
```

- `level=purpose`
  `purpose` 기준 구조 요약만 반환
- `level=overview` (기본)
  `purpose` + `overview`를 함께 사용해 summary를 만든다
- `mode=direct`
  one-hop direct coupling, direct concern, depth 1 impact만 반환
- `mode=transitive` (기본)
  concern/impact 전파를 전체 그래프 기준으로 확장한다

### sort 파라미터

| 값 | 정렬 기준 |
|---|---|
| `doc_id` (기본) | 문서 ID 알파벳순 |
| `synced_at` | 동기화 시각 오름차순 |
| `synced_at_desc` | 동기화 시각 내림차순 (최근 변경 우선) |

### 검색 (q 파라미터)

- FTS5 trigram 토크나이저로 한국어/영어 부분 문자열 매칭
- FTS5 결과 0건 시 LIKE fallback 자동 전환
- 검색 대상: purpose, intent, context, caveat, doc_id

### 에러 코드

| HTTP | 의미 |
|------|------|
| 400 | 유효하지 않은 scope/aspect/depth (AxisRegistry 검증 실패) |
| 404 | 문서 없음 |
| 200 | 성공 (action: created/updated/unchanged) |
