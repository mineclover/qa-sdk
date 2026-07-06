---
def:
  tier: component
  id: decode-svc-state-model
  address: def_document:v2:205955
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [runtime, structural, versioning]
  links:
    - target: decode-service-system
      type: refines
sources:
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/routes/health.ts
  - packages/decode-service/src/server.ts
  - packages/decode-service/src/worker.ts
  - packages/decode-service/src/app.test.ts
---
# Decode Service — 상태 모델

## 목적 ^purpose

DecoderPool의 캐시 엔트리 생명주기와 서비스의 상태 전이를 정의한다.

## 구성 ^overview

### DecoderPool 엔트리 상태

```
(없음) → loaded → active → expired → (없음)
           ↑         │
           └─────────┘  (TTL 내 재접근 시 active 유지)
```

| 상태 | 조건 | decode 가능 |
|------|------|------------|
| loaded | loadMap() 직후 | ✓ |
| active | get() 호출 + TTL 내 | ✓ |
| expired | get() 호출 + TTL 초과 | ✗ (자동 evict → 404) |

### 서비스 관측 상태

| 상태 | 조건 | 특징 |
|------|------|------|
| listening | Hono 앱이 요청 수신 가능 | /health는 200 |
| pool-ready | pool에 decoder 1개 이상 | decode 요청 처리 가능 |
| pool-empty | pool 비어있음 (fetch 실패 또는 TTL evict) | /health는 200, decode는 404 |
| cache-connected | Redis L2 cache ping 성공 | /health.cache.status = connected |
| cache-disconnected | Redis L2 cache ping 실패 | /health.cache.status = disconnected, decode는 memory path로 진행 |

- TTL=0이면 만료 없음 (테스트/개발용)
- 만료 후 재로딩 없음 — 서비스 재시작이 유일한 복구 경로
