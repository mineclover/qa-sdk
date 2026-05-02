# Plan 09c — docker-compose.sim.yaml + Dockerfile.service + sim-up/down

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시뮬 9개 NestJS 서비스 + 1 sim-redis를 부팅하는 docker-compose 파일과 NestJS 공통 Dockerfile, 그리고 사람이 사용할 sim-up/sim-down 부팅 스크립트를 만든다. 9 NestJS 서비스 코드 자체는 Plan 10에서 추가하므로 본 plan에서는 build context와 placeholder Dockerfile만 정의 — sim-redis는 즉시 동작하지만 NestJS 서비스는 `pnpm sim:up` 시 build 단계에서 실패하지 않도록 minimal stub `Dockerfile.service`를 사용한다.

**Architecture:**
- `docker-compose.sim.yaml`: 10 서비스 (1 redis + 9 NestJS). 각 NestJS 서비스는 `services/<name>/` build context.
- 외부 네트워크: `qa-sdk-net` (Plan 04 시리즈가 만들 본체 네트워크). 본 plan에서 external network로 참조 → qa-sdk-db (5434), ingest-server (3200) 직접 접근 가능.
- `Dockerfile.service`: Node 22 + pnpm 10 + NestJS — 9 서비스 공통. build arg `SERVICE_NAME`로 services 폴더 안의 단일 NestJS 패키지를 빌드.
- `sim-up.sh` / `sim-down.sh`: 사람이 직접 호출. up은 의존 컨테이너 healthcheck까지 대기.

**Tech Stack:**
- Docker Compose v3.9+
- Node 22-alpine (qa-sdk monorepo `engines.node` 일치)
- pnpm 10 (corepack)
- redis:7-alpine

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/docker-compose.sim.yaml` | 10 서비스 (1 redis + 9 NestJS placeholder) + external network 참조 |
| `simulations/enterprise-pm/Dockerfile.service` | NestJS 공통 Dockerfile — Node 22 + pnpm + workspace mount |
| `simulations/enterprise-pm/.dockerignore` | dist/, node_modules/, .env.sim 제외 |
| `simulations/enterprise-pm/scripts/sim-up.sh` | 시뮬 + 의존 본체 컨테이너 부팅 + healthcheck 대기 |
| `simulations/enterprise-pm/scripts/sim-down.sh` | 시뮬만 종료 (본체는 유지) |
| `simulations/enterprise-pm/services/.placeholder/Dockerfile` | Plan 10 전 build 단계가 실패하지 않도록 noop Dockerfile (build 컨텍스트 검증용) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/infra-engine/docker-compose.infra.yaml` | `networks` 블록 추가 (qa-sdk-net) — 본체와 시뮬이 같은 네트워크 공유 |

---

## Task 0: baseline 검증

- [ ] **Step 1: Plan 09a (workspace) + Plan 09b (sim schema) 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/package.json && \
  grep -c "sim_app" packages/infra-engine/init/qa-sdk-db.sql && \
  grep -c "sim-gateway" packages/core/src/lib/service-ports.ts
```

Expected: 모두 hit (각각 1, 3+, 1). 없으면 09a/09b 선행 필요.

- [ ] **Step 2: Docker daemon 동작 확인**

```bash
docker version 2>&1 | head -10
```

Expected: Docker Engine 24+ 응답.

- [ ] **Step 3: 충돌 컨테이너명 확인**

```bash
docker ps -a --format "{{.Names}}" 2>&1 | grep -E "^sim-" | head -5
```

Expected: empty (sim-* prefix 컨테이너 없음). 있으면 충돌 — 다른 시뮬과 의논.

- [ ] **Step 4: 본체 네트워크 현재 상태**

```bash
docker network ls | grep -E "(qa-sdk|infra-engine)" | head -5
```

기록: 현재 docker-compose.infra.yaml은 default network만 사용 (`infra-engine_default`). 본 plan은 명시적 `qa-sdk-net` network 추가 → 시뮬 시 external 참조.

---

## Task 1: docker-compose.infra.yaml에 명시적 네트워크 추가

**Files:**
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

시뮬이 본체 컨테이너(qa-sdk-db, ingest-server)와 통신하려면 명시적 공유 network 필요. `default` network는 compose project 별로 격리되므로 부적합.

- [ ] **Step 1: networks 블록 추가**

`packages/infra-engine/docker-compose.infra.yaml` 마지막 `volumes:` 블록 다음에 추가:

```yaml
networks:
  default:
    name: qa-sdk-net
    driver: bridge
```

**근거**: compose의 `default` network 이름을 `qa-sdk-net`로 고정 → 시뮬 compose가 `external: true`로 참조 가능. 모든 본체 서비스(zitadel-db, qa-sdk-db, minio 등)는 자동으로 이 network에 join.

- [ ] **Step 2: 본체 서비스 연결 확인 (재부팅 필요)**

이미 부팅 중인 컨테이너는 network 변경이 적용되지 않음 → 재부팅 필요:

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml down && \
  docker compose -f docker-compose.infra.yaml up -d qa-sdk-db zitadel-db minio
```

- [ ] **Step 3: network 생성 확인**

```bash
docker network inspect qa-sdk-net 2>&1 | head -20
```

Expected: 네트워크 정보 출력 + qa-sdk-db, zitadel-db, minio 컨테이너 join 상태. 에러 시 `docker compose ps`로 컨테이너 부팅 상태 점검.

- [ ] **Step 4: 컨테이너간 호스트네임 resolve 테스트**

```bash
docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml exec -T qa-sdk-db ping -c 1 zitadel-db 2>&1 | head -3
```

Expected: `1 packets transmitted, 1 received` (ping 성공). alpine은 ping이 기본 포함.

---

## Task 2: `Dockerfile.service` 작성 (NestJS 공통)

**Files:**
- Create: `simulations/enterprise-pm/Dockerfile.service`
- Create: `simulations/enterprise-pm/.dockerignore`
- Create: `simulations/enterprise-pm/services/.placeholder/Dockerfile`

NestJS 9 서비스가 공통으로 사용할 Dockerfile. build arg `SERVICE_NAME`로 빌드 대상 폴더 지정.

- [ ] **Step 1: `Dockerfile.service` 작성**

`simulations/enterprise-pm/Dockerfile.service`:

```dockerfile
# qa-sdk Enterprise PM 시뮬 — NestJS 공통 Dockerfile
# build context는 모노레포 root (/Users/junwoobang/workflow/qa-sdk)
# build arg SERVICE_NAME으로 simulations/enterprise-pm/services/<SERVICE_NAME> 빌드

ARG NODE_VERSION=22-alpine

# ── Stage 1: deps + build ──
FROM node:${NODE_VERSION} AS builder

# pnpm 활성화 (corepack)
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /workspace

# workspace 메타 + 패키지 명세 먼저 복사 (캐시 hit 극대화)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY simulations/enterprise-pm/package.json ./simulations/enterprise-pm/
COPY simulations/enterprise-pm/tsconfig.base.json ./simulations/enterprise-pm/

# 시뮬 서비스 정의는 빌드 시점에만 알 수 있음 → ARG 받아서 그 폴더만 복사
ARG SERVICE_NAME
RUN test -n "$SERVICE_NAME" || (echo "ERROR: SERVICE_NAME build arg required" && exit 1)

# 의존 패키지(qa-sdk core/logger/codec 등) — 시뮬이 import할 가능성 → 전체 packages/ 복사
COPY packages ./packages
COPY simulations/enterprise-pm/services/${SERVICE_NAME} ./simulations/enterprise-pm/services/${SERVICE_NAME}

# 의존 설치 (workspace-aware)
RUN pnpm install --frozen-lockfile --filter "...{./simulations/enterprise-pm/services/${SERVICE_NAME}}"

# 빌드
RUN pnpm --filter "{./simulations/enterprise-pm/services/${SERVICE_NAME}}" build

# ── Stage 2: runtime ──
FROM node:${NODE_VERSION} AS runtime

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

# 빌더 산출물만 복사 (deps는 production install로 재설치 → 이미지 크기 절감)
COPY --from=builder /workspace/simulations/enterprise-pm/services/${SERVICE_NAME}/dist ./dist
COPY --from=builder /workspace/simulations/enterprise-pm/services/${SERVICE_NAME}/package.json ./
COPY --from=builder /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/package.json /workspace/
COPY --from=builder /workspace/packages /workspace/packages

# 런타임 의존만 설치
RUN cd /workspace && pnpm install --prod --frozen-lockfile --filter "{./simulations/enterprise-pm/services/${SERVICE_NAME}}"

# Healthcheck 기본 — NestJS 서비스는 /health 엔드포인트 노출 (Plan 10에서 추가)
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -q -O- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "dist/main.js"]
```

**주의 — Stage 1 의존 복사 전체화**: 시뮬 서비스는 `@qa-sdk/core`, `@qa-sdk/logger`, `weighted-index` 등 다수 패키지를 import. 정확한 dep 목록 추출은 복잡하므로 `packages/` 전체 복사. 캐시 hit는 pnpm-lock.yaml 변경 여부에 의존 (변경 적음).

**주의 — `wget` 의존**: alpine은 기본 wget 포함. 만약 healthcheck 실패 시 `apk add --no-cache curl wget` 추가.

- [ ] **Step 2: `.dockerignore` 작성**

`simulations/enterprise-pm/.dockerignore`:

```
node_modules
**/node_modules
dist
**/dist
.env.sim
.env.sim.local
*.log
.git
coverage
.turbo
docs
tests
e2e
*.test.ts
*.spec.ts
```

build 컨텍스트가 모노레포 root이므로 `node_modules`나 빌드 산출물이 들어가면 이미지 크기·빌드 시간 폭증. 본 `.dockerignore`는 sim 폴더용. 모노레포 root의 `.dockerignore`는 별도 파일이 처리 (있다면).

- [ ] **Step 3: placeholder Dockerfile 작성 (Plan 10 전까지 build 검증용)**

services 폴더가 비어있으면 docker compose가 build 컨텍스트를 찾지 못한다. Plan 10이 9 서비스를 추가하기 전까지 build를 검증할 수 있도록 placeholder를 만든다.

`simulations/enterprise-pm/services/.placeholder/package.json`:

```json
{
  "name": "@qa-sdk-sim/placeholder",
  "version": "0.0.0",
  "private": true,
  "description": "Plan 10 전 build 검증용 placeholder. Plan 10에서 9 NestJS 서비스로 교체됨.",
  "scripts": {
    "build": "echo 'placeholder — no real build'",
    "start": "node -e 'console.log(\"placeholder service. Plan 10에서 NestJS로 교체.\"); setInterval(() => {}, 1000);'"
  }
}
```

`simulations/enterprise-pm/services/.placeholder/Dockerfile`:

```dockerfile
# Plan 10 전 build smoke 검증용 placeholder.
# Plan 10에서 ../<service-name>/Dockerfile 또는 공통 Dockerfile.service로 교체.
FROM node:22-alpine
WORKDIR /app
RUN echo 'console.log("placeholder service alive — Plan 10에서 NestJS로 교체"); setInterval(() => {}, 1000);' > main.js
HEALTHCHECK --interval=10s --timeout=3s CMD true
CMD ["node", "main.js"]
```

- [ ] **Step 4: placeholder build 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && docker build -t sim-placeholder simulations/enterprise-pm/services/.placeholder 2>&1 | tail -5
```

Expected: `Successfully tagged sim-placeholder:latest`. 에러 없음.

---

## Task 3: `docker-compose.sim.yaml` 작성

**Files:**
- Create: `simulations/enterprise-pm/docker-compose.sim.yaml`

10 서비스 정의. 9 NestJS 서비스는 placeholder build context를 사용 → Plan 10에서 services/<name>으로 교체.

- [ ] **Step 1: docker-compose.sim.yaml 작성**

`simulations/enterprise-pm/docker-compose.sim.yaml`:

```yaml
# Enterprise PM 시뮬 — 10 컨테이너 (1 redis + 9 NestJS)
# 외부 network: qa-sdk-net (packages/infra-engine/docker-compose.infra.yaml이 생성)
# 외부 의존: qa-sdk-db (5434), ingest-server (3200, host process)
#
# 사용:
#   bash scripts/sim-up.sh        — 부팅 + healthcheck 대기
#   bash scripts/sim-down.sh      — 종료 (본체 컨테이너 영향 없음)

x-nestjs-common: &nestjs-common
  env_file:
    - .env.sim
  restart: unless-stopped
  depends_on:
    sim-redis:
      condition: service_healthy
  networks:
    - default

x-nestjs-build: &nestjs-build
  # Plan 10 전: services/.placeholder 사용. Plan 10 후: 각 서비스의 Dockerfile.service 사용.
  context: ../..
  dockerfile: simulations/enterprise-pm/services/.placeholder/Dockerfile

services:
  # ── 인프라 ──

  sim-redis:
    image: redis:7-alpine
    container_name: sim-redis
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - sim-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 2s
      retries: 10
      start_period: 5s
    networks:
      - default

  # ── 비즈니스 NestJS 서비스 (4400~4900) ──

  sim-auth-api:
    <<: *nestjs-common
    container_name: sim-auth-api
    build: *nestjs-build
    # Plan 10 후 다음으로 교체:
    # build:
    #   context: ../..
    #   dockerfile: simulations/enterprise-pm/Dockerfile.service
    #   args:
    #     SERVICE_NAME: sim-auth-api
    ports:
      - "4400:4400"
    environment:
      PORT: 4400
      SIM_SERVICE_NAME: sim-auth-api

  sim-pm-api:
    <<: *nestjs-common
    container_name: sim-pm-api
    build: *nestjs-build
    ports:
      - "4500:4500"
    environment:
      PORT: 4500
      SIM_SERVICE_NAME: sim-pm-api

  sim-approval-api:
    <<: *nestjs-common
    container_name: sim-approval-api
    build: *nestjs-build
    ports:
      - "4600:4600"
    environment:
      PORT: 4600
      SIM_SERVICE_NAME: sim-approval-api

  sim-notification-api:
    <<: *nestjs-common
    container_name: sim-notification-api
    build: *nestjs-build
    ports:
      - "4700:4700"
    environment:
      PORT: 4700
      SIM_SERVICE_NAME: sim-notification-api

  sim-reporting-api:
    <<: *nestjs-common
    container_name: sim-reporting-api
    build: *nestjs-build
    ports:
      - "4800:4800"
    environment:
      PORT: 4800
      SIM_SERVICE_NAME: sim-reporting-api

  sim-document-api:
    <<: *nestjs-common
    container_name: sim-document-api
    build: *nestjs-build
    ports:
      - "4900:4900"
    environment:
      PORT: 4900
      SIM_SERVICE_NAME: sim-document-api

  # ── 시뮬 인프라 (5100, 5200, 8888) ──

  sim-audit-browser-api:
    <<: *nestjs-common
    container_name: sim-audit-browser-api
    build: *nestjs-build
    ports:
      - "5100:5100"
    environment:
      PORT: 5100
      SIM_SERVICE_NAME: sim-audit-browser-api

  sim-metrics-collector:
    <<: *nestjs-common
    container_name: sim-metrics-collector
    build: *nestjs-build
    ports:
      - "5200:5200"
    environment:
      PORT: 5200
      SIM_SERVICE_NAME: sim-metrics-collector

  sim-gateway:
    <<: *nestjs-common
    container_name: sim-gateway
    build: *nestjs-build
    ports:
      - "8888:8888"
    environment:
      PORT: 8888
      SIM_SERVICE_NAME: sim-gateway
    depends_on:
      sim-redis:
        condition: service_healthy
      sim-auth-api:
        condition: service_started
      sim-pm-api:
        condition: service_started
      sim-approval-api:
        condition: service_started
      sim-notification-api:
        condition: service_started
      sim-reporting-api:
        condition: service_started
      sim-document-api:
        condition: service_started

volumes:
  sim-redis-data:

networks:
  default:
    name: qa-sdk-net
    external: true
```

**근거 — `external: true`**: Task 1로 본체가 만든 `qa-sdk-net` network 참조. 본체와 시뮬이 같은 network에 join → `sim-pm-api`에서 `qa-sdk-db:5432`로 직접 접근 가능 (host port 5434 거치지 않음).

**근거 — depends_on `service_started` (gateway)**: 9 NestJS 서비스가 health 상태가 되기까지 기다릴 필요는 없음 (gateway는 부팅 후 라우팅 시도, 일부 down 상태도 graceful degradation). `service_healthy`는 sim-redis만.

**주의 — placeholder build context**: Plan 10이 각 서비스 폴더를 만들면 `*nestjs-build` anchor를 갱신:
```yaml
x-nestjs-build: &nestjs-build
  context: ../..
  dockerfile: simulations/enterprise-pm/Dockerfile.service
```
+ 각 서비스의 build에 `args: SERVICE_NAME: sim-auth-api` 등 추가. 본 plan은 Plan 10 전 부팅 가능 보장만.

- [ ] **Step 2: docker-compose 문법 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  docker compose -f docker-compose.sim.yaml config 2>&1 | head -30
```

Expected: 전체 compose가 valid YAML로 출력. 에러 없음.

만약 `network qa-sdk-net not found` → Task 1 Step 2의 본체 재부팅이 안 됨 → 본체 docker compose up 후 재시도.

---

## Task 4: `sim-up.sh` / `sim-down.sh` 작성

**Files:**
- Create: `simulations/enterprise-pm/scripts/sim-up.sh`
- Create: `simulations/enterprise-pm/scripts/sim-down.sh`

- [ ] **Step 1: `sim-up.sh` 작성**

`simulations/enterprise-pm/scripts/sim-up.sh`:

```bash
#!/usr/bin/env bash
# Enterprise PM 시뮬 부팅 — 본체 의존 점검 + 시뮬 컨테이너 up + healthcheck 대기
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$SIM_DIR/../../packages/infra-engine"

cd "$SIM_DIR"

echo "==> 1/4 본체 인프라 점검 (qa-sdk-db + qa-sdk-net)"

if ! docker network inspect qa-sdk-net >/dev/null 2>&1; then
  echo "  ⚠ qa-sdk-net network 미존재 — 본체 인프라 부팅 필요"
  echo "  실행: cd $INFRA_DIR && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db"
  exit 1
fi

if ! docker compose -f "$INFRA_DIR/docker-compose.infra.yaml" ps qa-sdk-db --format json 2>/dev/null | jq -e '.Health == "healthy"' >/dev/null; then
  echo "  ⚠ qa-sdk-db unhealthy — 부팅 또는 healthcheck 대기 필요"
  echo "  실행: cd $INFRA_DIR && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && sleep 15"
  exit 1
fi

echo "  → qa-sdk-net + qa-sdk-db 정상"

echo "==> 2/4 .env.sim 점검"
if [[ ! -f "$SIM_DIR/.env.sim" ]]; then
  echo "  ⚠ .env.sim 미존재 — Plan 09d 참조 (sops decrypt .env.sim.enc > .env.sim)"
  exit 1
fi
echo "  → .env.sim 존재"

echo "==> 3/4 시뮬 컨테이너 부팅"
docker compose -f docker-compose.sim.yaml up -d --build

echo "==> 4/4 healthcheck 대기 (최대 90초)"
SERVICES=(sim-redis sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-metrics-collector sim-gateway)
for i in $(seq 1 18); do
  unhealthy=()
  for svc in "${SERVICES[@]}"; do
    status=$(docker compose -f docker-compose.sim.yaml ps --format json $svc 2>/dev/null | jq -r '.Health // .State // "unknown"' 2>/dev/null || echo "unknown")
    if [[ "$status" != "healthy" && "$status" != "running" ]]; then
      unhealthy+=("$svc=$status")
    fi
  done
  if [[ ${#unhealthy[@]} -eq 0 ]]; then
    echo "  → 10/10 서비스 healthy/running"
    break
  fi
  echo "  대기 ${i}/18 — pending: ${unhealthy[*]}"
  sleep 5
done

if [[ ${#unhealthy[@]} -gt 0 ]]; then
  echo ""
  echo "⚠ 일부 서비스가 healthy 상태에 도달하지 못함:"
  printf '  - %s\n' "${unhealthy[@]}"
  echo ""
  echo "Plan 10 전까지는 placeholder Dockerfile이 사용되어 /health 엔드포인트가 없습니다."
  echo "이 단계에서는 'running' 상태만 확인하면 정상입니다."
fi

echo ""
echo "✓ 시뮬 부팅 완료"
echo ""
echo "다음 단계:"
echo "  pnpm sim:ps       — 컨테이너 상태"
echo "  pnpm sim:logs     — 통합 로그"
echo "  pnpm sim:seed     — seed 데이터 적용 (Plan 09d 완료 후)"
echo "  pnpm sim:scenario — 시나리오 실행 (Plan 13 완료 후)"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-up.sh
```

- [ ] **Step 2: `sim-down.sh` 작성**

`simulations/enterprise-pm/scripts/sim-down.sh`:

```bash
#!/usr/bin/env bash
# Enterprise PM 시뮬 종료 — 시뮬 컨테이너만 제거 (본체 컨테이너는 유지)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SIM_DIR"

REMOVE_VOLUMES="${1:-}"

echo "==> 시뮬 컨테이너 종료"
if [[ "$REMOVE_VOLUMES" == "--volumes" || "$REMOVE_VOLUMES" == "-v" ]]; then
  echo "  ⚠ --volumes 지정됨 — sim-redis-data 삭제"
  docker compose -f docker-compose.sim.yaml down --volumes --remove-orphans
else
  docker compose -f docker-compose.sim.yaml down --remove-orphans
fi

echo ""
echo "✓ 시뮬 종료 완료"
echo "본체 컨테이너(qa-sdk-db, ingest-server)는 유지됩니다."
echo "본체 종료: cd ../../packages/infra-engine && docker compose -f docker-compose.infra.yaml down"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-down.sh
```

- [ ] **Step 3: 스크립트 lint (shellcheck)**

```bash
docker run --rm -v /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts:/sh:ro koalaman/shellcheck:stable /sh/sim-up.sh /sh/sim-down.sh 2>&1 | head -30
```

Expected: warning 없음 또는 minor warning (SC2034 등). error 없음.

shellcheck 미설치 환경: 직접 `bash -n`으로 syntax 검증:
```bash
bash -n /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-up.sh
bash -n /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-down.sh
```

Expected: 출력 없음 (syntax OK).

---

## Task 5: 통합 부팅 검증

**Files:**
- 변경 없음 (실행만)

placeholder Dockerfile만으로 sim-redis + 9 placeholder NestJS가 정상 부팅하는지 검증.

- [ ] **Step 1: 본체 인프라 부팅 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && sleep 15
```

Expected: qa-sdk-db healthy.

- [ ] **Step 2: .env.sim placeholder 생성 (Plan 09d 전 통합 검증용)**

```bash
cat > /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/.env.sim <<'EOF'
# Plan 09c 통합 검증용 placeholder — Plan 09d에서 정식 sops 암호화 적용
QA_DB_DIALECT=pg
QA_PG_HOST=qa-sdk-db
QA_PG_PORT=5432
QA_PG_DATABASE=qa_sdk
QA_PG_USER=sim_app
QA_PG_PASSWORD=PLACEHOLDER_REPLACED_BY_PLAN_09D
QA_PG_SCHEMA=sim
SIM_REDIS_URL=redis://sim-redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
QA_INGEST_URL=http://host.docker.internal:3200
EOF
```

**주의**: 이 placeholder는 Plan 09d 완료 후 삭제. .gitignore가 .env.sim을 차단하므로 커밋 위험 없음.

- [ ] **Step 3: 시뮬 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && bash scripts/sim-up.sh 2>&1 | tail -20
```

Expected:
- `qa-sdk-net + qa-sdk-db 정상`
- `.env.sim 존재`
- `시뮬 컨테이너 부팅` → 10 서비스 build + up
- healthcheck 대기 → sim-redis healthy + 9 placeholder running
- `시뮬 부팅 완료`

build 시간이 길 수 있음 (placeholder는 빠름, Plan 10 후 NestJS 실제 build는 느림).

- [ ] **Step 4: 컨테이너 상태 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && docker compose -f docker-compose.sim.yaml ps 2>&1 | head -15
```

Expected: 10 서비스 모두 `Up` 상태. sim-redis는 `(healthy)`, 9 placeholder는 `(health: starting)` 또는 그냥 `Up` (placeholder Dockerfile은 `HEALTHCHECK CMD true`).

- [ ] **Step 5: sim-redis 통신 검증**

```bash
docker exec -i sim-redis redis-cli ping 2>&1
```

Expected: `PONG`.

- [ ] **Step 6: sim-redis ↔ 본체 network 검증**

```bash
docker exec -i sim-redis sh -c "nc -z qa-sdk-db 5432 && echo 'qa-sdk-db reachable'"
```

Expected: `qa-sdk-db reachable`. nc 미포함이면:
```bash
docker exec -i sim-redis sh -c "redis-cli -h qa-sdk-db -p 5432 ping 2>&1 | head -3"
```
이 경우 `wrong protocol` 정도 응답 (ping은 실패하지만 TCP 연결은 됨 = network OK).

- [ ] **Step 7: 정리**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && bash scripts/sim-down.sh --volumes 2>&1 | tail -5 && rm -f .env.sim
```

Expected: 10 컨테이너 stop + remove. .env.sim placeholder 제거.

---

## Task 6: 회귀 점검

- [ ] **Step 1: 본체 docker-compose.infra.yaml 영향 없음**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml config 2>&1 | tail -10
```

Expected: 전체 compose valid. networks 블록 추가가 기존 service에 영향 없음.

- [ ] **Step 2: 본체 컨테이너 정상 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d zitadel-db minio qa-sdk-db && sleep 10 && docker compose -f docker-compose.infra.yaml ps
```

Expected: 3 서비스 healthy.

- [ ] **Step 3: workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | grep -E "(passed|failed)" | tail -3
```

Expected: 통과 유지.

- [ ] **Step 4: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -5
```

Expected: errors=0 유지.

---

## Self-Review

- [ ] `docker-compose.infra.yaml`에 `networks.default.name: qa-sdk-net` 추가
- [ ] `simulations/enterprise-pm/docker-compose.sim.yaml` — 10 서비스 (1 redis + 9 placeholder)
- [ ] `Dockerfile.service` — Node 22 + pnpm + workspace-aware build (Plan 10에서 SERVICE_NAME 주입)
- [ ] `services/.placeholder/` — Plan 10 전 build 검증용
- [ ] `.dockerignore` — node_modules/dist/.env.sim 격리
- [ ] `sim-up.sh` — 본체 점검 + 부팅 + healthcheck 대기
- [ ] `sim-down.sh` — 시뮬만 종료 (본체 유지), `--volumes` 옵션
- [ ] 통합 부팅 — sim-redis healthy + 9 placeholder running + qa-sdk-net 통신
- [ ] qa-sdk-net external network 참조 — 본체 컨테이너와 직접 통신
- [ ] 본체 docker-compose 영향 없음

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 9 NestJS 서비스 실제 코드 + Dockerfile.service 활성화 | 서비스 코드는 도메인과 함께 추가 | Plan 10a/b/c |
| build context anchor 갱신 (placeholder → Dockerfile.service) | Plan 10 완료 후 1줄 변경 | Plan 10c 마무리 |
| OTEL collector 컨테이너 | 시뮬은 host의 collector(host.docker.internal:4318) 사용 — 컨테이너 추가 안 함 | (defer 영구) |
| Postgres 시뮬 전용 인스턴스 | 본체 qa-sdk-db의 sim schema 격리로 충분 | (defer 영구) |
| Tempo/Jaeger | OTEL backend는 외부 (qa-sdk monitoring stack) 의존 | (defer 영구) |
| Prometheus scrape config | sim-metrics-collector 자체가 exporter — Prometheus는 host 또는 본체 stack | Plan 14a |

---

## 의존·후속

- **선행**:
  - Plan 09a (workspace 부트스트랩) — `simulations/enterprise-pm/` 디렉토리 + tsconfig.base.json
  - Plan 09b (sim schema + SERVICE_PORTS) — qa-sdk-db에 sim schema 존재 + 9 sim-* 포트 등록
- **병렬 가능**: Plan 09d (.env.sim + seed) — 본 plan은 .env.sim 존재만 가정, 내용은 09d 책임
- **후속**:
  - Plan 09d — .env.sim sops 암호화 + seed runner
  - Plan 10a/b/c — services/<name>/ 추가 + docker-compose.sim.yaml의 build context 활성화
