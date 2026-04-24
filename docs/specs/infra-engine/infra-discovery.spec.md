---
def:
  id: infra-discovery
  scope: feature
  aspect: func_def
  depth: specification
  tier: component
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
- **Offline fallback**: registry-service 미실행 시 infra-profile 기준으로 status / discover 일부 명령을 축소 동작
- **CLI 명령**: `discover.ts` (--all, --list, --code) + `export.ts` (status, env, ts, compose)

## 방법 ^method

DiscoveryClient가 registry-service의 서비스 데이터를 가져오고, FleetManager가 이를 InfraProfileAdapter의 배포 메타데이터와 결합하여 Fleet 수준의 관리를 수행한다. Export 도구는 DiscoveryClient의 데이터를 다양한 형식으로 변환하여 소비자(다른 서비스, Docker, CI)에 주입한다.

**부속 배포 전파**: `deployedWith`가 선언된 서비스는 자체 배포 기록이 없어도 부모 서비스의 deployed/running 상태를 상속받는다. Fleet status에서 `(via {parentId})`로 표시.

**배포 대상 필터**: `deployedWith`가 있는 서비스는 독립 배포 단위가 아니므로 `listDeployable()`과 Fleet 실행 대상에서 제외한다.

**Offline fallback**: registry-service가 내려가 있으면 FleetManager는 `infra-profile.json`의 deployment 목록을 기준으로 축소된 `ServiceInfo`/URL 맵을 만들고, CLI는 이를 사용해 `status`, `discover --list`, `discover --all`, 단일 서비스 조회를 계속 제공한다. 이 경우 `tier`, `team`, prefix 정보는 로컬 state 기반 축약값으로 대체된다.

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
  /** 독립 배포 단위가 아닌 다른 서비스의 부속으로 배포되는 경우, 부모 serviceId */
  deployedWith?: string;
}
```

`deployedWith`는 독립 패키지 없이 부모 서비스에 포함되어 배포되는 도메인 서비스를 표현한다.
예: `shopping-backend`, `auth`, `payment`은 `platform-demo-api` Workers 하나에 포함되어 배포.

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
  deployAll(env: string, options?: FleetRunOptions): Promise<FleetDeployResult>;

  /** 특정 tier의 서비스만 배포 */
  deployByTier(env: string, tier: string, options?: FleetRunOptions): Promise<FleetDeployResult>;
}

interface FleetRunOptions {
  dryRun?: boolean;             // 기본 true
  continueOnError?: boolean;    // 기본 false
  provider?: "local" | "cloudflare";
  sync?: boolean;
}
```

팩토리: `createFleetManager(discovery: DiscoveryClient, infraProfile: InfraProfileAdapter, options?): FleetManager`
- 기본 구현은 `scripts/infra.ts deploy`를 재사용해 실제 배포를 수행한다.
- 테스트/호출자 제어를 위해 `options.deployExecutor`를 주입할 수 있다.

### FleetStatus

```typescript
interface FleetStatus {
  env: string;
  services: FleetServiceStatus[];
  summary: {
    total: number;
    deployed: number;
    running: number;
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
  running?: boolean;       // 헬스체크로 확인된 실행 상태
  healthy?: boolean;       // true=헬스체크 통과, false=실패, undefined=미배포
  env: string;
  /** 부모 서비스의 부속으로 배포된 경우, 부모 serviceId */
  deployedWith?: string;
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
| generateEnvFile | `infra-env-kit` | .env 파일 생성 |
| generateTypescriptModule | `infra-env-kit` | TypeScript 모듈 생성 |
| generateDockerComposeOverride | `infra-env-kit` | docker-compose override 생성 |
| writeEnvExport / writeTypescriptExport / writeDockerComposeExport | `infra-env-kit` | export 파일 생성 orchestration |
| runPostDeployCodegen | `infra-env-kit` | post-deploy env/TS codegen orchestration |

## CLI 명령

### discover 명령

```
infra discover <serviceId> <env>                 # 단일 서비스 조회
infra discover --all <env>                       # 전체 서비스 URL 맵
infra discover --list                            # 서비스 목록
infra discover --deep <serviceId> <env>          # 문서/테스트/prefix 포함 상세 조회
infra discover --code <serviceId> <env>          # 연결 코드 생성
```

registry-service가 없으면:
- `--list`, `--all`, 단일 조회는 `infra-profile` 기준 fallback 가능
- `--deep`, `--code`는 registry/definition 의존이 강해 제한되거나 실패할 수 있음

### deploy 명령

```
infra deploy <service> <env> [config]            # 단일 서비스 배포
infra deploy <service> <env> --dry-run           # 변경 사항 미리보기 (Pulumi preview)
infra deploy --all <env>                         # 환경 내 전체 서비스 순차 배포
infra deploy --all <env> --tier <tier>           # 특정 tier만 순차 배포
infra deploy --all <env> --provider cloudflare   # provider override
infra deploy --all <env> --continue-on-error     # 실패 시에도 계속 배포
```

`infra deploy --all`은 현재 `FleetManager`를 사용한다. 서비스 목록은 config 파일의 서비스 집합으로 우선 scope를 잡고, registry가 가능하면 discovery 메타데이터를 사용하며, registry가 없으면 config/infra-profile 기준으로 축소 동작한다.

`infra export`는 이제 `scripts/export.ts`에 의존하지 않는다.

- `status`와 `docs`는 infra-engine CLI handler가 직접 수행한다.
- `env`/`ts`/`compose`는 infra-env-kit의 supply export command를 직접 호출한다.
- 별도 공급 CLI가 필요하면 `infra-env`를 사용한다.

### destroy 명령

```
infra destroy <service> <env>                    # 서비스 리소스 정리
infra destroy <service> <env> --yes              # 확인 프롬프트 스킵
```

### export 명령

```
infra export docs <env>                          # 문서 요약 생성
```

공급 기능의 기본 surface는 `infra-env`다.

```
infra-env env <serviceId> <env>
infra-env ts <env>
infra-env compose <env>
```

workspace 로컬 실행 예시:

```bash
pnpm --filter infra-env-kit build
pnpm --filter infra-env-kit cli env ingest-server dev
pnpm --filter infra-env-kit cli ts dev
pnpm --filter infra-env-kit cli compose dev
```

`infra export env|ts|compose`는 지원하지만 legacy consumer surface다. 문서, 예제, 운영 스크립트는 `infra-env`를 우선한다.

### status / history / audit 명령

```
infra status <env>                               # Fleet 상태 조회 (tier별)
infra history <service>                          # 배포 이력 테이블
infra history <service> --json                   # 배포 이력 JSON 출력
infra audit                                      # registry 데이터 품질 점검
```

`infra status <env>`는 registry-service가 내려가 있어도 `infra-profile` 기준으로 축소 출력된다. 이 경우 `tier`는 `"unknown"`으로, URL은 마지막 배포 endpoint로 채운다.

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
infra pf list                                    # 활성 port-forward + dev server 목록
infra pf register <name> <port>                  # ad-hoc local server 등록
infra pf remove <name>                           # ad-hoc local server 제거
infra pf cleanup                                 # 죽은 PID 정리
```

`infra pf list`는 K3s port-forward뿐 아니라 수동 등록한 local dev server도 함께 보여준다.
예: `infra pf register viz-web 5201 --service viz-web --kind dev-server`

### Vite Dev Server 자동 등록

`vitePfPlugin`으로 Vite dev server 시작/종료 시 pf-registry에 자동 등록/해제한다. 포트 충돌로 변경되더라도 실제 할당 포트를 등록.

```typescript
// vite.config.ts
import { vitePfPlugin } from "infra-engine";

export default defineConfig({
  plugins: [vitePfPlugin({ service: "my-app" })],
});
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `service` | (필수) | 서비스 식별자 |
| `key` | `${service}-dev` | pf-registry 키 |
| `namespace` | `"local"` | 네임스페이스 |
| `note` | `"Vite dev server"` | 메모 |

동작: `httpServer.listening` → `registerPfEntry()` (PID + 실제 포트), `SIGINT`/`SIGTERM`/`exit` → `removePfEntry()`.
소스: `packages/infra-engine/src/lib/vite-pf-plugin.ts`

### version 관리

```
infra version list [env]                         # 배포 버전 목록 (env 필터 가능)
infra version show <service> [env]               # 서비스 버전 상세 (이력 포함)
infra version rollback <service> [env]           # 이전 버전으로 롤백 표시
```

### history 구조

`infra-profile.json`의 서비스별 history는 단순 성공/실패 로그를 넘어서 Fleet 컨텍스트를 선택적으로 포함한다.

```typescript
interface DeployHistoryEntry {
  deployedAt: string;
  version: string;
  env: string;
  provider: string;
  endpoint: string;
  duration: number;
  success: boolean;
  triggeredBy: "ci" | "manual";
  mode?: "single" | "fleet-service" | "fleet-summary";
  runId?: string;              // fleet 실행 ID
  scope?: string;              // 예: "all", "backend"
  configPath?: string;
  artifactId?: string;         // artifact registry record ID
  error?: string;              // 실패 요약
}
```

- 단일 배포: `mode="single"`
- Fleet에서 파생된 서비스 배포: `mode="fleet-service"` + `runId`
- Fleet 요약 기록: `mode="fleet-summary"`이며 `serviceId` 대신 `fleet:<env>:...` 키로 저장 가능

---

## post-deploy 자동화

배포 완료 후 실행되는 자동화 파이프라인. `--sync` 플래그로 활성화.

### codegen (post-deploy/codegen.ts)

배포된 서비스의 연결 정보 변경을 소비자에게 자동 전파한다.

1. **TypeScript 연결 모듈 재생성** — `generated/service-connections.{env}.ts`
2. **.env 파일 재생성** — 배포된 서비스 자체 + 의존 서비스 (consumedPrefixes 기반 역추적)
3. config JSON에서 서비스별 설정을 로딩하여 env 변환에 반영

```typescript
interface CodegenOptions {
  tsOutputDir?: string;        // 기본: generated/
  envOutputDir?: string;       // 기본: generated/env/
  targetServices?: string[];   // 명시적 대상 (미지정: 자동 역추적)
  configPath?: string;         // 미지정: config/{env}.json 자동 탐색
}

function runPostDeployCodegen(
  discovery: DiscoveryClient,
  deployedServiceId: string,
  env: string,
  options?: CodegenOptions,
): Promise<{ tsPath?: string; envPaths: string[] }>;
```

### cascade 감지 (post-deploy/cascade.ts)

config의 `depends_on`을 기반으로 배포된 서비스에 의존하는 서비스를 감지한다.

```typescript
interface CascadeTarget {
  serviceId: string;
  reason: string;  // "depends_on ingest-server" 등
}

function findCascadeTargets(config: ResolvedConfig, deployedServiceId: string): CascadeTarget[];
function executeCascade(targets: CascadeTarget[], env: string, options?: { dryRun?: boolean }): Promise<void>;
```

- dry-run 모드: 감지만 수행, 재배포 명령 안내만 출력
- 실제 재배포는 호출자가 `infra deploy`를 다시 실행

### 버전 관리 (post-deploy/version-manager.ts)

배포 버전을 `~/.qa-sdk/infra-versions.json`에 영속화한다. 최대 20건 이력 보존.

```typescript
interface VersionStore {
  getVersion(serviceId: string, env: string): Promise<ServiceVersion | null>;
  setVersion(serviceId: string, env: string, version: string, endpoint: string, provider: string): Promise<ServiceVersion>;
  listVersions(env?: string): Promise<ServiceVersion[]>;
  rollback(serviceId: string, env: string): Promise<ServiceVersion | null>;
}
```

- 원자적 쓰기: tmp 파일 → rename (데이터 손실 방지)
- rollback: currentVersion ↔ previousVersion 교환 + history에 rollbackFrom 기록

### definition-service 동기화 (post-deploy/sync.ts)

배포 후 infra-profile에 버전을 기록하고, definition-service에 배포 상태를 알린다.

- `recordDeployVersion()`: infra-profile history에 기록
- `syncToDefinitionService()`: definition-service에 배포 알림 (fail-open — 미실행 시 무시)

### artifact registry 기록 (post-deploy/artifact-registry.ts)

배포 결과는 programming artifact registry에도 남길 수 있다.

- 서비스 단위: `kind="deployment-output"`
- Fleet 실행 요약: `kind="deployment-batch"`

Fleet 실행 요약 record는 다음 정보를 포함한다:
- `artifactRef = "fleet-run:{runId}"`
- `metadata.results` — 서비스별 성공/실패/소요시간
- `metadata.successfulServices`, `metadata.failedServices`
- 실행 옵션 (`provider`, `sync`, `continueOnError`, `dryRun`)

서비스 단위 deployment-output record도 Fleet에서 파생된 경우 `fleetRunId`, `fleetMode`, `fleetScope` 메타데이터를 함께 가진다.
