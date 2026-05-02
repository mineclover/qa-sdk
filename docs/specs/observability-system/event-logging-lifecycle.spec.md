---
def:
  id: event-logging-lifecycle
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: observability
  tags: [observability, logging, ingest, contract]
  links:
    - target: observability-system-root
      type: refines
    - target: logger-contract
      type: depends_on
    - target: log-ingest-bridge
      type: depends_on
    - target: record-spec
      type: depends_on
    - target: ingest-interface-contract
      type: depends_on
    - target: address-context-format
      type: depends_on
    - target: service-event-adoption-spec
      type: depends_on
    - target: event-taxonomy-role-contract
      type: depends_on
    - target: event-intent-definition-rule
      type: depends_on
    - target: event-logging-lifecycle-cases
      type: traces_to
    - target: event-logging-lifecycle-rule
      type: traces_to
---

# Event Logging Lifecycle

## 목적 ^purpose

서비스 로그가 `EventRecord`로 변환되어 ingest에 저장되고, event taxonomy/adoption gate에서 운영 정합성을 확인받는 end-to-end lifecycle을 정의한다. 목표는 logging runtime, ingest record, event taxonomy가 각각 분리된 계약을 유지하면서도 한 흐름으로 추적 가능하게 만드는 것이다.

## 정의 ^defines

표준 흐름:

```text
Service logger
  -> Log/Ingest bridge
    -> EventRecord
      -> TransmissionEnvelope
        -> Ingest API
          -> Registry event taxonomy validation
            -> Event taxonomy gate
```

Authority 분리:

| 단계 | owner | 소유 |
|------|-------|------|
| logger API | `logger-contract` | `QaLogger`, transport, actor injection |
| pino bridge | `log-ingest-bridge` | pino log 필터링, `addressContext` -> `address_context` 변환 |
| canonical record | `record-spec` | `EventRecord`, payload descriptor, query axes |
| ingest receive/store | `ingest-interface-contract` | `/v1/ingest`, envelope validation, registry validation mode |
| address context | `address-context-format` | address string format and merge policy |
| taxonomy adoption | `service-event-adoption-spec` | service별 mapping pack adoption and drift vocabulary |
| taxonomy gate | `event-taxonomy-role-contract` / `service-event-adoption-rule` | check/assert 판정 규칙 |
| event intent | `event-intent-definition-rule` | requester + request path + frontend behavior unit + data effect 결합 규칙 |

Field boundary:

- pino/log input field: `addressContext`
- canonical record field: `address_context`
- event identity field: `event_key` / `event_version`
- pino bridge default event key: `svc_log.<level>`

Default event-key policy:

- `svc_log.<level>` is a diagnostic fallback produced by `IngestForwarder` when a log has `addressContext` but no explicit `eventKey`.
- `svc_log.<level>` is not currently a core vocabulary event or service-adoption-clean mapping pack event.
- Domain or production events that must pass taxonomy gates cleanly must set `eventKey` explicitly to a key owned by core vocabulary or an adopted mapping pack.
- If a service intentionally wants fallback log keys to be gate-clean, it must add/adopt a mapping pack for those keys. The bridge must not silently auto-register them.

Requester/data-effect policy:

- frontend는 behavior unit을 정의한다.
- backend는 requester-aware data-effect event를 정의한다.
- 같은 backend mutation도 request path, requester type, behavior unit, persistence outcome에 따라 다른 event intent를 가질 수 있다.
- alert는 raw delta가 아니라 semantic event key와 requester/data-effect payload를 소비한다.

## 소비 ^consumes

- `logger-contract`
- `log-ingest-bridge`
- `record-spec`
- `ingest-interface-contract`
- `address-context-format`
- `service-event-adoption-spec`
- `service-event-adoption-rule`
- `event-taxonomy-gate` skill
