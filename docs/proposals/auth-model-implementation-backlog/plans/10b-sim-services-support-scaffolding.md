---
lifecycle: draft
plan: 10b
phase: 4
depends-on: [09a, 09b, 09c, 09d]
---

# Plan 10b — 시뮬 지원 서비스 스캐폴딩 (notification / reporting / document / audit-browser)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `simulations/enterprise-pm/services/` 아래에 NestJS 기반 지원 서비스 4개 (`notification-api`, `reporting-api`, `document-api`, `audit-browser-api`)의 부팅 가능한 스켈레톤을 만든다. Plan 10a와 동일한 NestJS Fastify + initTelemetry 부팅 패턴, 차이는 서비스명·SERVICE_PORTS 키·ownedPrefixes (또는 read-aggregate 표시)뿐. 본 plan 종료 시점 4개 서비스가 각자 포트(4700/4800/4900/5100)에서 `/health` 200을 반환.

**Architecture:**
- Plan 10a 패턴 (NestJS 11 + `@nestjs/platform-fastify` + initTelemetry → NestFactory → listen → SIGINT/SIGTERM)을 그대로 복제.
- `audit-browser-api`는 qa-sdk의 `audit-recorder-store`를 read-only 조회하는 view 서비스 — ownedPrefixes 없음. health 응답에 `role: "read-aggregate"` 표시.
- `reporting-api`도 read-aggregate 성격이지만 `sim.report` / `sim.metric` prefix를 owns (design.md §2). marginal density 측정 endpoint는 Plan 14a에서 부착.
- `notification-api`는 Redis pub/sub subscriber 역할이지만 본 plan 단계에서는 health만. subscriber 부착은 Plan 12b.
- `document-api`는 첨부파일 + 코멘트 + 버전 — 본 plan은 health만, 도메인은 Plan 11c.
- 4 서비스 × 14 파일 = 56 파일 신규.

**Tech Stack:** Plan 10a와 동일 (NestJS 11, @qa-sdk/{core,logger,otel}, db-bootstrap, zod, vitest, ES2023).

---

## File Structure

### 새로 만드는 파일 (각 서비스 14 파일 × 4 = 56)

각 서비스 (`notification-api`, `reporting-api`, `document-api`, `audit-browser-api`)에 동일 14 파일 (Plan 10a Task 1~5 참조):

```
package.json / tsconfig.json / nest-cli.json
src/main.ts / src/app.module.ts
src/config/env.ts + env.test.ts
src/lib/logger.ts
src/health/health.module.ts + health.controller.ts + health.controller.test.ts
Dockerfile / .dockerignore
```

### 서비스별 차이 한눈에

| 서비스 | SERVICE_PORTS 키 | 포트 | ownedPrefixes | 역할 표시 |
|---|---|---|---|---|
| notification-api | `sim-notification-api` | 4700 | `sim.notif`, `sim.subscribe` | producer + subscriber |
| reporting-api | `sim-reporting-api` | 4800 | `sim.report`, `sim.metric` | read-aggregate (marginal density) |
| document-api | `sim-document-api` | 4900 | `sim.doc`, `sim.comment`, `sim.attachment` | producer |
| audit-browser-api | `sim-audit-browser-api` | 5100 | (없음) | read-aggregate (audit-recorder-store 조회) |

---

## Task 0: baseline

- [ ] **Step 1: Plan 09 + 10a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/auth-api/src/main.ts && \
  grep -n "sim-notification-api\|sim-reporting-api\|sim-document-api\|sim-audit-browser-api" packages/core/src/lib/service-ports.ts
```

Expected: auth-api main.ts 존재 (10a 완료) + SERVICE_PORTS 4 entry 모두 hit (09b 완료).

- [ ] **Step 2: 포트 4700/4800/4900/5100 free 확인**

```bash
for port in 4700 4800 4900 5100; do
  echo "port $port:"; lsof -nP -iTCP:$port 2>&1 | head -2
done
```

Expected: 모두 empty.

---

## Task 1: notification-api 스캐폴딩

본 task는 Plan 10a Task 1~5를 한 묶음으로 수행. auth-api 디렉토리 복제 + 차이만 patch.

- [ ] **Step 1: 디렉토리 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/notification-api
```

- [ ] **Step 2: package.json**

`simulations/enterprise-pm/services/notification-api/package.json`:
- `name`: `@qa-sdk/sim-notification-api`
- `description`: `시뮬 — 알림/구독 NestJS 서비스 (Redis subscriber)`

- [ ] **Step 3: env.ts 차이**

```ts
const DEFAULT_PORT = getRequiredServicePort("sim-notification-api"); // 4700
```

- [ ] **Step 4: env.test.ts — 기본값 4700**

```ts
expect(env.PORT).toBe(4700);
```

- [ ] **Step 5: health.controller.ts**

```ts
const SERVICE_NAME = "sim-notification-api";
const OWNED_PREFIXES = ["sim.notif", "sim.subscribe"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "producer-subscriber",
      ts: new Date().toISOString(),
    };
  }
}
```

`role`은 design.md §2의 통신 패턴을 health 응답에 노출. Plan 12b의 Redis subscriber가 활성화되면 `role` 값으로 운영자가 식별.

- [ ] **Step 6: health.controller.test.ts 갱신**

```ts
expect(res.ownedPrefixes).toEqual(["sim.notif", "sim.subscribe"]);
expect(res.role).toBe("producer-subscriber");
```

- [ ] **Step 7: main.ts — SERVICE_NAME 차이**

```ts
const SERVICE_NAME = "sim-notification-api";
```

- [ ] **Step 8: Dockerfile**

```dockerfile
ARG SERVICE_PATH=simulations/enterprise-pm/services/notification-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-notification-api
EXPOSE 4700
```

- [ ] **Step 9: 잔여 치환 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/notification-api && \
  grep -r "sim-auth-api\|auth-api" src/ --include="*.ts" 2>&1
```

Expected: empty.

- [ ] **Step 10: typecheck + test + 부팅 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-notification-api typecheck && \
  pnpm --filter @qa-sdk/sim-notification-api test && \
  pnpm --filter @qa-sdk/sim-notification-api build && \
  pnpm --filter @qa-sdk/sim-notification-api start &
PID=$!
sleep 3
curl -fsS http://localhost:4700/health
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS (env 6 + health 3), /health JSON.

- [ ] **Step 11: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/notification-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-notification-api): NestJS 서비스 스캐폴딩 (포트 4700)

ownedPrefixes=sim.notif/subscribe. role=producer-subscriber.
Redis subscriber 부착은 Plan 12b.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: reporting-api 스캐폴딩

- [ ] **Step 1: 디렉토리 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/reporting-api
```

- [ ] **Step 2: package.json**
- `name`: `@qa-sdk/sim-reporting-api`
- `description`: `시뮬 — 분석·대시보드 (marginal density 측정) NestJS 서비스`

- [ ] **Step 3: env.ts — `getRequiredServicePort("sim-reporting-api")` (4800)**

- [ ] **Step 4: env.test.ts — `expect(env.PORT).toBe(4800)`**

- [ ] **Step 5: health.controller.ts**

```ts
const SERVICE_NAME = "sim-reporting-api";
const OWNED_PREFIXES = ["sim.report", "sim.metric"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "read-aggregate",
      ts: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 6: health.controller.test.ts 갱신**

```ts
expect(res.ownedPrefixes).toEqual(["sim.report", "sim.metric"]);
expect(res.role).toBe("read-aggregate");
```

- [ ] **Step 7: main.ts — `SERVICE_NAME = "sim-reporting-api"`**

- [ ] **Step 8: Dockerfile — `EXPOSE 4800`**

- [ ] **Step 9: 잔여 치환 검증 + typecheck + test + 부팅 smoke (포트 4800)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-reporting-api typecheck && \
  pnpm --filter @qa-sdk/sim-reporting-api test && \
  pnpm --filter @qa-sdk/sim-reporting-api build && \
  pnpm --filter @qa-sdk/sim-reporting-api start &
PID=$!
sleep 3
curl -fsS http://localhost:4800/health
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS, /health JSON.

- [ ] **Step 10: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/reporting-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-reporting-api): NestJS 서비스 스캐폴딩 (포트 4800)

ownedPrefixes=sim.report/metric. role=read-aggregate.
marginal density 측정 endpoint는 Plan 14a.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: document-api 스캐폴딩

- [ ] **Step 1: 디렉토리 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/document-api
```

- [ ] **Step 2: package.json**
- `name`: `@qa-sdk/sim-document-api`
- `description`: `시뮬 — 첨부파일·코멘트·버전 NestJS 서비스`

- [ ] **Step 3: env.ts — `getRequiredServicePort("sim-document-api")` (4900)**

- [ ] **Step 4: env.test.ts — `expect(env.PORT).toBe(4900)`**

- [ ] **Step 5: health.controller.ts**

```ts
const SERVICE_NAME = "sim-document-api";
const OWNED_PREFIXES = ["sim.doc", "sim.comment", "sim.attachment"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "producer",
      ts: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 6: health.controller.test.ts 갱신**

```ts
expect(res.ownedPrefixes).toEqual(["sim.doc", "sim.comment", "sim.attachment"]);
expect(res.role).toBe("producer");
```

- [ ] **Step 7: main.ts — `SERVICE_NAME = "sim-document-api"`**

- [ ] **Step 8: Dockerfile — `EXPOSE 4900`**

- [ ] **Step 9: typecheck + test + 부팅 smoke (포트 4900)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-document-api typecheck && \
  pnpm --filter @qa-sdk/sim-document-api test && \
  pnpm --filter @qa-sdk/sim-document-api build && \
  pnpm --filter @qa-sdk/sim-document-api start &
PID=$!
sleep 3
curl -fsS http://localhost:4900/health
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS, /health JSON.

- [ ] **Step 10: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/document-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-document-api): NestJS 서비스 스캐폴딩 (포트 4900)

ownedPrefixes=sim.doc/comment/attachment. role=producer.
도메인 모델은 Plan 11c.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: audit-browser-api 스캐폴딩

`audit-browser-api`는 qa-sdk 본체의 `audit-recorder-store`를 read-only로 조회하는 view 서비스 — ownedPrefixes 없음.

- [ ] **Step 1: 디렉토리 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/audit-browser-api
```

- [ ] **Step 2: package.json**
- `name`: `@qa-sdk/sim-audit-browser-api`
- `description`: `시뮬 — audit trace explorer NestJS 서비스 (audit-recorder-store 조회)`
- `dependencies`에 `audit-recorder-store: workspace:*` 추가 (read 전용 조회)

```json
"dependencies": {
  "@nestjs/common": "^11.0.0",
  "@nestjs/core": "^11.0.0",
  "@nestjs/platform-fastify": "^11.0.0",
  "@qa-sdk/core": "workspace:*",
  "@qa-sdk/logger": "workspace:*",
  "@qa-sdk/otel": "workspace:*",
  "audit-recorder-store": "workspace:*",
  "db-bootstrap": "workspace:*",
  "reflect-metadata": "^0.2.2",
  "rxjs": "^7.8.1",
  "zod": "^3.24.2"
}
```

`audit-recorder-store`는 본 plan에서 import만 하지 않지만 Plan 12c가 곧바로 사용. dep으로 미리 선언.

- [ ] **Step 3: env.ts — `getRequiredServicePort("sim-audit-browser-api")` (5100)**

- [ ] **Step 4: env.test.ts — `expect(env.PORT).toBe(5100)`**

- [ ] **Step 5: health.controller.ts — ownedPrefixes 없음**

```ts
const SERVICE_NAME = "sim-audit-browser-api";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: [], // view-only — own 없음
      role: "read-aggregate",
      reads: ["audit-recorder-store"],
      ts: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 6: health.controller.test.ts 갱신**

```ts
expect(res.ownedPrefixes).toEqual([]);
expect(res.role).toBe("read-aggregate");
expect(res.reads).toEqual(["audit-recorder-store"]);
```

- [ ] **Step 7: main.ts — `SERVICE_NAME = "sim-audit-browser-api"`**

- [ ] **Step 8: Dockerfile — `EXPOSE 5100`**

- [ ] **Step 9: typecheck + test + 부팅 smoke (포트 5100)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm install && \
  pnpm --filter @qa-sdk/sim-audit-browser-api typecheck && \
  pnpm --filter @qa-sdk/sim-audit-browser-api test && \
  pnpm --filter @qa-sdk/sim-audit-browser-api build && \
  pnpm --filter @qa-sdk/sim-audit-browser-api start &
PID=$!
sleep 3
curl -fsS http://localhost:5100/health
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS, /health JSON에 `ownedPrefixes: []` + `reads: ["audit-recorder-store"]`.

- [ ] **Step 10: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/audit-browser-api pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-audit-browser-api): NestJS 서비스 스캐폴딩 (포트 5100)

view-only — ownedPrefixes 없음. role=read-aggregate.
audit-recorder-store workspace dep (Plan 12c가 사용).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 통합 회귀 — 4 서비스 동시 부팅

- [ ] **Step 1: 4 서비스 동시 부팅 + /health probe**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-notification-api start & PID1=$!
  pnpm --filter @qa-sdk/sim-reporting-api start & PID2=$!
  pnpm --filter @qa-sdk/sim-document-api start & PID3=$!
  pnpm --filter @qa-sdk/sim-audit-browser-api start & PID4=$!
sleep 5
echo "notification:"; curl -fsS http://localhost:4700/health; echo
echo "reporting:";    curl -fsS http://localhost:4800/health; echo
echo "document:";     curl -fsS http://localhost:4900/health; echo
echo "audit-browser:"; curl -fsS http://localhost:5100/health; echo
kill $PID1 $PID2 $PID3 $PID4 2>/dev/null || true
```

Expected: 4 JSON 응답.

- [ ] **Step 2: 10a + 10b 합쳐 7 서비스 동시 부팅 (선택, 자원 여유 시)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api; do
    pnpm --filter @qa-sdk/$svc start &
  done
sleep 8
for port in 4400 4500 4600 4700 4800 4900 5100; do
  echo "port $port:"; curl -fsS http://localhost:$port/health || echo "FAIL"
  echo
done
pkill -f "node dist/main.js" || true
```

Expected: 7 JSON 응답.

- [ ] **Step 3: workflow-smoke + def gate 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3 && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: smoke PASS, def errors 0.

---

## Self-Review

- [ ] 4 서비스 모두 NestJS 11 + initTelemetry → NestFactory → listen 패턴
- [ ] 각 서비스 PORT는 SERVICE_PORTS SSOT 파생
- [ ] ownedPrefixes는 design.md §2와 1:1 매치 (audit-browser는 빈 배열)
- [ ] `role` 필드: producer / read-aggregate / producer-subscriber 적절히 표시
- [ ] audit-browser-api는 audit-recorder-store dep 추가 (Plan 12c 사용)
- [ ] 단위 테스트 9건 × 4 서비스 = 36 PASS
- [ ] 4 서비스 동시 부팅 → 4 /health 200
- [ ] console.log 0건

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 도메인 모듈 (Notification/Document/...) 부착 | 본 plan은 부팅만 | Plan 11c |
| audit-browser-api의 audit-recorder-store 조회 endpoint | observability 통합 | Plan 12c |
| reporting-api marginal density 측정 endpoint | §5 측정은 시뮬 트래픽 후 | Plan 14a |
| Redis subscriber (notification-api) | bitmap pub/sub 통합 | Plan 12b |
| document-api 첨부파일 storage backend | S3 호환 또는 로컬 — Plan 11c에서 결정 | Plan 11c |

---

## 의존·후속

- **Plan 09a/b/c/d** (인프라 부트스트랩): 본 plan의 전제.
- **Plan 04c** (db-bootstrap): env schema import.
- **Plan 10a** (코어 서비스): 본 plan과 병렬. 동일 패턴 3 서비스.
- **Plan 10c** (Edge 서비스): 본 plan과 병렬. Hono + Prometheus.
- **Plan 11c** (지원 도메인): 본 plan의 4 서비스 위에 도메인 부착.
- **Plan 12b** (Redis pub/sub): notification-api subscriber 활성화.
- **Plan 12c** (OTEL/audit 연동): audit-browser-api의 audit-recorder-store 조회.
- **Plan 14a** (marginal density): reporting-api endpoint 부착.
