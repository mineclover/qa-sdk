---
def:
  id: infra-discovery
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: approved
  layer: mediation
  tags: [infra, discovery, export]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-adapters
      type: depends_on
---
# 서비스 디스커버리 + Fleet 관리 + Export 도구

## 목적 ^purpose

registry-service에 등록된 서비스 메타데이터를 기반으로, 서비스 디스커버리(URL 해석), Fleet 단위 배포 관리, 그리고 .env / TypeScript / docker-compose 형태의 설정 파일 자동 생성을 제공한다. 배포 후 서비스 간 연결 설정을 수동으로 관리하는 부담을 제거한다.

## 구성 ^overview

- **DiscoveryClient**: registry-service HTTP API를 통해 서비스 정보 조회 + env별 URL 해석 + 연결 코드 생성
- **FleetManager**: DiscoveryClient + InfraProfileAdapter를 조합하여 환경 단위 배포 상태 조회 + 일괄 배포
- **Export 도구**: DiscoveryClient 데이터를 .env, TypeScript 모듈, docker-compose.override.yml로 변환
- **CLI 명령**: `discover.ts` (--all, --list, --code) + `export.ts` (status, env, ts, compose)

## 방법 ^method

DiscoveryClient가 registry-service의 서비스 데이터를 가져오고, FleetManager가 이를 InfraProfileAdapter의 배포 메타데이터와 결합하여 Fleet 수준의 관리를 수행한다. Export 도구는 DiscoveryClient의 데이터를 다양한 형식으로 변환하여 소비자(다른 서비스, Docker, CI)에 주입한다.

---

## 정의 ^defines

### ServiceInfo

```typescript
interface ServiceInfo {
  serviceId: string;
  name: string;
  url: string;
  tier: string;
  team: string;
  ownedPrefixes: string[];
  consumedPrefixes: string[];
  urls?: Record<string, string>;  // env별 URL 맵
}
```

### DiscoveryClient

```typescript
interface DiscoveryClient {
  /** 단일 서비스 조회 -- env별 URL 해석 */
  resolve(serviceId: string, env?: string): Promise<ServiceInfo | null>;

  /** 전체 서비스 URL 맵 조회 (env별) */
  resolveAll(env?: string): Promise<Record<string, string>>;

  /** 서비스 목록 조회 */
  listServices(): Promise<ServiceInfo[]>;

  /** 서비스 연결 코드 생성 -- TypeScript 코드 문자열 반환 */
  generateConnectCode(serviceId: string, env?: string): Promise<string>;

  /** 여러 서비스의 연결 코드를 한번에 생성 */
  generateConnectCodeAll(serviceIds: string[], env?: string): Promise<string>;
}
```

팩토리: `createDiscoveryClient(registryUrl: string, catalogId?: string): DiscoveryClient`
- `registryUrl`: registry-service 기본 URL (예: `http://localhost:3300`)
- `catalogId`: 카탈로그 식별자 (기본: `"demo"`)
- 모든 HTTP 요청에 `AbortSignal.timeout(5_000)` 적용

### FleetManager

```typescript
interface FleetManager {
  /** 환경별 전체 서비스 상태 조회 */
  status(env: string): Promise<FleetStatus>;

  /** 환경별 배포 가능한 서비스 목록 */
  listDeployable(env: string): Promise<ServiceInfo[]>;

  /** 환경에 모든 서비스 배포 (순차) */
  deployAll(env: string, options?: { dryRun?: boolean }): Promise<FleetDeployResult>;

  /** 특정 tier의 서비스만 배포 */
  deployByTier(env: string, tier: string): Promise<FleetDeployResult>;
}
```

팩토리: `createFleetManager(discovery: DiscoveryClient, infraProfile: InfraProfileAdapter): FleetManager`

### FleetStatus

```typescript
interface FleetStatus {
  env: string;
  services: FleetServiceStatus[];
  summary: {
    total: number;
    deployed: number;
    healthy: number;
    degraded: number;
    unknown: number;
  };
}

interface FleetServiceStatus {
  serviceId: string;
  name: string;
  tier: string;
  registryUrl: string;
  deployedUrl?: string;
  deployed: boolean;
  healthy?: boolean;       // true=헬스체크 통과, false=실패, undefined=미배포
  env: string;
}
```

### FleetDeployResult

```typescript
interface FleetDeployResult {
  env: string;
  results: Array<{
    serviceId: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    totalDuration: number;
  };
}
```

### Export 도구

```typescript
/** .env 파일 생성 */
function generateEnvFile(
  discovery: DiscoveryClient,
  options: EnvFileOptions,
): Promise<string>;

interface EnvFileOptions {
  serviceId: string;
  env: string;
  includeAll?: boolean;  // true: 모든 서비스 URL 포함
}

/** TypeScript 서비스 연결 모듈 생성 */
function generateTypescriptModule(
  discovery: DiscoveryClient,
  env: string,
  serviceIds?: string[],
): Promise<string>;

/** docker-compose.override.yml 생성 */
function generateDockerComposeOverride(
  discovery: DiscoveryClient,
  env: string,
): Promise<string>;
```

### Export 출력 형식

**.env 파일** (`generateEnvFile`):
```
# 자동 생성 — ingest-server (dev)
NODE_ENV=development
PORT=3200
# 서비스 연결
GATE_SERVICE_URL=http://localhost:3400
REGISTRY_SERVICE_URL=http://localhost:3300
```

**TypeScript 모듈** (`generateTypescriptModule`):
```typescript
export const SERVICE_URLS = { ... } as const;
export type ServiceId = keyof typeof SERVICE_URLS;
export function getServiceUrl(serviceId: ServiceId): string;
export async function checkHealth(serviceId: ServiceId): Promise<boolean>;
// 서비스별 상수: INGEST_SERVER, REGISTRY_SERVICE 등
```

**docker-compose.override.yml** (`generateDockerComposeOverride`):
```yaml
services:
  ingest-server:
    environment:
      NODE_ENV: development
      PORT: "3200"
      REGISTRY_SERVICE_URL: "http://localhost:3300"
```

## 소비 ^consumes

- `registry-service` HTTP API (`/api/services`, `/api/services/:id`, `/api/services/urls`)
- `InfraProfileAdapter` — 배포 메타데이터 (FleetManager에서 사용)
- `ServiceInfo` — registry-service 응답 타입

## 위임 ^delegates

| 하위 모듈 | 파일 | 역할 |
|-----------|------|------|
| DiscoveryClient | `discovery/client.ts` | registry-service 조회 + URL 해석 + 코드 생성 |
| FleetManager | `fleet/manager.ts` | 환경 단위 상태 조회 + 배포 관리 |
| generateEnvFile | `export/env-file.ts` | .env 파일 생성 |
| generateTypescriptModule | `export/typescript-module.ts` | TypeScript 모듈 생성 |
| generateDockerComposeOverride | `export/docker-compose.ts` | docker-compose override 생성 |

## CLI 명령

### discover 명령

```
infra discover <serviceId> <env>                 # 단일 서비스 조회
infra discover --all <env>                       # 전체 서비스 URL 맵
infra discover --list                            # 서비스 목록
infra discover --deep <serviceId> <env>          # 문서/테스트/prefix 포함 상세 조회
infra discover --code <serviceId> <env>          # 연결 코드 생성
```

### deploy 명령

```
infra deploy <service> <env> [config]            # 단일 서비스 배포
infra deploy <service> <env> --dry-run           # 변경 사항 미리보기 (Pulumi preview)
infra deploy --all <env>                         # 환경 내 전체 서비스 순차 배포
infra deploy --all <env> --continue-on-error     # 실패 시에도 계속 배포
```

### destroy 명령

```
infra destroy <service> <env>                    # 서비스 리소스 정리
infra destroy <service> <env> --yes              # 확인 프롬프트 스킵
```

### export 명령

```
infra export env <serviceId> <env>               # .env 파일 생성
infra export ts <env> [--out <path>]             # TypeScript 모듈 생성
infra export compose <env>                       # docker-compose override 생성
infra export docs <env>                          # 문서 요약 생성
```

### status / history / audit 명령

```
infra status <env>                               # Fleet 상태 조회 (tier별)
infra history <service>                          # 배포 이력 테이블
infra history <service> --json                   # 배포 이력 JSON 출력
infra audit                                      # registry 데이터 품질 점검
```

### monitor / dashboard 명령

```
infra monitor start [--interval N]               # 백그라운드 sync-loop 시작
infra monitor check                              # 수동 1회 동기화
infra monitor status                             # 마지막 체크 결과

infra dashboard summary                          # 전체 서비스 상태 요약
infra dashboard service <id>                     # 서비스 상세
infra dashboard export [path]                    # JSON export
```

### port-forward 관리

```
infra pf list                                    # 활성 port-forward 목록
infra pf cleanup                                 # 죽은 PID 정리
```
