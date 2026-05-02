# @qa-sdk/decode-service

`@qa-sdk/decode-service`는 DecodeMap 번들로 주소를 독립 디코딩하는 경량 서비스다. central spec이 잘 정리돼 있으니 그 순서대로 보는 것이 맞다.

## 먼저 볼 문서

- [decode-service-system.md](../../docs/specs/decode-service/decode-service-system.md) — 전체 진입점
- [decode-svc-api-contract.md](../../docs/specs/decode-service/decode-svc-api-contract.md) — HTTP API 계약
- [decode-svc-core-logic.md](../../docs/specs/decode-service/decode-svc-core-logic.md) — DecoderPool과 디코딩 경로
- [decode-svc-constraints.md](../../docs/specs/decode-service/decode-svc-constraints.md) — 제약/에러 매핑
- [decode-svc-scenarios.md](../../docs/specs/decode-service/decode-svc-scenarios.md) — 테스트 시나리오 근거

## 패키지 역할

- registry-service 없이도 DecodeMap만으로 주소를 디코딩한다.
- `DecoderPool` TTL 캐시를 유지하고, 필요하면 Redis L2 캐시를 사용할 수 있다.
- Edge/Node 환경에서 fail-open으로 시작하고, 이후 인메모리 디코딩에 집중한다.

## 코드 진입점

- `src/server.ts` — Node 서버 부팅
- `src/app.ts` — Hono 앱 조립
- `src/routes/decode.ts`, `src/routes/health.ts`, `src/routes/metrics.ts` — HTTP 표면
- `src/lib/decoder-pool.ts` — 디코더 캐시 코어
- `src/config/env.ts` — 환경 설정

## 실행

```bash
pnpm --filter @qa-sdk/decode-service build
pnpm --filter @qa-sdk/decode-service test
pnpm --filter @qa-sdk/decode-service start
```
