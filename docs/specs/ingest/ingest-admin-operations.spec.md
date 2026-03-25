---
def:
  id: ingest-admin-operations
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: admin-api-spec
      type: refines
---

# Ingest Admin 운영 규칙

## 목적 ^purpose

DLQ 삽입 시점, 설정, 의존 포트를 분리해 ingest admin 운영 작업이 본선 수집 경로를 침범하지 않도록 규정한다.

## 운영 규칙

- DLQ 조작은 본선 ingest API와 같은 트랜잭션 경로를 재사용하되, 운영자 의도와 자동 재시도를 구분해 기록해야 한다.
- 설정은 재처리 한도, 보호용 rate limit, 장애 알림 경계를 포함해야 한다.
- 의존 포트는 DLQ 저장소와 trace/session 재구성 경계가 분명해야 한다.
