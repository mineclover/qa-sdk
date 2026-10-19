# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22-alpine

# ============================================================
# Stage 1: builder — 모노레포 전체 install + ingest-server 빌드
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /workspace

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@11.28.6 --activate

# workspace 메타 + 루트 tsconfig + lockfile (캐시 최적화)
# tsconfig.json은 sub-package들의 "extends": "../../tsconfig.json"이 참조하므로 필수
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages packages

# ingest-server와 그 의존을 함께 install
# pnpm filter 문법: "@qa-sdk/ingest-server..."는 ingest-server + 모든 transitive deps를 매치한다
# (참고: "...{./packages/ingest-server}" 는 path 기준 정확히 1 package만 매치하므로 deps 누락)
RUN pnpm install --frozen-lockfile --filter "@qa-sdk/ingest-server..."

# ingest-server + 의존 패키지 build
# "!@qa-sdk/spec-core" 제외: spec-core는 본 사이클 외부의 pre-existing 빌드 결함이 있고
# (spec-transition / dkg / @qa-sdk/core import 미해결), ingest-server는 이를 *_ENABLED=true 일 때만
# dynamic import 하므로 default(memory) 부팅에 영향 없음. spec-core 결함은 별도 sub-project로 처리.
# "!viz-core" 제외: @qa-sdk/core devDeps에 viz-core가 있고 viz-core prod deps에 @qa-sdk/core가 있어
# devDeps cycle이 형성된다. pnpm은 cycle 시 토폴로지 정렬을 포기하고 병렬 실행하므로 viz-core DTS
# 빌드가 @qa-sdk/core/dist/*.d.ts 를 못 찾아 TS2307. viz-core는 ingest-server의 런타임 의존이 아니고
# (오직 packages/core/src/**/*.test.ts에서만 import 되며 core tsconfig는 test 제외), 빌드에서 빼도
# default(memory) 부팅에 영향 없음. devDeps cycle 결함은 별도 sub-project로 처리.
RUN pnpm --filter "@qa-sdk/ingest-server..." --filter "!@qa-sdk/spec-core" --filter "!viz-core" run build

# ============================================================
# Stage 2: runtime — 경량 런타임
# ============================================================
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

RUN apk add --no-cache libc6-compat tini
RUN corepack enable && corepack prepare pnpm@11.28.6 --activate

ENV NODE_ENV=production
ENV PORT=3200
# pnpm은 TTY 없는 환경에서 modules dir 정리 시 confirmation을 요구하므로
# CI=true 또는 --config.confirmModulesPurge=false 가 필요하다.
ENV CI=true

# 빌더에서 산출물만 복사
COPY --from=builder /workspace /app

WORKDIR /app/packages/ingest-server

# 런타임 의존만 재설치 (filter 문법은 builder stage와 동일 사유로 "..." prefix 사용)
# --prod 는 devDeps를 traverse하지 않으므로 viz-core/spec-core가 자연스럽게 빠지지만,
# 명시적으로 제외해서 builder stage와 일관성 유지.
RUN pnpm install --prod --frozen-lockfile --filter "@qa-sdk/ingest-server..." --filter "!@qa-sdk/spec-core" --filter "!viz-core"

EXPOSE 3200

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O- http://localhost:3200/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
