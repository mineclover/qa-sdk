---
def:
  id: event-logging-lifecycle-rule
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: observability
  tags: [observability, logging, ingest, contract]
  links:
    - target: event-logging-lifecycle
      type: refines
    - target: service-event-adoption-rule
      type: depends_on
---

# Event Logging Lifecycle — 소비 규칙

## 목적 ^purpose

서비스가 logging -> ingest -> taxonomy gate 흐름을 소비할 때 확인해야 하는 판별 기준을 정의한다. 이 문서는 runtime logging 계약을 새로 정의하지 않고, 각 단계의 owner 문서를 조합하는 운영 체크리스트만 소유한다.

## 체크리스트 ^defines

### 1. Logger input

- pino 구조화 로그에서 좌표를 넣을 때는 `addressContext`를 사용한다.
- canonical `EventRecord`에는 `address_context`로 저장되어야 한다.
- `eventKey`가 없으면 bridge default인 `svc_log.<level>`이 사용된다.
- taxonomy gate를 clean하게 통과해야 하는 domain/production event는 `eventKey`를 명시해야 한다.
- default `svc_log.<level>` key는 진단 fallback이며, core vocabulary/adoption-clean key로 간주하지 않는다.
- default key를 운영 gate 대상으로 삼으려면 별도 mapping pack과 service adoption을 추가해야 한다.

### 2. Bridge behavior

- `addressContext`가 없는 로그는 stdout 운영 로그로만 남고 ingest로 forward하지 않는다.
- bridge failure는 fail-open이다. 서비스 요청 처리를 막으면 안 된다.
- `IngestForwarder`가 만든 `EventRecord`는 `record-spec`의 canonical field를 따라야 한다.

### 3. Ingest validation

- `/v1/ingest`는 envelope schema를 먼저 검증한다.
- registry validation mode는 `strict|warn|off` 중 하나다.
- warn mode에서는 미등록 event key를 저장하되 warning 필드를 남긴다.
- address context health check는 fail-open warning이다.

### 4. Taxonomy gate

- event taxonomy gate는 service adoption + active pack owner 집합을 대상으로 판단한다.
- drift가 있으면 `pnpm gate:event-taxonomy` 또는 service-level check/assert로 원인을 좁힌다.
- `svc_log.<level>`처럼 bridge default key가 gate에서 실패하면, 우선 호출부에 명시 `eventKey`를 주입한다.
- fallback key 자체를 운영 vocabulary로 승격하려면 logger/observability 소유 mapping pack과 service adoption을 추가한다.

## 실패 해석

| 신호 | 의미 | 우선 조치 |
|------|------|----------|
| log forwarded=0 | `addressContext` 없는 운영 로그만 발생 | 좌표 주입 위치 확인 |
| registry warning | event key 미등록 또는 version mismatch | event taxonomy/adoption 확인 |
| address health orphan prefix | catalog에 없는 prefix가 address_context에 있음 | prefix catalog 또는 SDK 주입값 확인 |
| taxonomy assert 409 | 운영 게이트 drift | `event-taxonomy-gate` skill 절차 수행 |
