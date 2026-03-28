---
def:
  id: decode-svc-api-contract
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: decode-service-system
      type: refines
---
# Decode Service — API 계약

## 목적 ^purpose

decode-service의 HTTP 엔드포인트 명세. 요청/응답 형식, 에러 코드를 정의한다.

## 구성 ^overview

| Method | Path | 요청 | 응답 |
|--------|------|------|------|
| GET | /health | — | `{ status, decoders_loaded, uptime_seconds, version }` |
| GET | /metrics | — | Prometheus text (uptime, heap, rss, pool) |
| POST | /decode | `{ input, prefix?, version? }` | `{ indexId, versionId, value, entities }` |
| POST | /decode/batch | `{ prefix, version, inputs[] }` | `{ results: [...] }` |
| POST | /decode/deep | `{ input, prefix?, version? }` | `{ entities, refs, unresolved? }` |
| GET | /decode-map/:prefix/:version | — | raw DecodeMap 번들 |

### 에러 응답 형식

```json
{ "error": { "code": "NOT_FOUND", "message": "..." } }
```

| code | HTTP | 발생 조건 |
|------|------|----------|
| INVALID_INPUT | 400 | Zod 검증 실패, 파싱 에러, prefix/version 불완전 |
| NOT_FOUND | 404 | decoder 없음, 엔트리 없음, 자동 감지 실패 |
| RANGE_EXCEEDED | 400 | 주소가 index 범위 초과 |
| INTERNAL_ERROR | 500 | 매핑 안 된 에러 |
