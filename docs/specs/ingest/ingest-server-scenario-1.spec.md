---
def:
  id: ingest-server-scenario-1
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: ingest-server
  links:
    - target: ingest-system
      type: refines
    - target: ingest-api-system
      type: depends_on
---
# 이벤트 수집 흐름

## 목적 ^purpose

클라이언트 SDK가 이벤트를 전송하고 ingest-server가 수집/저장/verdict 계산하는 전체 흐름을 검증한다.

## 행위자 ^actor

- **클라이언트**: @qa-sdk/sdk를 사용하는 서비스 (예: shopping-web)
- **ingest-server**: POST /v1/ingest 엔드포인트

## 사전 조건 ^preconditions

- ingest-server가 STORE_DRIVER=memory로 기동
- Catalog에 page_view prefix가 등록 (active 상태)
- 클라이언트 SDK가 초기화 (ServiceBootConfig 주입)

## 스텝 ^steps

1. 클라이언트가 `sdk.track("page.view", { url: "/home" })` 호출
2. SDK가 dim-wire 인코딩 → JSON payload 생성
3. POST /v1/ingest 전송 (Content-Type: application/json)
4. ingest-server가 payload 파싱 → Record 생성
5. Record를 RecordStore에 저장
6. Trace 경계 감지 → TraceStore에 Trace 생성
7. Session 업데이트 (qa_session_id 기준)
8. Phase 2: ScenarioSpec 매칭 → Verdict 계산

## 검증 ^assertions

- POST /v1/ingest → 200 OK
- RecordStore에 Record 1건 저장 확인
- Record.address가 page_view prefix의 유효 주소 범위 이내
- Record.dim_values에 인코딩된 차원 값이 존재
- TraceStore에 Trace 1건 생성 확인
- Session.eventCount >= 1

## 변형 ^variants

### V1: Protobuf 전송
- Content-Type: application/x-protobuf
- 동일 검증, 크기 55% 절감 확인

### V2: 잘못된 prefix
- 미등록 prefix → 400 Bad Request
- RecordStore에 저장되지 않음

### V3: inactive prefix
- GateEngine에서 inactive → Record 저장되나 shouldVerify=false
- Verdict 계산 건너뜀

## 재검토 트리거 ^update-trigger

- ingest-api-spec: 엔드포인트 스키마 변경 시
- record-spec: Record 필드 변경 시
- gate-engine-func: gate check 로직 변경 시
