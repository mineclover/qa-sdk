---
def:
  id: ingest-admin-endpoints
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: admin-api-spec
      type: refines
    - target: dlq-store-spec
      type: depends_on
---

# Ingest Admin 엔드포인트

## 목적 ^purpose

운영자가 사용하는 ingest admin 엔드포인트의 조회, 재시도, 강제 작업 계약을 분리해 관리 경계를 분명히 한다.

## 운영 계약

- admin API는 일반 ingest 경로와 별도 인증/권한 경계를 가져야 한다.
- 엔드포인트는 DLQ 적재분 조회, 재처리, 실패 배치 점검처럼 운영자가 실제로 수행하는 작업 중심으로 설계한다.
- 응답은 재처리 요청 결과와 잔여 실패 건수를 바로 파악할 수 있게 해야 한다.
