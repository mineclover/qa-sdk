---
name: infra-export
description: "서비스 연결 정보 export — .env 파일, TypeScript 모듈, docker-compose override, 문서 요약 생성. 트리거: /infra-export, 'env 파일 생성', '연결 코드 생성', 'export'."
---

# Infra Export — 서비스 연결 정보 내보내기

registry-service + definition-service 데이터를 소비 가능한 형식으로 export한다.

환경 공급 산출물의 신규 SSOT는 `infra-env-kit`의 `infra-env` CLI다. `infra-engine infra export ...`는 호환용 legacy surface이므로 새 작업에서는 아래 명령을 사용한다.

## 사전 조건

- registry-service 실행 중 (localhost:3300)
- definition-service 실행 중 (localhost:3700) — `docs` 명령에 필요

## 명령

```bash
# 먼저 CLI 산출물을 만든다
corepack pnpm --filter infra-env-kit build

# .env 파일 (consumed prefix 기반 필터링)
corepack pnpm --filter infra-env-kit cli env gate-service dev
# → .env.gate-service.dev (core + consumed만)

# .env 파일 (전체 서비스)
corepack pnpm --filter infra-env-kit cli env gate-service dev --all
# → .env.gate-service.dev (모든 서비스 URL)

# TypeScript 모듈
corepack pnpm --filter infra-env-kit cli ts dev
# → generated/service-connections.dev.ts

# docker-compose override
corepack pnpm --filter infra-env-kit cli compose dev
# → generated/docker-compose.override.dev.yml

# 서비스별 문서 요약
corepack pnpm --filter infra-engine infra docs ingest-server
# → 48건 문서 lifecycle/layer 분포

# 전체 서비스 문서 요약
corepack pnpm --filter infra-engine infra docs
```

## 출력 형식

### .env 파일 (기본: 필터링)

```env
# 자동 생성 — gate-service (dev)
NODE_ENV=development
PORT=3400

# 서비스 연결
INFRA_CONTROLLER_URL=http://localhost:3300    ← consumed prefix 소유 서비스
INGEST_SERVER_URL=http://localhost:3200       ← core 서비스
REGISTRY_SERVICE_URL=http://localhost:3300    ← core 서비스
```

필터링 규칙:
- `consumedPrefixes`를 소유하는 서비스의 URL 포함
- core 서비스 (ingest-server, registry-service) 항상 포함
- `--all` 플래그로 전체 서비스 URL 포함 가능

### TypeScript 모듈

```typescript
export const SERVICE_URLS = {
  "ingest-server": "http://localhost:3200",
  "gate-service": "http://localhost:3400",
} as const;

export type ServiceId = keyof typeof SERVICE_URLS;
export function getServiceUrl(serviceId: ServiceId): string { ... }
export async function checkHealth(serviceId: ServiceId): Promise<boolean> { ... }

// 서비스별 상수
export const INGEST_SERVER = {
  url: "http://localhost:3200",
  serviceId: "ingest-server" as const,
  tier: "infra",
  ownedPrefixes: [...] as const,
} as const;
```

### docker-compose override

```yaml
services:
  ingest-server:
    environment:
      NODE_ENV: development
      PORT: "3200"
      REGISTRY_SERVICE_URL: "http://localhost:3300"
```

## 활용

1. **서비스 개발 시작**: `infra-env env my-service dev` → `.env` 파일 생성 후 `source`
2. **코드에 연결 정보**: `infra-env ts stage` → `import { getServiceUrl } from "./generated/..."`
3. **Docker Compose 로컬 개발**: `infra-env compose dev` → 환경변수 자동 주입
4. **문서 현황 파악**: `infra docs` → 서비스별 스펙 문서 분포
