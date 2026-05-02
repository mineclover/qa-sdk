# infra-env-kit

`infra-env-kit`는 `infra-engine`에서 분리된 **환경 공급 패키지**다.

역할:

- 서비스 설정 객체 → env vars 변환
- 서비스용 `.env` 파일 생성
- TypeScript 서비스 연결 모듈 생성
- `docker-compose.override.yml` 생성
- post-deploy codegen orchestration
- export 파일 생성 orchestration

핵심 API:

- `configToEnvVars()`
- `extractServiceEnv()`
- `resolveConnectionEnv()`
- `generateEnvFile()`
- `generateTypescriptModule()`
- `generateDockerComposeOverride()`
- `runPostDeployCodegen()`
- `runSupplyExportCommand()`

CLI:

```bash
infra-env env <serviceId> [env]
infra-env ts [env]
infra-env compose [env]
```

정책:

- 환경 공급 관련 신규 사용자는 `infra-env`를 기본 surface로 본다.
- `infra-engine`의 `infra export env|ts|compose`는 legacy consumer surface다.
- 문서/예제/운영 스크립트는 가능하면 `infra-env`를 사용한다.

권장 사용:

```bash
# 서비스용 .env 생성
pnpm --filter infra-env-kit build
pnpm --filter infra-env-kit cli --help
pnpm --filter infra-env-kit cli env ingest-server dev

# 서비스 연결 TypeScript 생성
pnpm --filter infra-env-kit cli ts dev

# docker-compose override 생성
pnpm --filter infra-env-kit cli compose dev
```

옵션:

- `--registry-url <url>` — registry-service base URL
- `--catalog <id>` — catalog id
- `--out <path>` — 출력 경로 override
- `env` 명령은 `--all`, `--pg-domain`, `--pg-host` 지원

주의:

- `infra-env`는 registry-service discovery 결과를 사용하므로 기본적으로 registry 접근이 가능해야 한다.

예시:

```ts
import { generateEnvFile, runPostDeployCodegen } from "infra-env-kit";
```

`infra-engine`는 public package export에서 일부 호환 re-export를 유지하지만, 내부 wrapper 파일은 제거됐다. 신규 소비자는 `infra-env-kit`를 직접 import하는 것이 권장된다.
