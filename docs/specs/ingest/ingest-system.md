---
def:
  id: ingest-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: ingest-server
  tags: [performance, observability, entry-point, tier-infra]
  links:
    - target: ingest-api-system
      type: contains
    - target: query-api-spec
      type: contains
    - target: scenario-api-spec
      type: contains
    - target: stream-api-spec
      type: contains
    - target: verdict-api-spec
      type: contains
    - target: admin-api-system
      type: contains
    - target: record-spec
      type: contains
    - target: trace-spec
      type: contains
    - target: session-spec
      type: contains
    - target: pipeline-phase-flow
      type: contains
    - target: ingest-infra-system
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

overview: 총 14개 멤버.
- `ingest-api-system`: SDK로부터 Transmission Envelope을 수신하고 저장/후속 파이프라인으로 넘기는 수집 API 그룹.
- `query-api-spec`: trace, session, record를 cursor 기반 pagination으로 조회하는 읽기 전용 API.
- `scenario-api-spec`: ScenarioSpec CRUD — 시나리오 스펙 등록, 조회, 삭제.
- `stream-api-spec`: 특정 trace 또는 session을 SSE로 구독하여 새 이벤트를 실시간 수신.
- `verdict-api-spec`: trace와 session 단위의 시나리오 verdict를 조회하고 강제 재계산하는 서버 API 계약과 의존 범위를 정의한다.
- `admin-api-system`: 운영 관리용 내부 엔드포인트와 DLQ 조작 규칙을 분리한 그룹.
- `record-spec`: core package의 canonical event record 구조와 저장/조회 동작을 정의한다.
- `trace-spec`: trace_id 단위 메타데이터 집계와 reconstruction 상태 관리.
- `session-spec`: qa_session_id 기반 세션 식별.
- `ingest-pipeline-flow`: Phase 1(동기 저장) + Phase 2(비동기 재구성/판정) 2단계 파이프라인 처리 흐름.
- `ingest-infra-system`: health check, rate limiting, request ID, graceful shutdown 등 ingest 인프라 제약 그룹.
- `browser-session-spec`: 브라우저 탭 범위의 세션을 `sessionStorage`에 영속화한다.
- `dlq-store-spec`: reconstruction / verdict 후처리 실패를 적재하는 dead-letter queue 포트 계약.
- `transmission-spec`: SDK가 전송하는 배치 단위와 수신 메타데이터 감사 저장소.
