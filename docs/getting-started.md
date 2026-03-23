# QA-SDK Getting Started

5분 안에 로컬 환경 구성부터 첫 이벤트 수집까지.

## Prerequisites

- Node.js 22+
- pnpm 10+

## 1. 환경 구성

```bash
git clone <repo-url> && cd qa-sdk
pnpm setup     # 의존성 + .env + 빌드 + 검증 (원클릭)
```

## 2. 서비스 기동

```bash
pnpm demo      # 4서비스 동시 기동
```

| 서비스 | URL | 용도 |
|--------|-----|------|
| registry-service | http://localhost:3300 | 카탈로그/좌표 스키마 |
| ingest-server | http://localhost:3200 | 이벤트 수집 |
| shop-web | http://localhost:5220 | 쇼핑 데모 |
| platform-demo | http://localhost:5176 | 3D 모니터 + 다이어그램 + 디버거 |

```bash
pnpm health    # 전 서비스 헬스체크
```

## 3. 프로젝트 초기화

```bash
qa-sdk init --from demo
# → my-project.catalog.json (카탈로그)
# → my-project.catalog.ts (TS 래퍼)
# → qa-sdk.config.ts (프로젝트 설정)
```

## 4. 타입 생성 (codegen)

```bash
# 로컬 JSON 카탈로그 사용
qa-sdk codegen --output ./generated

# 또는 레지스트리에서 fetch
qa-sdk codegen --registry http://localhost:3300 --output ./generated
```

생성물 (7파일):
- `prefix-ids.ts` — PrefixId, AxisId 리터럴 유니온
- `axes.ts` — 축별 const + type
- `dims.ts` — prefix별 dimension interface
- `sdk-factory.ts` — `sdk.encode/decode` 자동완성
- `context-types.ts` — TypedQaContext
- `dsl.ts` — DSL 번들 정보
- `index.ts` — barrel export

## 5. SDK 사용

### Node.js

```typescript
import { DEMO_CATALOG } from "demo-snapshot";
import { encodePrefix, decodePrefix, latestPrefixVersion } from "@qa-sdk/core";

const ver = latestPrefixVersion(DEMO_CATALOG, "service");
const addr = encodePrefix(DEMO_CATALOG, "service", ver, { env: 0, region: 0, svc_name: 0, namespace: 0 });
const decoded = decodePrefix(DEMO_CATALOG, "service", ver, addr);
// → { env: { value: "dev" }, region: { value: "asia" }, svc_name: { value: "shopping-web" }, namespace: { value: "shop" } }
```

### 브라우저

```html
<script type="module">
import { createQaMonitor } from './qa-browser-sdk.js';

const monitor = createQaMonitor({
  ingestUrl: "http://localhost:3200",
  serviceConfig: { namespace: "shop", name: "my-web", env: "dev", region: "asia" },
  autoCapture: { clicks: true, navigation: true },
});

monitor.emitWithCoords('page.home', {
  page_view: { page: 'home', locale: 'ko', userType: 'member' },
});
</script>
```

### 레지스트리 클라이언트

```typescript
import { createRegistryConfigClient } from "@qa-sdk/registry-client";

const registry = createRegistryConfigClient({
  registryUrl: "http://localhost:3300",
  env: "dev",   // "prod"로 변경하면 CF Workers URL 반환
});

const urls = await registry.fetchServiceUrls();         // dev URL 맵
const prodUrls = await registry.fetchServiceUrls("prod"); // prod URL 맵
const ingestUrl = await registry.resolveEndpoint({ name: "ingest-server" });
```

## 6. 이벤트 확인

- **3D 모니터**: http://localhost:5176/monitor.html
- **다이어그램**: http://localhost:5176/diagram.html
- **실시간 디버거**: http://localhost:5176/debugger.html
- **Dev Dashboard**: http://localhost:3300/dev/

## 7. DKG 탐색

```bash
qa-sdk dkg report      # 전체 현황
qa-sdk dkg axes        # 축 목록
qa-sdk dkg prefixes    # prefix 목록
qa-sdk dkg domains     # 도메인 경계
qa-sdk dkg diagram list  # 다이어그램 목록
```

## 서비스 아키텍처

```
  ┌─ shop-web ─────┐     ┌─ platform-demo ──┐
  │ qa-browser-sdk  │     │ monitor/diagram  │
  │ emitWithCoords  │     │ debugger         │
  └──────┬──────────┘     └──────────────────┘
         │ Beacon/fetch
         ▼
  ┌─ ingest-server ──────────────────────────┐
  │ /v1/ingest   → RecordStore (PG/D1/mem)   │
  │ /v1/debug-ws → 실시간 디버거 스트림       │
  │ Phase 2 → verdict + transition           │
  └──────┬───────────────────────────────────┘
         │
  ┌─ registry-service ──────────────────────┐
  │ /catalogs     → 카탈로그 CRUD            │
  │ /api/services → 서비스 토폴로지          │
  │ /api/endpoints → env별 URL 관리          │
  │ /api/decode-map → DecodeMap 공급         │
  │ /dev/         → Dev Dashboard            │
  └──────────────────────────────────────────┘
         │
  ┌─ gate/query/decode ─────────────────────┐
  │ gate-service  → 주소 상태 게이트         │
  │ query-service → 정책 규칙 해결           │
  │ decode-service → 좌표 디코딩 (D1 직접)   │
  └──────────────────────────────────────────┘
```

## prod 배포

모든 서비스가 Cloudflare Workers + D1로 배포됨:

```bash
pnpm health    # CF Workers 상태 확인
```

| 서비스 | prod URL |
|--------|----------|
| registry-service | qa-registry-service.astralclover.workers.dev |
| ingest-server | qa-ingest-server.astralclover.workers.dev |
| gateway | qa-gateway.astralclover.workers.dev |
| gate-service | qa-gate-service.astralclover.workers.dev |
| query-service | qa-query-service.astralclover.workers.dev |
| decode-service | qa-decode-service.astralclover.workers.dev |
| shopping-web | shop-web-7dq.pages.dev |
| platform-demo | platform-demo-3v1.pages.dev |

env 전환: config.js의 `ENV: "dev"` → `"prod"` 변경, 또는 `registry.fetchServiceUrls("prod")`.
