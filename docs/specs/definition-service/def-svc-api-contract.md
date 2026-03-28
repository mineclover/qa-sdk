---
def:
  id: def-svc-api-contract
  level: leaf
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [tier-infra]
  links:
    - target: definition-service-system
      type: refines
---
# Definition Service — API 계약

## 목적 ^purpose

definition-service의 REST + GraphQL 엔드포인트 명세. 요청/응답 형식, 필터 파라미터, 에러 코드를 정의한다.

## REST API ^overview

### 문서 (DocsController)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/docs` | 목록 (scope, aspect, depth, lifecycle, layer, svc, tag, address, q, limit, offset, sort) |
| GET | `/docs/:id` | 단건 조회 |
| PATCH | `/docs/:id` | 메타데이터 업데이트 (AxisRegistry 검증 + address 재계산) |
| GET | `/docs/:id/children` | contains 자식 |
| GET | `/docs/:id/parent` | contains 부모 |
| GET | `/docs/:id/incoming-links` | 역링크 |
| GET | `/docs/:id/outgoing-links` | 순방향 링크 |
| POST | `/docs/:id/links` | 단일 링크 추가 `{target, type}` |
| DELETE | `/docs/:id/links/:target/:type` | 단일 링크 삭제 |
| POST | `/docs/:id/tags/:tag` | 단일 태그 추가 |
| DELETE | `/docs/:id/tags/:tag` | 단일 태그 삭제 |
| GET | `/docs/:id/history` | 버전 이력 |

### 동기화 (SyncController)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/sync` | file → DB |
| POST | `/sync/to-files` | DB → file (frontmatter 역동기화) |
| GET | `/sync` | 마지막 동기화 결과 |

### 그래프 (GraphController)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/graph/:id/impact` | 영향 분석 (blast radius, BFS) |
| GET | `/graph/:id/concerns` | concern 전파 (직접 + 상속) |
| POST | `/graph/validate` | 깨진 링크, 순환 참조, 고아 문서 |

## GraphQL API

엔드포인트: `POST /graphql` (GraphiQL: `GET /graphql`)

```graphql
type Query {
  doc(id: String!): Doc
  docList(scope, aspect, depth, layer, svc, tag, q, limit, offset): [Doc!]!
  impact(docId: String!): ImpactAnalysisResult
  concerns(docId: String!): ConcernsResult
  validateGraph: ValidationResultType
}

type Doc {
  docId, scope, aspect, depth, lifecycle, layer, tags, links, address, purpose, ...
  children: [Doc!]!       # lazy — contains 링크 자식
  parent: Doc             # lazy — contains 링크 부모
  incomingLinks: [IncomingLink!]!  # lazy — 역링크
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
