---
def:
  id: admin-api-system
  tier: system
  address: def_document:v2:412672
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [structural, observability]
  links:
    - target: ingest-admin-endpoints
      type: contains
    - target: ingest-admin-operations
      type: contains
  sources:
    - packages/ingest-server/src/app.ts
    - packages/ingest-server/src/routes/dlq.ts
    - packages/ingest-server/src/routes/cleanup.ts
    - packages/ingest-server/src/routes/dlq.test.ts
    - packages/ingest-server/src/routes/cleanup.test.ts
    - packages/ingest-server/src/app.test.ts
---

# Ingest Admin 그룹

## 목적 ^purpose

운영 관리용 내부 엔드포인트를 DLQ 재처리, 만료 데이터 정리, 설정 규칙 문서로 분리해 admin API의 운영 변경을 제어한다.

## 구성 ^overview

- `ingest-admin-endpoints`: 운영자가 호출하는 DLQ/cleanup admin 엔드포인트와 조회/재시도/강제 정리 계약.
- `ingest-admin-operations`: DLQ 삽입 시점, cleanup 실행 경계, 설정, 의존 포트를 정리한 운영 문서.

원본: `docs/specs/server/ingest/admin.spec.md` (`admin-api-spec`)
