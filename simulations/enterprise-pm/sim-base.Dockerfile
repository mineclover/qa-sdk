# qa-sdk Enterprise PM 시뮬 — sim-base 공용 베이스 이미지
#
# Plan 09c가 defer한 항목. follow-up.todo.md TODO-001 검증을 위해 작성.
#
# 모노레포 root를 build context로 받아 9 sim 서비스 + 의존 패키지를 모두 빌드한
# 최종 단일 이미지를 생성한다. 각 service의 wrapper Dockerfile (services/*/Dockerfile)이
# `FROM qa-sdk/sim-base:latest`로 참조하고 WORKDIR + CMD만 지정한다.
#
# build: docker build -f simulations/enterprise-pm/sim-base.Dockerfile -t qa-sdk/sim-base:latest .
#   (반드시 모노레포 root에서 실행)

ARG NODE_VERSION=22-alpine

# ── Stage 1: deps + build ──
FROM node:${NODE_VERSION} AS builder

# Alpine 추가 빌드 도구 (better-sqlite3 native compile)
RUN apk add --no-cache python3 make g++ libc6-compat

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@11.28.6 --activate

WORKDIR /app

# workspace 메타 + lockfile 먼저 복사 (캐시 hit 극대화)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./

# 패키지 manifest만 먼저 복사 (의존 그래프 해석용 — pnpm이 이를 기반으로 deps fetch)
# 이 패턴은 monorepo 빌드 캐시 hit을 위함
COPY packages ./packages
# vendor/ — visbug-bridge 가 file:../../vendor/projectvisbug 로 의존. 누락 시 pnpm install ENOENT.
COPY vendor ./vendor
COPY simulations/enterprise-pm/package.json ./simulations/enterprise-pm/
COPY simulations/enterprise-pm/tsconfig.base.json ./simulations/enterprise-pm/
COPY simulations/enterprise-pm/services ./simulations/enterprise-pm/services
COPY simulations/enterprise-pm/packages ./simulations/enterprise-pm/packages
COPY simulations/enterprise-pm/scenarios ./simulations/enterprise-pm/scenarios
COPY simulations/enterprise-pm/seed ./simulations/enterprise-pm/seed
# contracts/ — sim-identifier-grammar (packages/) 가 ../../../simulations/enterprise-pm/contracts/event-vocabulary.catalog 를 import.
# follow-up #15 (packages/→simulations/ 의존 방향 위반) — 별도 패키지 분리 전까지 본 COPY 필요.
COPY simulations/enterprise-pm/contracts ./simulations/enterprise-pm/contracts
COPY simulations/enterprise-pm/tsconfig.base.json ./simulations/enterprise-pm/

# 의존 설치 (frozen lockfile + workspace-wide)
RUN pnpm install --frozen-lockfile

# 전체 워크스페이스 빌드 — pnpm `...` 필터가 cyclic 워크스페이스 (core↔viz-core 등)
# 의 transitive dep 을 누락하는 문제 회피. weighted-wasm (cargo+wasm-pack 의존,
# alpine 환경 미충족) 만 제외.
# --workspace-concurrency=1: tsup 병렬 race (downstream 이 upstream dts 미완성 상태에서
# 시작) 방지. --bail=false: 일부 패키지 빌드 실패가 sim 서비스와 무관하면 무시.
RUN pnpm --filter "!weighted-wasm" --workspace-concurrency=1 --bail=false -r run build || true

# 빌드 후 sim 서비스 dist 검증 (없으면 빌드 실패)
RUN ls simulations/enterprise-pm/services/auth-api/dist/main.js \
    && ls simulations/enterprise-pm/services/gateway/dist/server.js \
    && ls simulations/enterprise-pm/services/metrics-collector/dist/server.js

# ── Stage 2: runtime ──
FROM node:${NODE_VERSION} AS runtime

# better-sqlite3 native runtime
RUN apk add --no-cache libc6-compat tini wget

RUN corepack enable && corepack prepare pnpm@11.28.6 --activate

WORKDIR /app

# 빌드 결과 + node_modules 통째로 복사 — 각 서비스가 WORKDIR/CMD만 다르게 가짐
COPY --from=builder /app /app

# entrypoint는 tini (PID 1 + signal forwarding)
ENTRYPOINT ["/sbin/tini", "--"]

# 기본 CMD는 비워둠. 각 서비스 wrapper가 override.
CMD ["node", "--version"]
