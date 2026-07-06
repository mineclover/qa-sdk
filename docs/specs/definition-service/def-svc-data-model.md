---
def:
  id: def-svc-data-model
  tier: component
  address: def_document:v2:342160
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [data, persistence, structural]
  links:
    - target: definition-service-system
      type: refines
sources:
  - packages/definition-service/src/db/schema.ts
---
# Definition Service — 데이터 모델

## 목적 ^purpose

definition-service가 관리하는 SQLite 테이블 구조와 데이터 흐름을 정의한다.

## 구성 ^overview

### 핵심 테이블

| 테이블 | 역할 | 행 수 기준 |
|--------|------|-----------|
| documents | 문서 메타데이터 최신 버전 | 문서 수와 동일 |
| document_links | 문서 간 관계 (정규화 edge) | link frontmatter와 동기화 |
| documents_fts | 전문 검색 (FTS5, purpose/intent/context/caveat) | documents 재색인 결과 |
| document_history | 버전 이력 (body 포함) | 누적 |
| semantic_terms | canonical semantic term | sync materialization 결과 |
| semantic_aliases | term별 alias/label 후보 | materialization + 수동/feedback source |
| semantic_relations | term 간 relation edge | semantic graph 확장 지점 |
| semantic_grounding_events | query grounding 관측 이벤트 | 검색 실행 누적 |
| semantic_feedback_proposals | unresolved/wrong-scope 보정 후보 | dedupeKey 기준 누적 |
| aspect_parents | aspect 계층 파생 복제본 | definition-catalog vocabulary와 동기화 |

### documents 컬럼

| 컬럼 | 타입 | SSOT | 설명 |
|------|------|------|------|
| doc_id | TEXT PK | 파일 | 문서 고유 ID |
| scope, aspect, depth | TEXT | DB | 좌표 3차원 |
| lifecycle | TEXT | DB | draft/review/approved/deprecated/archived |
| layer | TEXT | DB | domain/operation/mediation/experience |
| tags_json | TEXT | DB | JSON 배열 |
| links_json | TEXT | DB | JSON 배열 (document_links와 동기화) |
| svc | TEXT | DB | 서비스 연결 |
| address | TEXT | DB (계산) | def_document:v1:\<N\> |
| version | INTEGER | DB | 자동 증가 |
| body_hash | TEXT | 계산 | SHA-256 |
| purpose, intent, context, caveat | TEXT | 파일 | ^marker 추출 |
| source_path | TEXT | 파일 | docs/ 기준 상대 경로 |

### semantic_grounding 계열 테이블

| 테이블 | 핵심 키 | 설명 |
|--------|---------|------|
| semantic_terms | term_id | `kind`, canonical label, optional coordinate/prefix/version/address/docId를 묶은 semantic SSOT projection |
| semantic_aliases | alias_id + `(term_id, normalized_alias, source)` unique | 동일 alias라도 source별 confidence를 보존한다 |
| semantic_relations | relation_id | same-scope/depends-on/contains/refines/mentions 관계 확장 슬롯 |
| semantic_grounding_events | event_id | query, intent, candidates, plan, outcome을 기록한다 |
| semantic_feedback_proposals | proposal_id + dedupe_key unique | alias-add/entry-add/axis-promotion/version-transition/wrong-scope 후보 |

### 인덱스

- `idx_doc_scope ON (scope, aspect)` — scope×aspect 필터
- `idx_doc_lifecycle ON (lifecycle)` — lifecycle 필터
- `idx_doc_layer ON (layer)` — layer 필터
- `idx_doc_svc ON (svc)` — 서비스별 조회
- `idx_doc_address ON (address)` — 좌표 조회
- `idx_dl_target ON document_links(target_id, link_type)` — 역링크 조회
- `idx_semantic_terms_label`, `idx_semantic_aliases_alias` — resolver 후보 검색
- `idx_semantic_terms_address` — prefix/version/address 기반 grounding
