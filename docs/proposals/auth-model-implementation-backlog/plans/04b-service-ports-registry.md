# Plan 04b — SERVICE_PORTS에 PG 인스턴스 등록

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `packages/core/src/lib/service-ports.ts`의 `SERVICE_PORTS`에 `zitadel-postgres: 5433` (drift fix)와 `qa-sdk-postgres: 5434` (Plan 04a 신규 컨테이너) 두 entry 추가. `infra-port-allocation.spec.md` 표 갱신.

**Architecture:** 단일 SSOT 상수에 row 2개 추가 + spec 문서 동기. SERVICE_PORTS는 dependency-free 상수 — 영향 범위는 import하는 곳의 typecheck만.

**Tech Stack:** TypeScript, vitest (선택). 신규 의존 없음.

---

## File Structure

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/core/src/lib/service-ports.ts` | SERVICE_PORTS 배열에 2 entry 추가 (인프라 레이어 위치) |
| `docs/specs/infra-engine/infra-port-allocation.spec.md` | 포트 테이블에 2 row 추가 |
| `packages/core/src/lib/service-ports.test.ts` (있을 시) | 신규 entry 검증 추가 (선택) |

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| (없음) — 본 plan은 mechanical update |

---

## Task 0: baseline

- [ ] **Step 1: 현재 SERVICE_PORTS 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core test -- service-ports 2>&1 | tail -5
```

Expected: 관련 테스트 모두 통과 (현재 16 entries).

- [ ] **Step 2: 5433/5434 미충돌 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -n "5433\|5434" packages/core/src/lib/service-ports.ts
```

Expected: 두 포트 미사용 (5433은 zitadel docker-compose에만 있고 SERVICE_PORTS에는 없음 — drift).

---

## Task 1: SERVICE_PORTS에 PG entry 2개 추가

**Files:**
- Modify: `packages/core/src/lib/service-ports.ts`

- [ ] **Step 1: 인프라 레이어 위치에 entry 추가**

`packages/core/src/lib/service-ports.ts` line 23 (`{ name: "prometheus" ... }`) 다음에 삽입:

```ts
  // ── 인프라 데이터베이스 (PostgreSQL 인스턴스) ──
  { name: "zitadel-postgres",   defaultPort: 5433, description: "Zitadel 인증 DB 컨테이너 (docker-compose.infra.yaml)" },
  { name: "qa-sdk-postgres",    defaultPort: 5434, description: "qa-sdk 메인 PG 컨테이너 (auth/audit/ingest/decision/definition schema)" },
```

전체 변경 후 SERVICE_PORTS는 18 entries.

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

- [ ] **Step 3: 테스트 (있다면)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core test -- service-ports 2>&1 | tail -10
```

Expected: 통과. 만약 entry 개수를 hardcode한 테스트가 있으면 16 → 18로 갱신 필요. 그러나 `feedback_skew-by-aggregation` + SSOT 원칙에 따라 hardcode는 없을 가능성 — `SERVICE_PORTS.length`로 derive해야.

만약 hardcode 발견되면 별도 fix:
```ts
// before: expect(SERVICE_PORTS.length).toBe(16);
// after: expect 자체를 빼거나 의미 있는 invariant로 변경
//   예: expect(SERVICE_PORTS.every(e => e.defaultPort > 0)).toBe(true);
```

- [ ] **Step 4: detectPortConflicts 동작 확인**

새 entry가 충돌 검출에 정상 포함되는지 인터랙티브 테스트:

```bash
cd /Users/junwoobang/workflow/qa-sdk && node -e "
const { detectPortConflicts } = require('./packages/core/dist/lib/service-ports.js');
console.log(detectPortConflicts('test-svc', 5434));
"
```

Expected: warning 1건 (qa-sdk-postgres와 충돌). dist가 stale이면 build 먼저:
```bash
pnpm --filter @qa-sdk/core build && [위 node -e 명령 재실행]
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/core/src/lib/service-ports.ts && git commit -m "$(cat <<'EOF'
feat(core): SERVICE_PORTS에 PG 인스턴스 2개 등록

- zitadel-postgres:5433 (기존 docker-compose drift fix)
- qa-sdk-postgres:5434 (Plan 04a 신규 컨테이너)

infra-port-allocation.spec.md와 동기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: spec 문서 갱신

**Files:**
- Modify: `docs/specs/infra-engine/infra-port-allocation.spec.md`

- [ ] **Step 1: 포트 테이블에 row 추가**

`docs/specs/infra-engine/infra-port-allocation.spec.md`의 포트 테이블에서 **Infra** 섹션 (Prometheus 다음)에 추가:

```markdown
| **Infra** | zitadel-postgres | 5433 | Zitadel 인증 DB 컨테이너 |
| **Infra** | qa-sdk-postgres  | 5434 | qa-sdk 메인 PG 컨테이너 (auth/audit/ingest/decision/definition schema) |
```

- [ ] **Step 2: 본문 §관리 원칙 점검**

문서 §관리 원칙은 "각 서비스의 `env.ts`는 하드코딩된 fallback 포트를 가질 수 없다"고 명시. PG는 서비스가 아닌 인프라 컨테이너 — 별도 운영 규칙 한 줄 추가:

```markdown
- **인프라 DB**: `zitadel-postgres`, `qa-sdk-postgres`처럼 PG 인스턴스도 SERVICE_PORTS에 등록한다. 서비스의 `QA_PG_PORT`는 service-profile/.env에서 주입받으며 SERVICE_PORTS는 충돌 검출 단일 진입점 역할.
```

- [ ] **Step 3: def sync로 DB 반영**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def sync 2>&1 | tail -3
```

Expected: 1 doc updated.

- [ ] **Step 4: def validate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -5
```

Expected: errors=0 유지.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add docs/specs/infra-engine/infra-port-allocation.spec.md && git commit -m "$(cat <<'EOF'
docs(infra): infra-port-allocation에 PG 인스턴스 2개 추가

zitadel-postgres:5433 + qa-sdk-postgres:5434.
인프라 DB도 SERVICE_PORTS에 등록한다는 원칙 명시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 회귀

- [ ] **Step 1: 영향 패키지 typecheck (core를 import하는 모든 패키지)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/core" typecheck 2>&1 | tail -10
```

Expected: 모두 에러 없음 (SERVICE_PORTS에 entry 추가는 backward-compat).

- [ ] **Step 2: 영향 패키지 테스트 (선택, 광범위)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/ingest-server --filter infra-engine test 2>&1 | tail -15
```

Expected: 모두 통과.

- [ ] **Step 3: workflow-smoke 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | tail -5
```

Expected: 13/13 smoke 통과.

---

## Self-Review

- [ ] SERVICE_PORTS에 zitadel-postgres + qa-sdk-postgres 등록됨
- [ ] spec 문서 포트 테이블 갱신
- [ ] 5433은 zitadel docker-compose와 동기 (drift 해소)
- [ ] 5434는 Plan 04a의 docker-compose port와 일치
- [ ] core typecheck/test 통과
- [ ] def validate errors 0 유지

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `infra export env`에 `QA_PG_*` 변수 자동 생성 | 본 plan은 SERVICE_PORTS 등록만, env 추출은 별도 책임 | Plan 04d |
| ServiceProfile에 PG 연결 필드 추가 | service-profile 갱신은 db-bootstrap 패키지가 주도 | Plan 04c |
| 포트 충돌 자동 감지 CI gate | 현재 SERVICE_PORTS는 자체 테스트로만 검증, CI gate는 별도 설계 필요 | (없음) |

---

## 의존·후속

- **Plan 04a** (qa-sdk-db 컨테이너): 본 plan과 독립. 병렬 가능.
- **Plan 04c** (db-bootstrap 패키지): 본 plan + 04a 완료 후. SERVICE_PORTS에서 `qa-sdk-postgres` 포트를 read.
- **Plan 04d** (infra-engine env export): 본 plan 완료 후. SERVICE_PORTS의 PG entry를 `.env` 파일로 export.
