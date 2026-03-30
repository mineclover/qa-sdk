---
def:
  id: ingest-server-scenario-3
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: ingest-server
  links:
    - target: ingest-system
      type: refines
    - target: ingest-interface-contract
      type: depends_on
---
# WebSocket 실시간 스트리밍

## 목적 ^purpose

ingest-server가 session/trace 기반 SSE 스트리밍으로 새 Record를 실시간 전달하고, 연결 종료 시 구독 정리까지 일관되게 수행하는 기준 시나리오를 정의한다.

## 행위자 ^actor

- **시각화 클라이언트**: viz-web (port 5210)에서 SSE 스트림을 구독하는 브라우저 앱
- **클라이언트 SDK**: shopping-web 서비스에서 이벤트를 전송
- **ingest-server**: 이벤트 수집 + RecordStreamBroker를 통한 실시간 스트리밍 제공

## 사전 조건 ^preconditions

- ingest-server가 STORE_DRIVER=memory로 기동 (port 3200)
- Catalog에 `page_view`, `cart_event` prefix가 active 상태로 등록
- 클라이언트 SDK가 초기화 (ServiceBootConfig에 `qa_session_id: "qas_test_001"` 포함)
- SSE_SUBSCRIPTION_LIMIT 기본값 10 적용
- RecordStreamBroker가 초기 상태 (구독자 0)

## 스텝 ^steps

1. 시각화 클라이언트가 `GET /v1/streams/sessions/qas_test_001` SSE 연결 요청
2. ingest-server가 RecordStreamBroker에 session 구독 등록 → SSE 연결 수립 (200, Content-Type: text/event-stream)
3. 15초 heartbeat 타이머 시작 → 주기적으로 `: heartbeat` comment 전송
4. 클라이언트 SDK가 `sdk.track("page.view", { url: "/home" })` 호출 → `POST /v1/ingest` 전송
5. ingest-server Phase 1: Record 생성 + 저장 → RecordStreamBroker.publish(record) 호출
6. RecordStreamBroker가 `structuredClone(record)` → 구독 중인 시각화 클라이언트에 `event: record` SSE 이벤트 push
7. 시각화 클라이언트가 SSE 이벤트 수신 → data 필드에서 Record JSON 파싱 → 화면에 실시간 반영
8. 클라이언트 SDK가 `sdk.track("cart.add", { product_id: "P001" })` 호출 → 같은 session으로 전송
9. 시각화 클라이언트가 두 번째 `event: record` SSE 이벤트 수신
10. 시각화 클라이언트가 SSE 연결 종료 (EventSource.close())
11. ingest-server가 `stream.onAbort` 감지 → heartbeat 타이머 정리 + unsubscribe 호출

## 검증 ^assertions

- SSE 연결 → 200, Content-Type: text/event-stream
- 연결 직후에는 기존 저장된 record가 전송되지 않음 (연결 이후 새 record만)
- 이벤트 전송 후 시각화 클라이언트가 `event: record` + `data: {JSON}` 형식의 SSE 이벤트 수신
- 수신된 Record의 `trace_id`, `event_key`, `qa_session_id` 필드가 원본과 일치
- 첫 번째와 두 번째 record가 순서대로 도착 (같은 연결 내 FIFO)
- 구독자에게 전달되는 record는 `structuredClone`된 복사본 (원본 참조 격리)
- 15초 이내 `: heartbeat` comment가 최소 1회 수신
- 연결 종료 후 RecordStreamBroker의 해당 session 구독자 수 === 0
- 연결 종료 후 새 이벤트 전송 시 push 발생하지 않음

## 변형 ^variants

### V1: trace 단위 구독

- `GET /v1/streams/traces/:traceId` SSE 연결
- 해당 trace의 record만 수신, 다른 trace의 record는 수신하지 않음
- 연결 종료 시 동일하게 cleanup 수행

### V2: 동시 구독 제한 (429)

- 동일 session에 SSE_SUBSCRIPTION_LIMIT(기본 10)개 SSE 연결 생성
- 11번째 연결 시도 → 429 Too Many Requests 반환
- 기존 연결 1개 종료 후 재시도 → 정상 연결

### V3: 다중 구독자 동시 수신

- 같은 session에 시각화 클라이언트 A, B 두 개 SSE 연결
- 이벤트 전송 → A, B 모두 동일한 record 이벤트 수신
- 각 구독자가 수신한 record 객체는 독립 (structuredClone 격리)

### V4: 시나리오 구독 시 verdict 스트리밍

- session에 scenarioId가 연결된 상태에서 SSE 구독
- Phase 2 verdict 계산 완료 후 scenario 레벨 broadcast 발생
- 시각화 클라이언트가 verdict 관련 알림 수신

### V5: 서버 shutdown 중 연결 처리

- SSE 연결 활성 상태에서 ingest-server graceful shutdown 시작
- 미들웨어가 새 연결 차단 (503)
- 기존 SSE 연결이 정리되며 클라이언트가 disconnection 감지

### V6: 재연결 시 이벤트 누락

- 시각화 클라이언트의 SSE 연결이 네트워크 문제로 끊어짐
- 끊어진 동안 전송된 이벤트는 재연결 후 수신 불가 (Last-Event-ID 미지원, v1 scope 외)
- 재연결 후 새 이벤트부터 정상 수신

## 재검토 트리거 ^update-trigger

- stream-api-spec: SSE 엔드포인트 스키마 또는 RecordStreamBroker 인터페이스 변경 시
- ingest-interface-contract: POST /v1/ingest 응답 흐름 또는 Phase 1 저장 경로 변경 시
- SSE_SUBSCRIPTION_LIMIT 기본값 변경 시
- Last-Event-ID 기반 재연결 복구가 구현될 경우 V6 변형 재작성 필요
- WebSocket 프로토콜로의 전환이 결정될 경우 전면 재작성
