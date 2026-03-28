---
def:
  id: ingest-api-system
  level: module
  address: def_document:v2:412680
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [structural, performance, observability, tier-infra]
  links:
    - target: ingest-interface-contract
      type: contains
    - target: ingest-interface-pipeline
      type: contains
---

# Ingest API 그룹

## 목적 ^purpose

Transmission Envelope 수신 API를 엔드포인트 계약과 저장/후속 파이프라인 연결 문서로 분리해 ingest 진입점의 변경 범위를 줄인다.

## 구성 ^overview

- `ingest-interface-contract`: 수집 엔드포인트의 입력, 응답, 의존 저장소 계약.
- `ingest-interface-pipeline`: registry validation, trace transaction, DLQ 연결까지 포함한 후속 처리 경로.

원본: `docs/specs/pipeline/ingest.spec.md` (`ingest-api-spec`)
