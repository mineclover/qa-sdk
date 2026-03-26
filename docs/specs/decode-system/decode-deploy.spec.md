---
def:
  id: decode-deploy
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: decode-api
      type: constrains
---
# Decode 배포 토폴로지

## 목적 ^purpose

Decode Service의 3가지 배포 형태와 각각의 제약 조건을 정의한다.

## 구성 ^overview

- **Embedded** — 애플리케이션 프로세스 내부에서 PrefixDecoder를 직접 호출.
- **Sidecar (CF Workers)** — Cloudflare Workers에서 D1/HTTP로 DecodeMap을 로드하여 엣지에서 디코딩.
- **Standalone (Node.js)** — 독립 서비스로 registry-service에서 DecodeMap을 자동 fetch.

## 배포 형태 ^constraint

### Embedded

- 애플리케이션 프로세스 내부에서 `PrefixDecoder`를 직접 호출
- 네트워크 비용 없음. DecodeMap을 메모리에 보유
- `index-meta` 패키지를 직접 의존하여 디코더 인스턴스 생성
- 적합: 서버 사이드 렌더링, CLI 도구, 테스트

### Sidecar (Cloudflare Workers)

- `worker.ts`를 통해 CF Workers에서 실행
- DecodeMap 로드 전략 (우선순위):
  1. `REGISTRY_DB` (D1 바인딩) — registry D1에서 catalog 직접 조회 (가장 빠름)
  2. `REGISTRY_URL` (HTTP fetch) — fallback, CF Workers 간 fetch 이슈 가능
- DecoderPool TTL=0 (한 번 로드 후 Worker 수명 동안 유지)
- `/debug` 엔드포인트로 로드 상태 진단
- 배포 URL: `https://qa-decode-service.astralclover.workers.dev`

### Standalone (Node.js)

- `server.ts`를 통해 독립 Hono 서비스로 실행
- 포트: 3600 (기본)
- startup 시 `REGISTRY_URL`이 설정되어 있으면 `/api/decode-map` 자동 fetch
- fetch 실패 시 빈 pool로 시작 (fail-open, 이후 DECODER_NOT_LOADED 에러)
- `AbortSignal.timeout(5_000)` 적용으로 startup 블로킹 방지
- `installSimpleShutdown`으로 SIGTERM/SIGINT 처리

## 공통 제약

| 항목 | 제약 |
|------|------|
| ServiceBootConfig | `createServiceBootConfig("decode-service")` 사용 |
| ownedPrefixes | `[]` — 읽기 전용 서비스, 이벤트 생산 없음 |
| consumedPrefixes | `["service"]` |
| 의존 서비스 | registry-service (DecodeMap 공급) |
| 포트 충돌 검사 | `warnPortConflict("decode-service", port, logger)` |

## 게이트웨이 통합

- `gatewayPath`: `/decode/`
- `stripPrefix`: true — 게이트웨이에서 `/decode/` prefix 제거 후 서비스에 전달
- prod URL: `https://qa-decode-service.astralclover.workers.dev`

## createApp 팩토리

`createApp(deps)` — Hono 앱 인스턴스를 생성하는 팩토리 함수.

| 의존성 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `pool` | `DecoderPool` | Y | prefix/version별 PrefixDecoder 캐시 |
| `logger` | `Logger` | - | pino 로거. 미지정 시 자동 생성 |
| `version` | `string` | - | 서비스 버전 |
| `getUptimeSeconds` | `() => number` | - | uptime 콜백 |

## 미들웨어 스택

```
1. requestId (모든 경로) — X-Request-Id 전파
... 라우트 핸들러 ...
N. errorHandler (onError) — AppError, ZodError 분기 처리
```

## 라우트 구성

| 경로 | 핸들러 | 설명 |
|------|--------|------|
| `GET /health` | `createHealthRoutes` | pool 상태 + uptime + version |
| `GET /metrics` | `createMetricsRoutes` | Prometheus 형식 (uptime, heap, pool 크기) |
| `POST /decode`, `POST /decode/batch`, `POST /decode/deep` | `createDecodeRoutes` | 디코딩 API |
| `GET /decode-map/:prefix/:version` | `createDecodeRoutes` | DecodeMap 번들 원본 조회 |
| `GET /debug` (Worker만) | 인라인 | pool 크기, 키 목록, 로드 에러, 통계 |

## 환경 변수

`config/env.ts` zod 스키마로 검증.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3600` | 서비스 포트 |
| `DECODE_MAP_SOURCE` | - | DecodeMap JSON 파일 경로 또는 URL (선택) |
| `REGISTRY_URL` | - | registry-service URL (startup 시 DecodeMap 자동 fetch) |
| `CACHE_TTL_MS` | `60000` | DecoderPool 캐시 TTL (ms). Worker에서는 0 |

## registry에서 DecodeMap 로드

Standalone 모드 startup 시:

```
loadFromRegistry(REGISTRY_URL)
  → fetch(registryUrl + "/api/decode-map", { signal: AbortSignal.timeout(5_000) })
  → 응답 JSON → DecodeMap[]
  → pool.loadMap(map) × N
  → 실패 시 빈 pool (fail-open, DECODER_NOT_LOADED 에러)
```

Worker 모드에서의 `buildDecodeMaps(catalog)`:

- axis dim: catalog axes에서 entries/capacity 추출
- prefix_ref dim: `refEntries.values` → 정수 배열을 string entries로 변환
  - `refEntries` 없으면 해당 prefix 전체 무효화 (CON-006)
- table_ref dim: `["_ref"]` 단일 entry (shape=1)
- size = shape의 곱
