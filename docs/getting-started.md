---
def:
  id: getting-started-guide
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  tags: [entry-point, runtime, cross-scope]
  links:
    - target: guides-system
      type: refines
    - target: system-overview
      type: refs
    - target: apm-codegen-system
      type: refs
    - target: browser-system
      type: refs
    - target: registry-system
      type: refs
    - target: df-system
      type: refs
sources:
  - package.json
  - scripts/setup.sh
  - scripts/health.sh
  - packages/cli/package.json
  - packages/cli/src/index.ts
  - packages/cli/src/command-groups/root.commands.ts
  - packages/cli/src/command-groups/dkg.commands.ts
  - packages/cli/src/command-groups/flow.commands.ts
  - packages/cli/src/commands/init.ts
  - packages/cli/src/commands/codegen.ts
  - packages/cli/src/commands/codegen.test.ts
  - packages/core/src/index.ts
  - packages/demo-snapshot/src/index.ts
  - packages/browser-sdk/package.json
  - packages/browser-sdk/src/index.ts
  - packages/registry-client/src/index.ts
  - packages/ingest-server/package.json
  - packages/registry-service/package.json
  - packages/shop-web/package.json
  - packages/platform-demo/package.json
  - docs/system-overview.md
  - docs/specs/guides-system/guides-system.md
---
# QA-SDK Getting Started

## 목적 ^purpose

QA-SDK 시작 가이드. 산출물 단위, codegen 실행, CLI 사용법, 첫 이벤트 전송까지의 흐름을 안내한다.


5분 안에 로컬 환경 구성부터 첫 이벤트 수집까지.

## Prerequisites

- Node.js 22+
- Corepack 활성화
- 루트 `packageManager`에 고정된 pnpm 버전

## 1. 환경 구성

```bash
git clone <repo-url> && cd qa-sdk
corepack pnpm setup     # 의존성 + .env + 빌드 + 검증 (원클릭)
```

## 2. 서비스 기동

```bash
corepack pnpm dev:local # 전체 로컬 스택 동시 기동
```

로컬 기동 계약과 서비스 간 readiness 규칙은 [로컬 개발 런타임 스펙](specs/infra-engine/local-development-runtime.spec.md)을 따른다.

| 서비스 | URL | 용도 |
|--------|-----|------|
| registry-service | http://localhost:3300 | 카탈로그/좌표 스키마 |
| definition-service | http://localhost:3700 | 문서 metadata sync/search/graph |
| ingest-server | http://localhost:3200 | 이벤트 수집 |
| gate-service | http://localhost:3400 | 품질 gate |
| query-service | http://localhost:3500 | 이벤트 조회 |
| decode-service | http://localhost:3600 | 주소 디코딩 |
| gateway | http://localhost:8787 | 로컬 API gateway |
| platform-demo-api | http://localhost:8788 | 데모 API |
| shop-web | http://localhost:5220 | 쇼핑 데모 |
| platform-demo | http://localhost:5176 | 3D 모니터 + 다이어그램 + 디버거 |

```bash
corepack pnpm health    # 로컬 서비스와 인프라 헬스체크
# Cloudflare 배포 상태를 함께 확인할 때만 명시적으로 실행
CHECK_CLOUDFLARE=1 corepack pnpm health
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
qa-sdk codegen --catalog my-project.catalog.json --output ./generated

# 또는 레지스트리에서 fetch
qa-sdk codegen --registry http://localhost:3300 --catalog-id demo --output ./generated
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
import { createQaMonitor } from '@qa-sdk/browser';

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
qa-sdk dkg flow-schemas # 의사결정 플로우 스키마
qa-sdk dkg skills      # 자동화 스킬 목록
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
CHECK_CLOUDFLARE=1 corepack pnpm health    # CF Workers 상태 확인 포함
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

---

## 다음 읽기

- 좌표 개념 이해: `docs/CONVENTIONS.md` — DimRef, Axis, Prefix, Address 용어 정의
- DKG 탐색: `dkg skills` — 40개 자동화 도구 목록 + `dkg run skill-system-overview`
- 운영 플레이북: `docs/skills/README.md` — prefix 추가, 시스템 리뷰, claim 워크플로우
- 상세 스펙: `docs/specs/README.md` — 관심사별 스펙 인덱스
