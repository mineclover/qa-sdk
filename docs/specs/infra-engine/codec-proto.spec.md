---
def:
  id: codec-proto
  scope: interface
  aspect: api_contract
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  svc: codec-proto
  tags: [infra, protobuf, codec, transport]
  links:
    - target: infra-service-operations
      type: refines
sources:
  - packages/codec-proto/src/index.ts
  - packages/codec-proto/src/codec.ts
  - packages/codec-proto/src/codec.test.ts
  - packages/ingest-server/src/lib/proto-codec.ts
---
# Protobuf 전송 (codec-proto)

## 목적 ^purpose

ingest-server의 전송 포맷 감지 로직과 `@qa-sdk/codec-proto` 패키지의 encode/decode 인터페이스, 성능 특성, 포맷 선택 가이드를 정의한다.

## 전송 포맷 ^overview

| 포맷 | Content-Type | 감지 |
|------|-------------|------|
| JSON (기본) | `application/json` | — |
| QAPB (레거시) | `application/x-protobuf` | QAPB magic header 있음 |
| 진짜 Protobuf | `application/x-protobuf` | QAPB magic 없음 |

- ingest-server가 자동 감지: QAPB magic 있으면 QAPB, 없으면 진짜 protobuf

## 패키지

- `@qa-sdk/codec-proto`: `encodeEnvelope(json) → Uint8Array`, `decodeEnvelope(binary) → json`

## 성능

| 지표 | JSON | Protobuf |
|------|------|----------|
| 크기 (per record) | 642B | 265B (55% 절감) |
| encode 속도 | — | 178K ops/s |
| decode 속도 | — | 102K ops/s |

## 선택 가이드

- 로컬 → JSON
- 인터넷 경유 → Proto
- 대량 아카이빙 → Proto
