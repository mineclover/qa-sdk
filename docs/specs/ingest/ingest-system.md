---
def:
  id: ingest-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: ingest-server
  tags: [performance, observability, entry-point]
  links:
    - target: ingest-api-spec
      type: contains
    - target: query-api-spec
      type: contains
    - target: scenario-api-spec
      type: contains
    - target: stream-api-spec
      type: contains
    - target: verdict-api-spec
      type: contains
    - target: admin-api-spec
      type: contains
    - target: record-spec
      type: contains
    - target: trace-spec
      type: contains
    - target: session-spec
      type: contains
    - target: ingest-pipeline-flow
      type: contains
    - target: ingest-infra-spec
      type: contains
    - target: browser-session-spec
      type: contains
    - target: dlq-store-spec
      type: contains
    - target: transmission-spec
      type: contains
---
# Ingest 시스템

## 목적 ^purpose

SDK에서 전송된 이벤트를 수신, 저장, 재구성, 판정하는 수집 파이프라인.

## 구성 ^overview

11개 정의로 구성: API 6종(수집/조회/시나리오/스트림/판정/관리), 데이터 모델 3종(record/trace/session), 파이프라인 흐름, 인프라 제약.
