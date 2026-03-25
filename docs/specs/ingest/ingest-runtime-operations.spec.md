---
def:
  id: ingest-runtime-operations
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [observability, tier-infra]
  links:
    - target: ingest-infra-spec
      type: refines
---

# Ingest 런타임 운영 절차

## 목적 ^purpose

graceful shutdown과 미들웨어 적용 순서를 분리해 ingest 서비스의 운영 절차가 요청 처리 규칙과 뒤섞이지 않게 만든다.

## 운영 절차

- graceful shutdown은 새 요청 차단, 큐 drain, 남은 flush 순서로 진행해야 한다.
- 미들웨어 적용 순서는 request ID가 가장 먼저, error handler가 가장 마지막에 오도록 고정한다.
- 운영 절차 변경은 health check와 admin 재처리 경로가 동시에 유지되는지 확인한 뒤 반영한다.
