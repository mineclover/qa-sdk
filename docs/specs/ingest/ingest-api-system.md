---
def:
  id: ingest-api-system
  tier: system
  address: def_document:v2:412680
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [structural, performance, observability]
  links:
    - target: ingest-interface-contract
      type: contains
    - target: ingest-interface-pipeline
      type: contains
    - target: ingest-system
      type: depends_on
  sources:
    - packages/ingest-server/src/app.ts
    - packages/ingest-server/src/routes/ingest.ts
    - packages/ingest-server/src/routes/ingest.test.ts
    - packages/ingest-server/src/app.test.ts
    - packages/ingest-server/src/lib/phase-two-worker.ts
    - packages/core/src/schema/envelope.schema.ts
---

# Ingest API 그룹

## 목적 ^purpose

Transmission Envelope 수신 API를 엔드포인트 계약과 저장/후속 파이프라인 연결 문서로 분리해 ingest 진입점의 변경 범위를 줄인다.

## 구성 ^overview

- `ingest-interface-contract`: 수집 엔드포인트의 입력, 응답, rate-limit/shutdown, 의존 저장소 계약.
- `ingest-interface-pipeline`: registry/catalog validation, trace transaction, 관측 저장, Phase 2/DLQ 연결까지 포함한 후속 처리 경로.

원본: `docs/specs/pipeline/ingest.spec.md` (`ingest-api-spec`)
