---
def:
  id: ingest-infra-system
  scope: constraint
  aspect: infra_constraint
  depth: overview
  lifecycle: approved
  svc: ingest-server
  tags: [structural, performance, observability, tier-infra]
  links:
    - target: ingest-runtime-middleware
      type: contains
    - target: ingest-runtime-operations
      type: contains
---

# Ingest 인프라 그룹

## 목적 ^purpose

health check, rate limiting, request ID, graceful shutdown 등 ingest 서비스 인프라를 미들웨어와 운영 규칙 문서로 분리한다.

## 구성 ^overview

- `ingest-runtime-middleware`: health check, rate limiting, request ID, error handler 미들웨어 규칙.
- `ingest-runtime-operations`: graceful shutdown과 적용 순서 같은 운영 절차 규칙.

원본: `docs/specs/server/ingest/infrastructure.spec.md` (`ingest-infra-spec`)
