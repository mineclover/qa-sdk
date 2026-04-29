## 단계 1: host.docker.internal 제거 + ingest 컨테이너화

**Spec 참조:** `04-scaling-infra.md` §6, `06-roadmap.md` §1 단계 1

이 단계는 두 sub-step으로 나뉜다. 1a는 ingest-server를 컨테이너로 띄울 수 있게 만들고, 1b는 시뮬이 host alias 대신 컨테이너 서비스명으로 라우팅하게 바꾼다. 1a 단독 머지 후 1b를 진행하면 점진적 마이그레이션이 안전하다.

### Task 1.1: ingest-server Dockerfile 작성

**Files:**
- Create: `packages/ingest-server/Dockerfile`
- Create: `packages/ingest-server/.dockerignore`

- [ ] **Step 1.1.1: 기존 sim-base.Dockerfile 멀티스테이지 패턴 참조하여 Dockerfile 작성**

ingest-server는 모노레포 workspace 패키지이므로 sim-base.Dockerfile과 동일하게 *모노레포 root 컨텍스트* + builder/runtime 두 단계로 구성한다.

`packages/ingest-server/Dockerfile` 내용:

```dockerfile
# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22-alpine

# ============================================================
# Stage 1: builder — 모노레포 전체 install + ingest-server 빌드
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /workspace

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# workspace 메타 + lockfile (캐시 최적화)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages packages

# ingest-server와 그 의존만 install
RUN pnpm install --frozen-lockfile --filter "...{./packages/ingest-server}"

# ingest-server + 의존 패키지 build
RUN pnpm --filter "...{./packages/ingest-server}" run build

# ============================================================
# Stage 2: runtime — 경량 런타임
# ============================================================
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

RUN apk add --no-cache libc6-compat tini
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

ENV NODE_ENV=production
ENV PORT=3200

# 빌더에서 산출물만 복사
COPY --from=builder /workspace /app

WORKDIR /app/packages/ingest-server

# 런타임 의존만 재설치
RUN pnpm install --prod --frozen-lockfile --filter "...{./}"

EXPOSE 3200

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O- http://localhost:3200/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

- [ ] **Step 1.1.2: .dockerignore 작성**

`packages/ingest-server/.dockerignore` 내용 (이건 컨텍스트가 root 일 때 사용되지 않지만, 향후 packages-only 빌드 가능성을 위해 보존):

```
node_modules
dist
*.log
.env*
coverage
```

- [ ] **Step 1.1.3: 빌드 검증 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk
docker buildx build -f packages/ingest-server/Dockerfile -t qa-sdk/ingest-server:test .
docker run --rm -e PORT=3200 -p 3200:3200 qa-sdk/ingest-server:test &
sleep 8
curl -f http://localhost:3200/health
docker kill $(docker ps -q --filter ancestor=qa-sdk/ingest-server:test)
```

기대: `/health` 응답 200. 실패 시 진입점 경로 또는 build args 점검.

- [ ] **Step 1.1.4: Commit**

```bash
git add packages/ingest-server/Dockerfile packages/ingest-server/.dockerignore
git commit -m "feat(ingest-server): add Dockerfile (multistage builder + runtime)"
```

### Task 1.2: docker-compose에 qa-sdk-ingest service 추가

**Files:**
- Modify: `simulations/enterprise-pm/docker-compose.sim.yaml`

- [ ] **Step 1.2.1: services 블록 끝에 qa-sdk-ingest entry 추가**

`simulations/enterprise-pm/docker-compose.sim.yaml`의 `services:` 마지막에 다음 entry를 추가한다 (정확한 위치는 sim-redis 정의 직전 또는 sim-gateway 다음). compose는 키 순서 무관이지만 `qa-sdk-*`는 시뮬 외부 인프라 표기로 위쪽에 놓는다:

```yaml
  qa-sdk-ingest:
    image: qa-sdk/ingest-server:latest
    build:
      context: ../..
      dockerfile: packages/ingest-server/Dockerfile
    environment:
      PORT: 3200
      STORE_DRIVER: pg
      QA_PG_HOST: qa-sdk-db
      QA_PG_PORT: 5432
      QA_PG_DATABASE: qa_sdk
      QA_PG_USER: ingest_app
      QA_PG_PASSWORD: ${QA_PG_INGEST_PASSWORD}
      QA_PG_SCHEMA: ingest
      REDIS_URL: redis://sim-redis:6379
      CORS_ORIGIN: "*"
      SIM_LOG_LEVEL: info
    ports:
      - "3200:3200"
    networks:
      - default
    depends_on:
      sim-redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:3200/health"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 20s
    restart: unless-stopped
```

- [ ] **Step 1.2.2: docker compose config 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
docker compose -f docker-compose.sim.yaml config | grep -A 2 "qa-sdk-ingest"
```

기대: qa-sdk-ingest service가 정상 파싱되어 출력. 환경변수가 누락되었으면 경고 표시.

- [ ] **Step 1.2.3: Commit**

```bash
git add simulations/enterprise-pm/docker-compose.sim.yaml
git commit -m "feat(sim): add qa-sdk-ingest service entry to compose"
```

### Task 1.3: .env.sim.example에서 host.docker.internal 제거

**Files:**
- Modify: `simulations/enterprise-pm/.env.sim.example`

- [ ] **Step 1.3.1: 두 변수 값을 컨테이너 서비스명으로 교체**

기존 라인 21-22:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
QA_INGEST_URL=http://host.docker.internal:3200
```

다음으로 교체:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://qa-sdk-otel-collector:4318
QA_INGEST_URL=http://qa-sdk-ingest:3200
QA_PG_INGEST_PASSWORD=__from_sops__
```

OTEL collector는 본 plan에서 컨테이너화하지 않는다 — 옵션 컴포넌트이므로 docker-compose에 entry가 있을 때만 의미 있다. plan B 또는 후속 sub-project로 분리.

- [ ] **Step 1.3.2: 사용자에게 .env.sim.enc 재암호화 안내 출력**

```bash
echo ""
echo "======================================================"
echo " .env.sim.enc 재암호화가 필요합니다 (sops 사용자만)."
echo "   sops decrypt .env.sim.enc > .env.sim"
echo "   # 위 변경 사항 .env.sim에 수동 반영"
echo "   sops encrypt .env.sim > .env.sim.enc"
echo "   git add .env.sim.enc && git commit"
echo "======================================================"
```

이 step은 자동화하지 않는다 (sops 키 보유자만 수행).

- [ ] **Step 1.3.3: Commit**

```bash
git add simulations/enterprise-pm/.env.sim.example
git commit -m "chore(sim): replace host.docker.internal with container service names"
```

### Task 1.4: sim-up.sh에 qa-sdk-ingest healthcheck 추가

**Files:**
- Modify: `simulations/enterprise-pm/scripts/sim-up.sh`

- [ ] **Step 1.4.1: services 배열에 qa-sdk-ingest 추가**

`simulations/enterprise-pm/scripts/sim-up.sh`의 healthcheck 대기 단계에서 services 배열을 다음과 같이 수정한다 (라인 38 근처):

기존:
```sh
services=(sim-redis sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-metrics-collector sim-gateway)
```

변경 후:
```sh
services=(qa-sdk-ingest sim-redis sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-metrics-collector sim-gateway)
```

qa-sdk-ingest를 가장 앞에 두는 이유: 다른 시뮬 서비스가 부팅 시 IngestForwarder로 이걸 호출하므로, 가장 먼저 ready여야 한다.

- [ ] **Step 1.4.2: 통합 부팅 검증 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
sops decrypt .env.sim.enc > .env.sim   # sops 보유자만
pnpm sim:up
```

기대: 11개 서비스 모두 healthy 상태로 부팅. 실패 시 docker compose logs qa-sdk-ingest 로 진단.

- [ ] **Step 1.4.3: 기존 시나리오 1~8 무회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
pnpm sim:scenarios run --all
```

기대: 8 시나리오 모두 PASS.

- [ ] **Step 1.4.4: Commit**

```bash
git add simulations/enterprise-pm/scripts/sim-up.sh
git commit -m "chore(sim): include qa-sdk-ingest in sim-up healthcheck wait"
```

### Task 1.5: 단계 1 통합 검증 + 단계 1 닫기

- [ ] **Step 1.5.1: host.docker.internal negative grep gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk
grep -rn "host.docker.internal" simulations/enterprise-pm/ \
  --include="*.yaml" --include="*.yml" --include="*.example" --include="*.sh" \
  | grep -v "extra_hosts" | grep -v "^Binary"
```

기대: 출력 없음. 출력이 있다면 잔존 사용처를 찾아 제거.

- [ ] **Step 1.5.2: docker compose config full validation**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
docker compose -f docker-compose.sim.yaml config > /dev/null && echo OK
```

기대: `OK` 출력. 환경변수 미해결 등 에러 없음.
