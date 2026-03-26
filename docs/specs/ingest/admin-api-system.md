---
def:
  id: admin-api-system
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [structural, observability, tier-infra]
  links:
    - target: ingest-admin-endpoints
      type: contains
    - target: ingest-admin-operations
      type: contains
---

# Ingest Admin 그룹

## 목적 ^purpose

운영 관리용 내부 엔드포인트를 DLQ 재처리 시점과 설정 규칙 문서로 분리해 admin API의 운영 변경을 제어한다.

## 구성 ^overview

- `ingest-admin-endpoints`: 운영자가 호출하는 admin 엔드포인트와 조회/재시도 계약.
- `ingest-admin-operations`: DLQ 삽입 시점, 설정, 의존 포트를 정리한 운영 문서.

원본: `docs/specs/server/ingest/admin.spec.md` (`admin-api-spec`)
