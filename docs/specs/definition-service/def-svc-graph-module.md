---
def:
  id: def-svc-graph-module
  address: def_document:v1:538
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [tier-infra]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-docs-module
      type: depends_on
---
# Definition Service — Graph Module

## 목적 ^purpose

DB edge 테이블 기반으로 영향 분석(blast radius), concern 전파, 그래프 검증을 수행하는 모듈. 파일 스캔(scanAndBuild) 없이 SQL 쿼리만으로 그래프 연산을 처리한다.

## 구성 ^overview

- `GraphService`: DocsService 의존, document_links 기반 BFS
- `GraphController`: REST + GraphQL 양쪽 노출
- `DocResolver`: GraphQL ResolveField로 children/parent/incomingLinks lazy 로딩

### 기능

| 엔드포인트 | 로직 | DB 의존 |
|-----------|------|---------|
| `GET /graph/:id/impact` | analyzeImpact() — BFS blast radius | document_links (outgoing + incoming) |
| `GET /graph/:id/concerns` | computeEffectiveConcerns() — BFS 전파 | document_links + tags_json |
| `POST /graph/validate` | 깨진 링크 + 순환 참조 + 고아 문서 | documents + document_links |
| GraphQL `impact(docId)` | 동일 로직 | 동일 |
| GraphQL `validateGraph` | 동일 로직 | 동일 |
