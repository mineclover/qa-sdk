---
def:
  id: ingest-api-system-cases
  type: spec
  tier: component
  scope: interface
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [scenario, ingest, api]
  links:
    - target: ingest-api-system
      type: refines
    - target: ingest-system
      type: depends_on
---

# Ingest API — 소비자 기대 시나리오

## 목적 ^purpose

`ingest-api-system`(수집 엔드포인트 계약 + 후속 파이프라인 연결)이 `ingest-system`에 의존할 때 기대하는 계약. API 그룹은 ingest-system이 제공하는 pipeline phase flow, registry validation, trace transaction, DLQ 포트를 소비한다.

## 시나리오 1: Phase 1 동기 저장 경계 ^overview

**전제**: `ingest-system`의 `ingest-pipeline-flow`가 Phase 1(동기 저장) + Phase 2(비동기 재구성/판정)을 정의한다.

**동작**: `POST /v1/ingest/transmit`가 TransmissionEnvelope을 받는다.

**기대**:
- Phase 1이 response 반환 전에 완료 (persist + DLQ 준비 + ack)
- Phase 2 실패는 response에 영향 없음 (200 + 비동기 후처리 실패 로그)
- Phase 1 실패 → 5xx 반환 + 클라이언트 재시도 유도 (idempotency key 사용)

**실패 시 수정 대상**: `ingest-system`의 `ingest-pipeline-flow`. Phase 경계가 response 시점과 어떻게 정렬되는지 명시해야 한다. 섞이면 클라이언트가 "ack 받았지만 데이터가 사라짐" 상황 발생.

## 시나리오 2: Registry validation 실패 처리 ^overview

**전제**: `ingest-system`이 prefix registry로부터 스키마 검증을 수행한다.

**동작**: 알려지지 않은 prefix의 이벤트가 포함된 TransmissionEnvelope 수신.

**기대**:
- 전체 envelope reject (부분 성공 금지, atomic)
- 응답 body에 실패 이유 + 문제 prefix 표시
- DLQ에 원본 envelope + reason 기록 (재시도 또는 수동 검증용)

**실패 시 수정 대상**: `ingest-system`의 registry validation 계약. atomic 여부가 명시되지 않으면 클라이언트가 partial state를 의심하게 됨.

## 시나리오 3: trace transaction 원자성 ^overview

**전제**: `ingest-system`의 record/trace/session 저장이 하나의 DB 트랜잭션 내 수행된다.

**동작**: 한 envelope이 N개 record, 1개 trace, 1개 session을 포함한다.

**기대**:
- 하나라도 실패 → 전체 rollback
- partial state 없음 (record는 저장됐는데 trace는 없음 등)
- 성공 시에만 DLQ 제거 및 ack

**실패 시 수정 대상**: `ingest-system`의 `record-spec` + `trace-spec` + `session-spec` 관계. 트랜잭션 경계가 명시되지 않으면 partial failure 재시도가 부정확해진다.

## 시나리오 4: DLQ 포트 격리 ^overview

**전제**: `ingest-system`의 `dlq-store-spec`이 reconstruction/verdict 후처리 실패를 적재하는 포트 계약을 정의한다.

**동작**: Phase 2 재구성/판정 실패 → DLQ 적재.

**기대**:
- DLQ store가 unavailable 해도 Phase 1은 영향 없음 (fail-open with warning)
- DLQ에 저장된 항목은 `admin-api-system`을 통해 조회/재처리 가능
- 무한 재시도 방지 (시도 횟수 카운트, 임계치 초과 시 관리자 알림)

**실패 시 수정 대상**: `ingest-system`의 `dlq-store-spec`. 재시도 제한이 명시되지 않으면 DLQ 가 무한 루프 저장소가 되어 성능/비용 이슈.
