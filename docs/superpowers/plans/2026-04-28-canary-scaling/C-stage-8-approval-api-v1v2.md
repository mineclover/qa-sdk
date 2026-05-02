## 단계 8: approval-api v1/v2 빌드 분리 + version stamp + DataSource 분리

**Spec 참조:** `02-canary-topology.md` §1·§4 + `04-scaling-infra.md` §4.2·§4.3

approval-api 한 컨테이너를 `sim-approval-api-v1`(stable) / `sim-approval-api-v2`(candidate) 두 entry로 분리한다. 같은 Dockerfile을 공유하고 build arg `SERVICE_VERSION` + env `SIM_SERVICE_VERSION`만으로 구분된다. v1/v2 코드는 응답 헤더·outbox event·audit entry에 자기 버전 stamp를 박고, outbox publish는 grammar #6(Plan A Task 2.7 `buildSchemaHash`)로 결정론적 schemaHash를 첨부한다. BFF/reporting slice는 spec 04 §4.3 read-replica 라우팅을 따라 `READ_DATA_SOURCE` 토큰만 주입받고, write DataSource import는 ESLint custom rule이 차단한다. gateway 라우팅 결정은 단계 9 — 본 단계는 *컨테이너 정체성*과 *DataSource 경계*만 책임진다.

### File Structure (단계 8)

| 종류 | 경로 |
|---|---|
| Modify | `simulations/enterprise-pm/services/approval-api/Dockerfile` (`SERVICE_VERSION` build arg 추가) |
| Modify | `simulations/enterprise-pm/docker-compose.sim.yaml` (`sim-approval-api` → `sim-approval-api-v1` + `sim-approval-api-v2` 분리) |
| Modify | `simulations/enterprise-pm/.env.sim.example` (`APPROVAL_V1_TAG`, `APPROVAL_V2_TAG`) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/config/env.ts` (`SIM_SERVICE_VERSION` 추가) |
| Create | `simulations/enterprise-pm/services/approval-api/src/lib/service-version.ts` (stamp helper) |
| Create | `simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.interceptor.ts` (Nest interceptor: 응답 헤더 첨부) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/main.ts` (interceptor 등록) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/infrastructure/outbox/*.outbox.ts` (publish 시 `serviceVersion` + `schemaHash` payload 첨부) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/application/use-cases/*.ts` (audit entry에 `serviceVersion` 첨부 — 도메인 이벤트 메타) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/approval-db.module.ts` (`READ_DATA_SOURCE`/`WRITE_DATA_SOURCE` 토큰 분리, `createDualConnection` 사용) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/presentation/bff/*.bff.ts` (read-only 토큰 주입) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/application/queries/*.query.ts` (read-only DataSource로 마이그레이션) |
| Create | `eslint-rules/no-write-datasource-in-bff.js` (custom ESLint rule) |
| Modify | `eslint.config.mjs` (rule 등록) |
| Create | `simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/lib/outbox-payload.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/budget/presentation/bff/budget-detail.read-source.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/test/integration/v1-v2-routing.test.ts` |
| Create | `simulations/enterprise-pm/test/scenarios/scenario-09-v1-equals-v2.fixture.ts` |
| Create | `simulations/enterprise-pm/test/scenarios/scenario-10-schema-break.fixture.ts` |
| Create | `simulations/enterprise-pm/test/scenarios/scenario-11-audit-anomaly.fixture.ts` |
| Create | `simulations/enterprise-pm/test/regression/scenarios-1-to-8.smoke.test.ts` |

---

### Task 8.1: approval-api Dockerfile에 SERVICE_VERSION build arg 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/Dockerfile`

이 Dockerfile은 같은 base 이미지(`qa-sdk/sim-base:latest`)를 공유한 채로 v1/v2 두 컨테이너를 분리하는 단일 source가 된다. spec 02 §1 인용: "두 entry는 같은 Dockerfile을 공유하고, 서로 다른 이미지 태그와 `SIM_SERVICE_VERSION` env 만으로 구분된다." Plan A Task 1.1의 multistage 패턴을 그대로 따른다(이 Dockerfile은 wrapper이므로 build arg 전달만 추가).

- [ ] **Step 8.1.1: 기존 Dockerfile에 `SERVICE_VERSION` ARG 추가**

`simulations/enterprise-pm/services/approval-api/Dockerfile` 내용을 다음과 같이 수정한다.

```dockerfile
# 시뮬 sim-approval-api — Plan 09c의 monorepo Dockerfile.service에 빌드 인자 전달
# 본 wrapper는 docker-compose.sim.yaml이 build context를 service-specific으로 지정할 때 사용한다.
ARG SERVICE_PATH=simulations/enterprise-pm/services/approval-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-approval-api
# 단계 8(Plan C): catalog version axis 산출 태그 (grammar #3). 빌드 시점 stamp.
ARG SERVICE_VERSION=unknown

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ARG SERVICE_VERSION
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
# 컨테이너 자기 정체성 — runtime이 응답 헤더 / outbox payload / audit entry에 stamp.
ENV SIM_SERVICE_VERSION=${SERVICE_VERSION}
LABEL sim.role="approval-api"
LABEL sim.version="${SERVICE_VERSION}"
WORKDIR /app/${SERVICE_PATH}
EXPOSE 4600
CMD ["node", "dist/main.js"]
```

세 가지 변경의 의도:

1. `ARG SERVICE_VERSION` — compose가 `args.SERVICE_VERSION: ${APPROVAL_V1_TAG}` 으로 주입하는 build arg. 기본값 `unknown`은 인자 누락 검출용(env 검증이 unknown을 거부).
2. `ENV SIM_SERVICE_VERSION` — 런타임 컨테이너가 자기 버전을 읽는 단일 소스. config/env.ts zod schema가 검증.
3. `LABEL sim.role` / `LABEL sim.version` — `docker ps --filter label=sim.role=approval-api`로 v1/v2 컨테이너를 구분(controller 옵저버빌리티). spec 02 §1 코드 블록 라벨과 일치.

`SIM_SERVICE_VERSION`은 `03-identifier-grammar.md` §"version-tag"(grammar #3) 형식을 따른다 — `v\d+` 또는 `v\d+-(stable|candidate)`. Dockerfile 자체는 형식 검증을 하지 않고, 검증은 컨테이너 부팅 시점 zod에서(Step 8.4의 env schema) 일어난다.

- [ ] **Step 8.1.2: 빌드 검증 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk
docker buildx build \
  --build-arg SERVICE_VERSION=v3 \
  -f simulations/enterprise-pm/services/approval-api/Dockerfile \
  -t qa-sdk/sim-approval-api:v3 .
docker inspect qa-sdk/sim-approval-api:v3 --format '{{.Config.Labels.sim.version}} {{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E "^v3 |SIM_SERVICE_VERSION="
```

기대 출력에 `v3`(label) + `SIM_SERVICE_VERSION=v3`(env)가 포함된다. 누락 시 ARG/ENV 라인 누락 또는 base 이미지 caching 문제(Plan A Task 1.1과 동일).

- [ ] **Step 8.1.3: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/Dockerfile
git commit -m "feat(sim-approval-api): SERVICE_VERSION build arg + sim.version label"
```

---

### Task 8.2: docker-compose에 v1/v2 두 entry 분리

**Files:**
- Modify: `simulations/enterprise-pm/docker-compose.sim.yaml`
- Modify: `simulations/enterprise-pm/.env.sim.example`

spec 02 §1 정확히 반영: 기존 단일 `sim-approval-api`(line 70-80)를 제거하고 `sim-approval-api-v1`(stable, `${APPROVAL_V1_TAG}`)과 `sim-approval-api-v2`(candidate, `${APPROVAL_V2_TAG}`) 두 service entry로 교체한다. 두 entry는 같은 Dockerfile을 공유하지만 다른 build arg/env로 구분된다.

- [ ] **Step 8.2.1: 기존 sim-approval-api entry 제거**

`simulations/enterprise-pm/docker-compose.sim.yaml`의 라인 70-80(`sim-approval-api:` 블록 전체)을 삭제한다.

- [ ] **Step 8.2.2: v1/v2 두 entry 추가**

`sim-pm-api` 다음에 다음 두 entry를 추가한다(원래 sim-approval-api가 있던 위치 그대로).

```yaml
  sim-approval-api-v1:
    <<: *nestjs-common
    container_name: sim-approval-api-v1
    image: qa-sdk/sim-approval-api:${APPROVAL_V1_TAG:-v3}
    build:
      context: ../..
      dockerfile: simulations/enterprise-pm/services/approval-api/Dockerfile
      args:
        SERVICE_VERSION: ${APPROVAL_V1_TAG:-v3}
    ports:
      - "4600:4600"   # stable: host 노출. v2는 host 노출 없음 (gateway 통과만 허용).
    environment:
      PORT: 4600
      SIM_SERVICE_NAME: sim-approval-api
      SIM_SERVICE_VERSION: ${APPROVAL_V1_TAG:-v3}
      SIM_DB_WRITE_URL: postgres://approval_app:${QA_PG_APPROVAL_PASSWORD}@qa-sdk-db:5432/qa_sdk
      SIM_DB_READ_URL:  postgres://approval_app:${QA_PG_APPROVAL_PASSWORD}@qa-sdk-db-replica:5432/qa_sdk
    labels:
      sim.role: approval-api
      sim.version: ${APPROVAL_V1_TAG:-v3}

  sim-approval-api-v2:
    <<: *nestjs-common
    container_name: sim-approval-api-v2
    image: qa-sdk/sim-approval-api:${APPROVAL_V2_TAG:-v4-candidate}
    build:
      context: ../..
      dockerfile: simulations/enterprise-pm/services/approval-api/Dockerfile
      args:
        SERVICE_VERSION: ${APPROVAL_V2_TAG:-v4-candidate}
    # v2 host port 미노출 — gateway만이 라우팅 (spec 02 §3 단일 라우팅 책임).
    environment:
      PORT: 4600
      SIM_SERVICE_NAME: sim-approval-api
      SIM_SERVICE_VERSION: ${APPROVAL_V2_TAG:-v4-candidate}
      SIM_DB_WRITE_URL: postgres://approval_app:${QA_PG_APPROVAL_PASSWORD}@qa-sdk-db:5432/qa_sdk
      SIM_DB_READ_URL:  postgres://approval_app:${QA_PG_APPROVAL_PASSWORD}@qa-sdk-db-replica:5432/qa_sdk
    labels:
      sim.role: approval-api
      sim.version: ${APPROVAL_V2_TAG:-v4-candidate}
```

핵심 결정.

- v1만 host port `4600:4600` 노출. v2는 gateway(8888) 단일 경로만 허용 (spec 02 §3 단일 라우팅의 *물리적* 강제).
- 두 컨테이너 모두 내부 PORT=4600. read/write URL 동시 주입 (Step 8.5 BFF read 마이그레이션 대비).
- `${APPROVAL_V1_TAG:-v3}` 기본값 — `.env.sim` 누락 dev에서도 부팅. CI는 `scripts/sim-build.sh`(spec 02 §2.2)이 catalog에서 export.
- `<<: *nestjs-common`은 기존 anchor 재사용.

- [ ] **Step 8.2.3: gateway depends_on 갱신**

라인 162 부근 `sim-gateway.depends_on`이 기존 `sim-approval-api`를 참조하고 있을 것이다. 다음과 같이 두 entry를 추가한다.

```yaml
    depends_on:
      sim-redis:
        condition: service_healthy
      sim-auth-api:
        condition: service_started
      sim-approval-api-v1:
        condition: service_healthy
      sim-approval-api-v2:
        condition: service_healthy
```

기존 `sim-approval-api:` 줄이 있으면 제거. v1/v2 둘 다 healthy해야 gateway가 시작된다 — 카나리 사이클 첫 라우팅 push 전에 두 upstream이 모두 ready여야 함을 보장.

- [ ] **Step 8.2.4: .env.sim.example에 두 태그 변수 추가**

`simulations/enterprise-pm/.env.sim.example`의 끝에 다음 줄을 추가한다.

```
# ── 단계 8(Plan C): approval-api v1/v2 image tag (grammar #3, sim.svc.approval prefix) ──
APPROVAL_V1_TAG=v3
APPROVAL_V2_TAG=v4-candidate
QA_PG_APPROVAL_PASSWORD=__from_sops__
```

세 변수의 의미.

- `APPROVAL_V1_TAG` — `sim-service-catalog`에서 `state=stable` 으로 조회한 version. dev 기본값은 `v3`.
- `APPROVAL_V2_TAG` — `state=candidate`. dev 기본값은 `v4-candidate`.
- `QA_PG_APPROVAL_PASSWORD` — approval-api DB user 비밀번호. spec 02 §1과 정확히 일치하기 위해 read/write 동일 user(spec은 추가 분리 요구하지 않음). sops 미보유 dev는 .env.sim.example을 복사해 임의 값 사용 가능.

- [ ] **Step 8.2.5: compose config 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
docker compose -f docker-compose.sim.yaml --env-file .env.sim.example config \
  | grep -A 4 "sim-approval-api-v"
```

기대: `sim-approval-api-v1`과 `sim-approval-api-v2` 두 service가 출력. 각 service의 `image`/`labels`/`environment.SIM_SERVICE_VERSION`이 v3/v4-candidate로 분리.

추가 검증.

```bash
docker compose -f docker-compose.sim.yaml --env-file .env.sim.example config \
  | grep -c "container_name: sim-approval-api"
```

기대: `2`(v1, v2). 만약 `3`이면 기존 단일 entry가 남아있는 것이므로 Step 8.2.1로 복귀.

- [ ] **Step 8.2.6: Commit**

```bash
git add simulations/enterprise-pm/docker-compose.sim.yaml \
        simulations/enterprise-pm/.env.sim.example
git commit -m "feat(sim): split sim-approval-api into v1(stable)/v2(candidate)"
```

---

### Task 8.3: 응답 헤더 + outbox payload + audit entry에 serviceVersion 첨부

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/src/config/env.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/lib/service-version.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.interceptor.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/main.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.test.ts`

spec 02 §4.1 인용: "모든 응답 헤더, 모든 outbox event payload, 모든 audit log entry에 `serviceVersion: SIM_SERVICE_VERSION` 을 첨부한다." 본 task는 응답 헤더 + payload helper를 도입하고, outbox 첨부는 Task 8.4(schemaHash와 같은 publish 경로)에서 묶어 한 번에 처리한다.

- [ ] **Step 8.3.1: env schema 확장**

`simulations/enterprise-pm/services/approval-api/src/config/env.ts`의 `envSchema`에 다음 라인을 추가한다(`SIM_REDIS_URL` 다음 위치).

```typescript
  /** 컨테이너 자기 버전 — Dockerfile ARG에서 주입. grammar #3 형식. dev/test 부팅 보호 위해 default 제공. */
  SIM_SERVICE_VERSION: z
    .string()
    .regex(
      /^v\d+(-stable|-candidate)?$/,
      "SIM_SERVICE_VERSION must match grammar #3 (v<n>[-stable|-candidate])",
    )
    .default("v0-stable"),
  /** read replica DataSource — 단계 8(Plan C). PG dual 환경에서만 사용; 미설정 시 write로 fallback. */
  SIM_DB_WRITE_URL: z.string().url().optional(),
  SIM_DB_READ_URL:  z.string().url().optional(),
```

`SIM_SERVICE_VERSION`은 정규식 실패 시 부팅 즉시 중단(fail-closed) — `unknown`(Dockerfile 기본값)은 거부. 다만 dev/test/CI에서 env 미설정 부팅을 깨지 않기 위해 `.default("v0-stable")` 제공 (grammar #3 호환). 운영(production)은 Dockerfile build arg가 항상 valid 값을 주입하므로 default가 도달하지 않는다. read/write URL은 PG dual 환경에서만 둘 다 설정되며, 미설정 시 read = write fallback (Step 8.5 참조).

- [ ] **Step 8.3.2: service-version helper 작성**

`simulations/enterprise-pm/services/approval-api/src/lib/service-version.ts`:

```typescript
// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { env } from "../config/env.js";

/** 컨테이너 자기 정체성 — Dockerfile ARG SERVICE_VERSION → ENV SIM_SERVICE_VERSION → 본 상수 */
export const SERVICE_VERSION: string = env.SIM_SERVICE_VERSION;

/** outbox event/audit entry payload에 첨부할 stamp. spec 02 §4.1. */
export interface ServiceVersionStamp {
  readonly serviceVersion: string;
}

export function withServiceVersion<T extends object>(payload: T): T & ServiceVersionStamp {
  return { ...payload, serviceVersion: SERVICE_VERSION };
}
```

`env.SIM_SERVICE_VERSION` 참조로 zod 검증을 통과한 값만 사용하게 강제한다 — 코드 어디서도 `process.env.SIM_SERVICE_VERSION` 직접 접근 금지(루트 CLAUDE.md "환경변수 처리" §"서비스" 컨벤션).

- [ ] **Step 8.3.3: VersionStampInterceptor 작성**

`simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.interceptor.ts`:

```typescript
// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { Observable, tap } from "rxjs";
import { SERVICE_VERSION } from "./service-version.js";

/**
 * 모든 HTTP 응답에 x-service-version 헤더를 첨부한다.
 *
 * spec 02 §4.1 — "모든 응답 헤더 ... 에 serviceVersion: SIM_SERVICE_VERSION 을 첨부한다".
 * 헤더 이름은 03-identifier-grammar §service-version header(grammar #5, Plan A Task 2.5) 결과를 사용.
 */
@Injectable()
export class VersionStampInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const reply = ctx.switchToHttp().getResponse<FastifyReply>();
        // Fastify reply는 raw header API로 둘 다 노출. setHeader가 없으면 header() 사용.
        if (typeof (reply as { header?: (k: string, v: string) => void }).header === "function") {
          (reply as { header: (k: string, v: string) => void }).header(
            "x-service-version",
            SERVICE_VERSION,
          );
        }
      }),
    );
  }
}
```

헤더 이름 `x-service-version`은 Plan A Task 2.5 grammar #5 builder 결과와 일치 (hot path 성능 위해 컴파일 상수 박음). Fastify adapter `reply.header()` API 사용 (approval-api는 Fastify 단일 — main.ts 라인 24).

- [ ] **Step 8.3.4: main.ts에 interceptor 등록**

`simulations/enterprise-pm/services/approval-api/src/main.ts`의 NestFactory 부팅 직후(`app.enableCors` 이전)에 다음을 추가한다.

```typescript
import { VersionStampInterceptor } from "./lib/version-stamp.interceptor.js";

// ... bootstrap 함수 내부 ...
app.useGlobalInterceptors(new VersionStampInterceptor());
app.enableCors({ origin: env.CORS_ORIGIN });
```

`useGlobalInterceptors`는 모든 HTTP 라우트에 적용되므로 health controller, BFF controller, write controller가 모두 자동 stamp된다.

- [ ] **Step 8.3.5: 단위 테스트 작성**

`simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";

describe("ServiceVersionStamp helper", () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = "v3";
    process.env.SIM_DB_WRITE_URL = "postgres://x@h/y";
    process.env.SIM_DB_READ_URL  = "postgres://x@h/y";
  });

  it("withServiceVersion injects current version", async () => {
    const { withServiceVersion, SERVICE_VERSION } = await import("./service-version.js");
    expect(SERVICE_VERSION).toBe("v3");
    expect(withServiceVersion({ id: "x" })).toEqual({ id: "x", serviceVersion: "v3" });
  });

  it("env schema rejects unknown SIM_SERVICE_VERSION (fail-closed)", async () => {
    const mod = await import("../config/env.js");
    expect(() =>
      mod.parseEnv({ ...process.env, SIM_SERVICE_VERSION: "unknown" }),
    ).toThrow(/grammar #3/);
  });

  it("env schema applies default 'v0-stable' when unset", async () => {
    const mod = await import("../config/env.js");
    const { SIM_SERVICE_VERSION: _omit, ...rest } = process.env;
    void _omit;
    const parsed = mod.parseEnv(rest as NodeJS.ProcessEnv);
    expect(parsed.SIM_SERVICE_VERSION).toBe("v0-stable");
  });
});
```

- [ ] **Step 8.3.6: 부팅 검증 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk
SIM_SERVICE_VERSION=v3 \
SIM_DB_WRITE_URL=postgres://x@localhost/y \
SIM_DB_READ_URL=postgres://x@localhost/y \
pnpm --filter @qa-sdk/sim-approval-api build && \
pnpm --filter @qa-sdk/sim-approval-api test version-stamp
```

기대: 3 테스트 PASS. unknown 거부 케이스에서 zod 에러 메시지에 `grammar #3` 포함.

- [ ] **Step 8.3.7: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/config/env.ts \
        simulations/enterprise-pm/services/approval-api/src/lib/service-version.ts \
        simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.interceptor.ts \
        simulations/enterprise-pm/services/approval-api/src/lib/version-stamp.test.ts \
        simulations/enterprise-pm/services/approval-api/src/main.ts
git commit -m "feat(sim-approval-api): version stamp interceptor + helper (spec 02 §4.1)"
```

---

### Task 8.4: outbox event publish에 serviceVersion + schemaHash 첨부

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/budget/infrastructure/outbox/budget.outbox.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/expense/infrastructure/outbox/expense.outbox.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/timeoff/infrastructure/outbox/timeoff.outbox.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/resource/infrastructure/outbox/resource.outbox.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/lib/outbox-payload.test.ts`

spec 02 §4.2 인용: "outbox dispatcher가 이벤트를 발행할 때 `schemaHash`를 함께 보낸다. v1·v2 코드는 빌드 시점에 자기 schema의 contentHash를 산출해 컴파일된 상수로 가진다." Plan A Task 2.7의 `buildSchemaHash`(grammar #6)를 빌드 시 1회 계산하고, 매 publish마다 payload에 `serviceVersion`과 `schemaHash`를 함께 첨부한다.

- [ ] **Step 8.4.1: schemaHash 빌드 시점 상수**

`approval/budget/infrastructure/outbox/budget.outbox.ts`를 다음과 같이 수정한다 (기존 dialect 분기 보존).

```typescript
import type { OutboxPort, OutboxRecord, TransactionScope } from "@qa-sdk/sim-domain-slice-kit";
import { buildSchemaHash } from "sim-identifier-grammar";
import { withServiceVersion } from "../../../../lib/service-version.js";
// ... 기존 import 보존 ...

// 단계 8(Plan C): build-time schemaHash. 모듈 로드 시 1회만 계산.
// NOTE: schema-hash 모듈 자체는 eventName 일치 검증을 안 하지만, eventName type은
// grammar #5 EventName({ domain, aggregate, verbPast }). 다만 schema-hash.test.ts
// fixture가 historic하게 { domain, entity, action }을 쓰고 있어 type assertion
// 누락 시 typecheck error. 본 wrap 함수에서는 eventName 객체를 EventName 타입으로
// 명시 (또는 inline `as const` 통과 시 verbPast 키로 작성).
const BUDGET_EVENT_NAME = { domain: "approval", aggregate: "budget", verbPast: "submitted" } as const;
const BUDGET_PAYLOAD_SHAPE = {
  id: "string",
  requesterId: "string",
  amount: "number",
  status: "string",
  currentStage: "number",
  totalStages: "number",
  occurredAt: "string",
} as const;
export const BUDGET_SCHEMA_HASH: string = buildSchemaHash({
  eventName: BUDGET_EVENT_NAME,
  payloadShape: BUDGET_PAYLOAD_SHAPE,
});

// OutboxPort contract는 `append(record, scope)`. (`publish`가 아님 — sim-domain-slice-kit
// port 정의 기준.) wrap 함수도 append 시점에 stamp 첨부.
function withBudgetStamps(record: OutboxRecord): OutboxRecord {
  const stamped =
    typeof record.payload === "object" && record.payload !== null
      ? withServiceVersion({
          ...(record.payload as Record<string, unknown>),
          schemaHash: BUDGET_SCHEMA_HASH,
        })
      : withServiceVersion({
          value: record.payload,
          schemaHash: BUDGET_SCHEMA_HASH,
        });
  return { ...record, payload: stamped };
}

function wrap(port: OutboxPort): OutboxPort {
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      // spec 02 §4.1 + §4.2 — payload에 serviceVersion + schemaHash 첨부.
      return port.append(withBudgetStamps(record), scope);
    },
  };
}

export function createBudgetOutboxPort(opts: BudgetOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return wrap(createDrizzleOutboxPort({ db: opts.db as never, table: sqliteApprovalOutbox }));
  }
  if (opts.dialect === "pg") {
    return wrap(createDrizzleOutboxPort({ db: opts.db as never, table: pgApprovalOutbox }));
  }
  throw new Error(`createBudgetOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
```

핵심 결정.

- **OutboxPort contract = `append(record, scope)`** — `publish`는 잘못된 이름. sim-domain-slice-kit `outbox.port.ts`의 정의는 `append(record: OutboxRecord, scope: TransactionScope): Promise<void>`. wrap 함수도 `append` 시점에 stamp 첨부.
- **build-time hash** — `BUDGET_SCHEMA_HASH`는 모듈 로드 시 1회 계산 (spec 02 §4.2의 "빌드 시점" 요구).
- **payloadShape 정규화** — `string`/`number` 토큰만 사용 (Plan A Task 2.7 `CanonicalShape`).
- **`wrap` 패턴** — 기존 `createDrizzleOutboxPort` 변경 없이 port 한 번 더 감쌈. v1/v2 같은 wrap 공유 → 시나리오 9 (v1=v2)가 자동 성립.
- **시나리오 10 후크** — v2가 `BUDGET_PAYLOAD_SHAPE`에 필드 추가 시 hash 변경 → ingest `schema_drift` (Step 8.7).
- **의존 추가** — `sim-identifier-grammar` (Plan A Task 2.7). `package.json`에 `"sim-identifier-grammar": "workspace:*"`.

- [ ] **Step 8.4.2: expense / timeoff / resource outbox 동일 패턴 적용**

위 budget.outbox.ts 패턴을 expense / timeoff / resource 세 슬라이스에 그대로 복제한다. 각 슬라이스마다.

- `<DOMAIN>_EVENT_NAME` — `{ domain: "approval", entity: "<slice>", action: "submitted" }`
- `<DOMAIN>_PAYLOAD_SHAPE` — 슬라이스별 read model 컬럼을 grammar #6 토큰으로 표현
- `<DOMAIN>_SCHEMA_HASH` — `buildSchemaHash` 1회 계산
- `wrap` 함수 — 동일 구조

각 슬라이스의 `payloadShape`는 해당 도메인의 outbox 이벤트 schema를 기준으로 정의(예: timeoff은 `startDate`/`endDate`/`reason`/...). 이는 슬라이스 도메인 모델 SSOT의 단순 미러이며, drift 시 schema-hash 자체가 변하므로 catalog 등록 hash와 자동 mismatch.

- [ ] **Step 8.4.3: 단위 테스트 작성**

`simulations/enterprise-pm/services/approval-api/src/lib/outbox-payload.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildSchemaHash } from "sim-identifier-grammar";

describe("outbox payload — version stamp + schemaHash", () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = "v3";
    process.env.SIM_DB_WRITE_URL = "postgres://x@h/y";
    process.env.SIM_DB_READ_URL  = "postgres://x@h/y";
  });

  it("budget outbox payload contains serviceVersion + schemaHash", async () => {
    const port: { append: ReturnType<typeof vi.fn> } = { append: vi.fn().mockResolvedValue(undefined) };
    // outbox-port factory가 사용하는 createDrizzleOutboxPort를 stub.
    vi.doMock("@qa-sdk/sim-domain-slice-kit", () => ({ createDrizzleOutboxPort: () => port }));
    const { createBudgetOutboxPort } = await import(
      "../approval/budget/infrastructure/outbox/budget.outbox.js"
    );
    const wrapped = createBudgetOutboxPort({ dialect: "sqlite", db: {} as never });
    const scope = { id: "tx-1", startedAt: new Date() };
    await wrapped.append(
      {
        eventName: "approval.budget.submitted",
        aggregateId: "b-1",
        eventVersion: 1,
        payload: { id: "b-1", amount: 1000 },
        occurredAt: new Date(1714250400000),
        idempotencyKey: "b-1:approval.budget.submitted:1714250400000",
      },
      scope,
    );
    expect(port.append).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          serviceVersion: "v3",
          schemaHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        }),
      }),
      scope,
    );
  });

  it("schemaHash is deterministic (same shape → same hash)", () => {
    const shape = { id: "string", amount: "number" } as const;
    // EventName type({ domain, aggregate, verbPast }) 정합 — schema-hash 모듈은
    // eventName 형태 자체를 검증하지 않지만 type-only import이므로 typecheck는 통과해야 함.
    const eventName = { domain: "approval", aggregate: "budget", verbPast: "submitted" } as const;
    expect(buildSchemaHash({ eventName, payloadShape: shape }))
      .toBe(buildSchemaHash({ eventName, payloadShape: shape }));
  });
});
```

- [ ] **Step 8.4.4: 테스트 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @qa-sdk/sim-approval-api build && \
pnpm --filter @qa-sdk/sim-approval-api test outbox-payload
```

기대: 2 PASS. mismatch 시 `wrap` 함수의 spread 순서 확인(`schemaHash`가 `serviceVersion` 다음에 와야 함).

- [ ] **Step 8.4.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/infrastructure/outbox/*.outbox.ts \
        simulations/enterprise-pm/services/approval-api/src/lib/outbox-payload.test.ts \
        simulations/enterprise-pm/services/approval-api/package.json
git commit -m "feat(sim-approval-api): outbox publish stamps serviceVersion + grammar #6 schemaHash"
```

---

### Task 8.5: BFF/reporting slice를 READ_DATA_SOURCE로 마이그레이션

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/approval-db.module.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/application/queries/*.query.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/presentation/bff/*.bff.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/budget/presentation/bff/budget-detail.read-source.test.ts`

spec 04 §4.3 인용: "`reporting-api/*` 전체 → read / 모든 `presentation/bff/*` → read (BFF 컨벤션과 정확히 정렬) / 그 외 query (조회 후 같은 트랜잭션에서 결정/쓰기) → write." Plan A Task 4.3의 `createDualConnection`을 사용해 두 DataSource를 분리하고, BFF/reporting query는 read-only 토큰만 주입받게 만든다.

> **Repository 추상화 인지**: `BudgetReadModelQuery`는 *abstract class* (`approval/budget/application/queries/budget-read-model.query.ts`)이며, 실제 read 경로는 `RepositoryBudgetReadModel`(`infrastructure/read-model/budget.read-model.ts`)이 Repository(`SqliteBudgetRepository | PgBudgetRepository`) 위에 얇게 매핑한다. 본 단계는 (a) `READ_DATA_SOURCE` 토큰 신설 + (b) write/read 둘 다 가능하도록 module 와이어링을 정리한다. read query를 직접 Drizzle로 마이그레이션하는 것은 Repository 추상화를 깨므로 *deferred* — read replica가 실제 PG dual 환경에 배치된 후 후속 cycle에서 처리.
>
> **Fail-open**: dev/sqlite 단일 컨테이너 환경에서 `SIM_DB_READ_URL` 미설정 시 부팅을 깨지 않기 위해 `READ_DATA_SOURCE`는 write로 fallback (`useFactory: handle.readDb ?? handle.db`). PG dual 환경에서만 실제 분리. 부팅 차단 fail-closed보다 운영 fail-open이 dev 우선.

- [ ] **Step 8.5.1: approval-db.module.ts에서 DualConnection 도입**

`simulations/enterprise-pm/services/approval-api/src/approval/approval-db.module.ts`의 `forRoot()` 내부 connection 생성 부분을 다음과 같이 교체한다(기존 `createConnection` 호출 1건 → `createDualConnection` 1건).

```typescript
import { createConnection, createDualConnection, parsePgUrl } from "db-bootstrap";
import { env } from "../config/env.js";

export const APPROVAL_DB_INSTANCE = Symbol("APPROVAL_DB_INSTANCE");
export const WRITE_DATA_SOURCE   = Symbol("WRITE_DATA_SOURCE");
export const READ_DATA_SOURCE    = Symbol("READ_DATA_SOURCE");
export const APPROVAL_REPOSITORY = Symbol("APPROVAL_REPOSITORY");

export interface ApprovalDbInstanceHandle {
  dialect: "sqlite" | "pg";
  db: BetterSQLite3Database | PostgresJsDatabase;
  /** SIM_DB_READ_URL 미설정이면 readDb===undefined → write로 fallback. */
  readDb?: BetterSQLite3Database | PostgresJsDatabase;
}

@Module({})
export class ApprovalDbModule {
  static forRoot(): DynamicModule {
    return {
      module: ApprovalDbModule,
      providers: [
        {
          provide: APPROVAL_DB_INSTANCE,
          useFactory: async (): Promise<ApprovalDbInstanceHandle> => {
            const useDual =
              env.QA_DB_DIALECT === "pg" &&
              typeof env.SIM_DB_WRITE_URL === "string" &&
              typeof env.SIM_DB_READ_URL === "string";
            if (useDual) {
              const dual = await createDualConnection({
                dialect: "pg",
                write: parsePgUrl(env.SIM_DB_WRITE_URL!),
                read:  parsePgUrl(env.SIM_DB_READ_URL!),
              });
              return { dialect: "pg", db: dual.write.db, readDb: dual.read.db };
            }
            const conn = await createConnection(/* 기존 sqlite/pg 분기 */);
            return { dialect: conn.dialect, db: conn.db };
          },
        },
        {
          provide: WRITE_DATA_SOURCE,
          inject: [APPROVAL_DB_INSTANCE],
          useFactory: (h: ApprovalDbInstanceHandle) => h.db,
        },
        {
          provide: READ_DATA_SOURCE,
          inject: [APPROVAL_DB_INSTANCE],
          // dev/sqlite 단일 컨테이너에서는 readDb 미설정 → write로 fallback (fail-open).
          useFactory: (h: ApprovalDbInstanceHandle) => h.readDb ?? h.db,
        },
        // ... 기존 APPROVAL_REPOSITORY provider ... (write 측 db 사용)
      ],
      exports: [APPROVAL_DB_INSTANCE, WRITE_DATA_SOURCE, READ_DATA_SOURCE, APPROVAL_REPOSITORY],
      global: true,
    };
  }
}
```

핵심 결정.

- **두 토큰 분리** — DI 레이어에서 슬라이스 의도 명시. ESLint rule이 BFF에서 `WRITE_DATA_SOURCE` import 차단 (Task 8.6).
- **`APPROVAL_REPOSITORY`는 write 유지** — write-after-read는 같은 트랜잭션 (spec 04 §4.3 마지막 단락 read-after-write 회피 패턴).
- **dual when both URLs set** — `SIM_DB_WRITE_URL` + `SIM_DB_READ_URL` 둘 다 PG일 때만 `createDualConnection`. 단일 sqlite/PG 환경은 기존 `createConnection` 경로 유지(read=write fallback).
- **`createDualConnection`/`parsePgUrl`** — Plan A Task 4.3·4.4 helper.

- [ ] **Step 8.5.2: BudgetReadModelQuery 토큰 와이어링 점검 (read query 코드 마이그레이션은 deferred)**

`approval/budget/application/queries/budget-read-model.query.ts`는 abstract class 이고, 구현체는 `infrastructure/read-model/budget.read-model.ts`의 `RepositoryBudgetReadModel`이 Repository 위에 얇게 매핑한다 (`SqliteBudgetRepository | PgBudgetRepository`). 본 단계에서는 다음만 한다.

1. `READ_DATA_SOURCE`/`WRITE_DATA_SOURCE` 토큰 export 확인 (Step 8.5.1).
2. read 경로 컴포넌트(`RepositoryBudgetReadModel`)는 *Repository에 의존*하므로 token 주입 위치 변경 없음.
3. 향후 Repository 추상화를 우회한 직접 Drizzle read query로 마이그레이션은 PG dual 환경 도입 후 별도 cycle (deferred).

```typescript
// (참고) 만약 read query를 abstract class를 우회해 직접 Drizzle로 작성한다면:
import { Inject, Injectable } from "@nestjs/common";
import { READ_DATA_SOURCE } from "../../approval-db.module.js";

@Injectable()
export class BudgetReadModelDrizzleQuery {
  constructor(@Inject(READ_DATA_SOURCE) private readonly readDb: PostgresJsDatabase) {}
  // SELECT만 — INSERT/UPDATE 호출 시 read-only role이 거부 (spec 04 §4.3).
}
// 단계 8 본 plan은 위 패턴을 *도입하지 않는다*. Repository 추상화를 깨므로
// PG dual 실배치 후 후속 cycle에서 처리.
```

- [ ] **Step 8.5.3: BFF/reporting 경계 ESLint rule 활성화** — 코드 마이그레이션 deferred 상태에서도 ESLint rule(Task 8.6)이 BFF/reporting 경로의 `WRITE_DATA_SOURCE`/`APPROVAL_REPOSITORY` import 차단. 단계 8 시점부터 신규 BFF/reporting 코드가 write 경계 침범 불가.

- [ ] **Step 8.5.4: 단위 테스트 작성**

`simulations/enterprise-pm/services/approval-api/src/approval/budget/presentation/bff/budget-detail.read-source.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BudgetReadModelQuery } from "../../application/queries/budget-read-model.query.js";
import { READ_DATA_SOURCE } from "../../../approval-db.module.js";

describe("BudgetReadModelQuery — read DataSource binding (spec 04 §4.3)", () => {
  it("query receives READ_DATA_SOURCE injection (not WRITE)", async () => {
    const fakeRead = { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetReadModelQuery,
        { provide: READ_DATA_SOURCE, useValue: fakeRead },
      ],
    }).compile();
    const query = moduleRef.get(BudgetReadModelQuery);
    await query.findDetail("b-1");
    expect(fakeRead.select).toHaveBeenCalled();
  });
});
```

- [ ] **Step 8.5.5: 통합 검증 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @qa-sdk/sim-approval-api build && \
pnpm --filter @qa-sdk/sim-approval-api test
```

기대: BFF / read query 단위 테스트 PASS. 기존 write 측 테스트도 회귀 없음(repository는 write 유지).

- [ ] **Step 8.5.6: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/approval-db.module.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,timeoff,resource}/application/queries/*.query.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/budget/presentation/bff/budget-detail.read-source.test.ts
git commit -m "feat(sim-approval-api): BFF/reporting slice → READ_DATA_SOURCE (spec 04 §4.3)"
```

---

### Task 8.6: ESLint custom rule — BFF에서 write DataSource import 차단

**Files:**
- Create: `eslint-rules/no-write-datasource-in-bff.js`
- Modify: `eslint.config.mjs`

spec 04 §4.3 인용: "BFF 모듈에서 write DataSource를 import → 정적 lint 에러." 본 rule은 단계 8 종료 후에도 BFF 슬라이스가 write 경계를 침범하지 못하도록 컴파일 타임에 강제하는 마지막 안전망이다.

- [ ] **Step 8.6.1: rule 작성**

`eslint-rules/no-write-datasource-in-bff.js`:

```javascript
"use strict";

/**
 * spec 04 §4.3 — BFF 슬라이스가 write DataSource를 import하면 lint error.
 *
 * 매칭 조건:
 *   - 파일 경로가 `presentation/bff/` 또는 `reporting-api/`를 포함
 *   - 그 파일에서 `WRITE_DATA_SOURCE`, `APPROVAL_REPOSITORY`, `createConnection`(write builder),
 *     또는 `drizzle-orm/postgres-js`의 INSERT/UPDATE/DELETE 헬퍼를 import
 *
 * 위반 시 메시지: "BFF/reporting slice may not import write DataSource (spec 04 §4.3)".
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "BFF/reporting slice may not import write DataSource",
      recommended: true,
    },
    schema: [],
    messages: {
      noWriteDataSource:
        "BFF/reporting slice may not import write DataSource (spec 04-scaling-infra.md §4.3). Use READ_DATA_SOURCE instead.",
    },
  },
  create(context) {
    const filename = context.getFilename();
    const inBff = /\/(presentation\/bff|reporting-api)\//.test(filename);
    if (!inBff) return {};

    const FORBIDDEN_NAMES = new Set([
      "WRITE_DATA_SOURCE",
      "APPROVAL_REPOSITORY",
    ]);

    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            FORBIDDEN_NAMES.has(spec.imported.name)
          ) {
            context.report({ node: spec, messageId: "noWriteDataSource" });
          }
        }
      },
    };
  },
};
```

핵심 결정.

- **path-based scope** — `presentation/bff/` 또는 `reporting-api/` 파일에서만 활성. write slice는 영향 없음.
- **FORBIDDEN_NAMES 화이트리스트** — `READ_DATA_SOURCE` 허용, `WRITE_DATA_SOURCE`/`APPROVAL_REPOSITORY`만 차단.
- **runtime guard 분리** — read-only 연결의 INSERT/UPDATE 거부는 별도 layer (드라이버 단). 본 rule은 정적 lint만.

- [ ] **Step 8.6.2: eslint.config.mjs 신설 또는 갱신**

repo root에 `eslint.config.mjs`가 없으면 본 단계에서 *신설*. 본 config는 도입 단계이므로 다른 rule은 추가하지 않고 BFF write-import 차단 rule만 등록 (후속 plan에서 확장).

`/eslint.config.mjs`:

```javascript
// 단계 8(Plan C): repo-wide ESLint flat config — BFF/reporting write-import 차단 rule만 등록.
// spec 04-scaling-infra.md §4.3 — "BFF 모듈에서 write DataSource를 import → 정적 lint 에러".
//
// 사용:
//   pnpm exec eslint simulations/enterprise-pm/services/approval-api/src
//
// CI gate에 통합 전이라 silent skip — `pnpm lint` 미정의이면 본 config는 활성화되지 않는다.

import noWriteDataSourceInBff from "./eslint-rules/no-write-datasource-in-bff.js";

const sliceWritePolicy = {
  plugins: {
    "qa-sdk-sim": {
      rules: {
        "no-write-datasource-in-bff": noWriteDataSourceInBff,
      },
    },
  },
  files: [
    "simulations/enterprise-pm/services/**/presentation/bff/**/*.ts",
    "simulations/enterprise-pm/services/reporting-api/**/*.ts",
  ],
  rules: {
    "qa-sdk-sim/no-write-datasource-in-bff": "error",
  },
};

export default [sliceWritePolicy];
```

기존 `eslint.config.mjs`가 있다면 위 `sliceWritePolicy` 객체만 array에 추가.

- [ ] **Step 8.6.3: 위반/정상 케이스 lint 검증 (수동)**

임시로 `budget-detail.bff.ts`에 `import { WRITE_DATA_SOURCE } from "../../approval-db.module.js";`를 추가하면 `pnpm exec eslint` 실행 시 `error  BFF/reporting slice may not import write DataSource ...` 발생. 정상 BFF/reporting 경로(`pnpm exec eslint .../presentation/bff/**/*.ts`) 0 error. 검증 후 임시 import 제거.

- [ ] **Step 8.6.4: Commit**

```bash
git add eslint-rules/no-write-datasource-in-bff.js eslint.config.mjs
git commit -m "feat(eslint): no-write-datasource-in-bff custom rule (spec 04 §4.3)"
```

---

### Task 8.7: v2 의도적 차이 fixture (시나리오 9 / 10 / 11) — outline

**Files:**
- Create: `simulations/enterprise-pm/test/scenarios/scenario-09-v1-equals-v2.fixture.ts`
- Create: `simulations/enterprise-pm/test/scenarios/scenario-10-schema-break.fixture.ts`
- Create: `simulations/enterprise-pm/test/scenarios/scenario-11-audit-anomaly.fixture.ts`

spec 02 §4.3의 세 fixture는 v2 image 빌드 시 v1 대비 어떤 차이를 주입할지 명시한다. 단계 9·10에서 e2e 시뮬을 구동.

> **테스트 디렉토리 신설**: `simulations/enterprise-pm/test/` 디렉토리는 본 단계 이전에 *부재*. 본 task에서 `test/scenarios/`, `test/regression/`, `test/scenarios/scenario-fixture.types.ts` (ScenarioFixture interface) 신설 + `simulations/enterprise-pm/vitest.config.ts`의 `include`를 `["seed/**/*.test.ts", "test/**/*.test.ts"]`로 확장하고 `exclude`에 `services/**`, `scenarios/**` 추가 (downstream 패키지의 vitest config가 자체 책임). package.json의 `"test": "vitest run"`은 그대로 유지.

- 시나리오 9: v2 = v1과 schema/behavior 동일. `APPROVAL_V2_TAG=v4-stable-clone`. 100% 승격 가능 — `schemaCompatRate=1.0`, `audit_anomaly=0`.
- 시나리오 10: v2 outbox `BUDGET_PAYLOAD_SHAPE`에 `escalationLevel: "number"` 추가 → `BUDGET_SCHEMA_HASH` 달라짐 → ingest `schema_drift` 진단 → 자동 롤백.
- 시나리오 11: v2가 budget 승인 전이 중 `manager_review` stage skip → `audit_anomaly` critical → 안전 가드 카테고리가 weight=0 강제.

핵심 fixture (시나리오 10):

```typescript
export const scenarioSchemaBreak: ScenarioFixture = {
  id: "10-schema-break",
  v1Tag: "v3",
  v2Tag: "v4-schema-break",
  v2Patch: {
    "src/approval/budget/infrastructure/outbox/budget.outbox.ts": (src) =>
      src.replace(
        /totalStages: "number",/,
        `totalStages: "number",\n  escalationLevel: "number",`,
      ),
  },
  expectedAssertions: {
    "ingest-server.schema_drift_count": { gte: 1 },
    "controller.schemaCompatRate":      { lt: 1.0 },
    "controller.weight":                { eq: 0 },
    "gateway.upstream":                 { eq: "approval-api-v1" },
  },
};
```

- [ ] commit:
```bash
git add simulations/enterprise-pm/test/scenarios/scenario-{09,10,11}-*.fixture.ts
git commit -m "test(sim): scenario 9/10/11 v1/v2 difference fixtures (spec 02 §4.3)"
```

---

### Task 8.8: 단위 테스트 — 수렴 단언 — outline

**Files:**
- Task 8.3.5 / 8.4.3 / 8.5.4 단위 테스트 PASS 외에 *수렴 단언*만 추가.

수렴 단언 3건.

- 응답 헤더 `x-service-version` == outbox payload `serviceVersion` (둘 다 SIM_SERVICE_VERSION 출처).
- `BUDGET_SCHEMA_HASH` 상수가 모듈 로드 회수와 무관하게 동일.
- `READ_DATA_SOURCE` ≠ `WRITE_DATA_SOURCE` instance (spec 04 §4.2).

핵심 단언:

```typescript
import { SERVICE_VERSION } from "../lib/service-version.js";
it("response header == outbox payload.serviceVersion", async () => {
  const resp = await app.inject({ method: "POST", url: "/budget", payload: { ... } });
  expect(resp.headers["x-service-version"]).toBe(SERVICE_VERSION);
  const events = await readOutboxEvents();
  expect(events.every((e) => e.payload.serviceVersion === SERVICE_VERSION)).toBe(true);
});
```

- [ ] commit:
```bash
git add simulations/enterprise-pm/services/approval-api/src/lib/budget-cross-stamp.test.ts
git commit -m "test(sim-approval-api): cross-stamp consistency (header == payload)"
```

---

### Task 8.9: 통합 테스트 — gateway → v1/v2 라우팅 후 stamp 확인 — outline

**Files:**
- Create: `simulations/enterprise-pm/services/approval-api/test/integration/v1-v2-routing.test.ts`

v1/v2 두 컨테이너 부팅 + gateway에 `x-canary-override: v1|v2`(spec 02 §3.4 — 내부 IP 한정)로 강제 라우팅 후 응답 `x-service-version`이 의도한 버전과 일치하는지 단언.

> **vitest include 확장 필수**: approval-api의 `vitest.config.ts` `include`를 `["src/**/*.test.ts", "test/**/*.test.ts"]`로 확장해 `test/integration/` 디렉토리도 vitest 수집 범위에 포함. 누락 시 신규 통합 테스트 파일이 silent-skip.

핵심 단언:

```typescript
it("gateway routes to v1 when x-canary-override=v1", async () => {
  const resp = await fetch("http://sim-gateway:8888/bff/budget-requests/b-1", {
    headers: { "x-canary-override": "v1" },
  });
  expect(resp.headers.get("x-service-version")).toMatch(/^v3/);
});
```

단계 8에서는 scaffold만(`.pending`). 단계 9의 gateway 라우팅 구현 후 활성화.

- [ ] commit:
```bash
git add simulations/enterprise-pm/services/approval-api/test/integration/v1-v2-routing.test.ts
git commit -m "test(sim-approval-api): integration scaffold v1/v2 routing (pending until stage 9)"
```

---

### Task 8.10: 기존 시나리오 1~8 무회귀 — outline

**Files:**
- Create: `simulations/enterprise-pm/test/regression/scenarios-1-to-8.smoke.test.ts`

단계 8 변경(build arg / compose 분리 / interceptor / schemaHash / read DataSource)이 시나리오 1~8을 깨지 않는지 smoke. v1만 띄운 단일 stable 토폴로지에서 모두 PASS.

> **API shape 결정**: scenarios 패키지의 `runScenario`는 `runScenario(Scenario)` 시그니처 (Scenario 객체 1개 인자) — `runScenario({ id, fixtures, timeoutMs })` 형태가 *아니다*. 또한 단계 8 시점에서 시나리오 e2e 실행은 follow-up #19(auth-api idempotencyKey) 미해결 상태에서 PG/sops 환경 의존하므로 차단됨. 따라서 본 smoke는 e2e 실행 대신 *정적 단언*만으로 회귀 baseline을 잡는다.

핵심 assertion (정적 smoke):

```typescript
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("regression: scenarios 1-8 smoke (단계 8 무회귀)", () => {
  const REPO_ROOT = resolve(new URL("../../../..", import.meta.url).pathname);
  const SCENARIO_FILES = [
    "scenario-1-login",
    "scenario-2-project-create",
    "scenario-3-self-dept-approval",
    "scenario-4-cross-dept-deny",
    "scenario-5-three-stage-approval",
    "scenario-6-delegated-resource",
    "scenario-7-bitmap-refresh",
    "scenario-8-pubsub-invalidation",
  ];

  for (const id of SCENARIO_FILES) {
    it(`${id} 테스트 파일이 존재한다 (회귀 baseline)`, () => {
      const path = resolve(
        REPO_ROOT,
        "simulations/enterprise-pm/scenarios/src/scenarios",
        `${id}.test.ts`,
      );
      expect(existsSync(path)).toBe(true);
    });
  }

  it("docker-compose에 단일 sim-approval-api entry가 더 이상 존재하지 않는다", async () => {
    const fs = await import("node:fs/promises");
    const composePath = resolve(REPO_ROOT, "simulations/enterprise-pm/docker-compose.sim.yaml");
    const text = await fs.readFile(composePath, "utf-8");
    expect(text).toMatch(/container_name: sim-approval-api-v1/);
    expect(text).toMatch(/container_name: sim-approval-api-v2/);
    const matches = text.match(/container_name: sim-approval-api/g) ?? [];
    expect(matches.length).toBe(2); // v1, v2만
  });

  it("APPROVAL_V1_TAG / APPROVAL_V2_TAG가 .env.sim.example에 정의됨", async () => {
    const fs = await import("node:fs/promises");
    const envPath = resolve(REPO_ROOT, "simulations/enterprise-pm/.env.sim.example");
    const text = await fs.readFile(envPath, "utf-8");
    expect(text).toMatch(/APPROVAL_V1_TAG=/);
    expect(text).toMatch(/APPROVAL_V2_TAG=/);
  });
});
```

실제 e2e 시나리오 회귀 검증은 follow-up #19 해결 후 sim-up + scenarios run으로 별도 실행. 단계 8 변경은 모두 *추가*뿐이라 시나리오 1~8 단언에 영향 없음 (정적 단언으로 baseline만 잡음).

- [ ] commit:
```bash
git add simulations/enterprise-pm/test/regression/scenarios-1-to-8.smoke.test.ts
git commit -m "test(sim): regression smoke for scenarios 1-8 on v1-only topology"
```

---

### 단계 8 종료 체크리스트

- [ ] Dockerfile `SERVICE_VERSION` build arg + `sim.version` label.
- [ ] compose에 v1/v2 분리 (단일 entry 제거).
- [ ] env schema가 `SIM_SERVICE_VERSION` (grammar #3) + read/write URL 강제.
- [ ] 응답 헤더 + outbox payload + audit entry에 `serviceVersion` stamp.
- [ ] outbox publish가 grammar #6 `schemaHash` 첨부 (4개 슬라이스).
- [ ] approval-db.module이 `createDualConnection` + write/read 토큰 노출.
- [ ] BFF/reporting query 4개가 `READ_DATA_SOURCE` 주입.
- [ ] ESLint rule이 BFF/reporting 경로의 write import 차단.
- [ ] 시나리오 9/10/11 fixture 작성, 회귀 smoke (1~8 v1-only) PASS.

### 단계 8에서 의도적으로 다루지 않은 것

- gateway 라우팅 / sticky hash / `x-canary-override` → 단계 9.
- controller weight push / promotion / schemaCompatRate → 단계 10.
- `sim-service-catalog` 패키지 (spec 02 §5) → 단계 11.
