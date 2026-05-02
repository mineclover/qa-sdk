---
def:
  id: ingest-infra-system
  tier: system
  address: def_document:v2:275457
  scope: constraint
  aspect: infra_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [structural, performance, observability]
  links:
    - target: ingest-runtime-middleware
      type: contains
    - target: ingest-runtime-operations
      type: contains
    - target: key-observation-store
      type: contains
    - target: store-adapter-parity
      type: depends_on
---

# Ingest 인프라 그룹

## 목적 ^purpose

health check, rate limiting, request ID, graceful shutdown 등 ingest 서비스 인프라를 미들웨어와 운영 규칙 문서로 분리한다.

## 구성 ^overview

- `ingest-runtime-middleware`: health check, rate limiting, request ID, error handler 미들웨어 규칙.
- `ingest-runtime-operations`: graceful shutdown과 적용 순서 같은 운영 절차 규칙.
- `key-observation-store`: packed key 관측 빈도/시점/payload 요약을 영속 추적하는 materialized-view store 규격.

원본: `docs/specs/server/ingest/infrastructure.spec.md` (`ingest-infra-spec`)
