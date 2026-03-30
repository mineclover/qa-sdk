---
def:
  id: def-svc-data-model
  level: leaf
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
---
# Definition Service — 데이터 모델

## 목적 ^purpose

definition-service가 관리하는 SQLite 테이블 구조와 데이터 흐름을 정의한다.

## 구성 ^overview

### 핵심 테이블

| 테이블 | 역할 | 행 수 기준 |
|--------|------|-----------|
| documents | 문서 메타데이터 최신 버전 | ~471 |
| document_links | 문서 간 관계 (정규화 edge) | ~800 |
| documents_fts | 전문 검색 (FTS5, purpose/intent/context) | ~471 |
| document_history | 버전 이력 (body 포함) | 누적 |

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

### 인덱스

- `idx_doc_scope ON (scope, aspect)` — scope×aspect 필터
- `idx_doc_lifecycle ON (lifecycle)` — lifecycle 필터
- `idx_doc_layer ON (layer)` — layer 필터
- `idx_doc_svc ON (svc)` — 서비스별 조회
- `idx_doc_address ON (address)` — 좌표 조회
- `idx_dl_target ON document_links(target_id, link_type)` — 역링크 조회
