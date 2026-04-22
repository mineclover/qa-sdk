# Plan 06a — audit-recorder-store 디렉토리 재구성

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 `audit-recorder-store` 패키지(§1 plan 산출물)의 단일 파일 구조를 `src/sqlite/` 하위 디렉토리로 이동. 클래스 rename `DrizzleAuditRecorder` → `SqliteAuditRecorder`. PG 어댑터(06b)와의 평행 구조 마련. 외부 호출자에게는 backward-compat (`DrizzleAuditRecorder` re-export 유지) — `audit-recorder-store/src/e2e-integration.test.ts`와 `permission-engine` consumer 영향 회피.

**Architecture:** Pure refactor. 비즈니스 로직 변경 0, 파일 이동 + import 갱신만. 13 단위 + 2 e2e 테스트 그대로 통과해야 한다.

**Tech Stack:** TypeScript 변경 없음. Plan 05a와 동일 패턴.

---

## File Structure

### 이동·rename

| 이전 | 이후 |
|---|---|
| `packages/audit-recorder-store/src/drizzle-recorder.ts` | `packages/audit-recorder-store/src/sqlite/adapter.ts` |
| `packages/audit-recorder-store/src/drizzle-recorder.test.ts` | `packages/audit-recorder-store/src/sqlite/adapter.test.ts` |
| `packages/audit-recorder-store/src/schema.ts` | `packages/audit-recorder-store/src/sqlite/schema.ts` |

### 수정

| 경로 | 변경 |
|---|---|
| `packages/audit-recorder-store/src/index.ts` | re-export 경로 갱신 + backward-compat alias 유지 |
| `packages/audit-recorder-store/src/e2e-integration.test.ts` | import 경로 갱신 (필요 시) |

### 클래스 rename

`DrizzleAuditRecorder` → `SqliteAuditRecorder`. 외부 호출자는 `DrizzleAuditRecorder`라는 이름으로 계속 import 가능 (alias re-export).

---

## Task 0: baseline

- [ ] **Step 1: 현재 테스트 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -5
```

Expected: 13+2 tests PASS (drizzle-recorder + e2e-integration). 미통과 시 본 plan 시작 금지.

- [ ] **Step 2: 외부 호출자 식별**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "from \"audit-recorder-store\"\|from 'audit-recorder-store'" packages --include="*.ts" | grep -v node_modules | grep -v dist
```

기록: 외부 호출자 목록 (자기 자신의 e2e-integration.test.ts 외 0건일 가능성 높음). 본 plan은 backward-compat 유지 — 호출자 코드 변경 없음.

- [ ] **Step 3: schema/recorder import 패턴 사전 점검**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "drizzle-recorder\|audit-recorder-store/src/schema" packages --include="*.ts" | grep -v node_modules | grep -v dist
```

직접 internal path import가 있으면 본 plan에서 함께 갱신.

---

## Task 1: 디렉토리 생성 + 파일 이동

- [ ] **Step 1: sqlite/ 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store/src/sqlite
```

- [ ] **Step 2: git mv (history 보존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git mv packages/audit-recorder-store/src/drizzle-recorder.ts packages/audit-recorder-store/src/sqlite/adapter.ts && \
  git mv packages/audit-recorder-store/src/drizzle-recorder.test.ts packages/audit-recorder-store/src/sqlite/adapter.test.ts && \
  git mv packages/audit-recorder-store/src/schema.ts packages/audit-recorder-store/src/sqlite/schema.ts
```

Expected: 3 파일 rename. status 확인:

```bash
cd /Users/junwoobang/workflow/qa-sdk && git status
```

Expected: 3 renamed entries.

---

## Task 2: 클래스·import 경로 갱신

**Files:**
- Modify: `packages/audit-recorder-store/src/sqlite/adapter.ts` (클래스 rename + import 경로)
- Modify: `packages/audit-recorder-store/src/sqlite/adapter.test.ts` (import 경로 + 클래스 사용처)
- Modify: `packages/audit-recorder-store/src/index.ts` (re-export 경로)
- Modify: `packages/audit-recorder-store/src/e2e-integration.test.ts` (import 경로)

- [ ] **Step 1: adapter.ts 클래스 rename + 헤더 보강**

`packages/audit-recorder-store/src/sqlite/adapter.ts`:

- 클래스명 `DrizzleAuditRecorder` → `SqliteAuditRecorder` (선언부 1곳).
- `import { auditEntries } from "./schema.js";` 그대로 (같은 디렉토리).
- 파일 헤더 주석을 새 위치 반영:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * SqliteAuditRecorder — permission-engine의 AuditRecorder
 * 인터페이스를 SQLite + Drizzle로 영속 구현.
 *
 * Plan 06a에서 sqlite/ 디렉토리로 이동 + 클래스 rename.
 * 비즈니스 로직 변경 없음 — 트리 구축/parent 조회/정렬 invariant 그대로.
 */
```

- [ ] **Step 2: adapter.test.ts import 경로 + 클래스 사용처 갱신**

`packages/audit-recorder-store/src/sqlite/adapter.test.ts`:

```ts
// 변경 전:
//   import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
//   import { AUDIT_ENTRIES_DDL } from "./schema.js";
// 변경 후:
import { SqliteAuditRecorder } from "./adapter.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";
```

테스트 본문의 `new DrizzleAuditRecorder(db)` → `new SqliteAuditRecorder(db)` (전체 치환).

describe 블록 제목도 `"DrizzleAuditRecorder — AuditRecorder 인터페이스 충족"` → `"SqliteAuditRecorder — AuditRecorder 인터페이스 충족"`로 갱신해 grep 일관성 유지.

- [ ] **Step 3: index.ts — backward-compat re-export**

`packages/audit-recorder-store/src/index.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

// SQLite 어댑터 (기존 경로)
export { SqliteAuditRecorder } from "./sqlite/adapter.js";
export { auditEntries, AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";

// Backward-compat alias — 기존 외부 호출자 영향 회피.
// Plan 06c(factory) 도입 후 deprecation 마킹.
export { SqliteAuditRecorder as DrizzleAuditRecorder } from "./sqlite/adapter.js";
```

- [ ] **Step 4: e2e-integration.test.ts import 경로 갱신**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -n "drizzle-recorder\|\"./schema\.js\"" packages/audit-recorder-store/src/e2e-integration.test.ts
```

`./drizzle-recorder.js` 또는 `./schema.js` 직접 import가 있으면 다음으로 변경:

```ts
// 변경 전:
//   import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
//   import { AUDIT_ENTRIES_DDL } from "./schema.js";
// 변경 후:
import { SqliteAuditRecorder } from "./sqlite/adapter.js";
import { AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";
```

본문의 `new DrizzleAuditRecorder(db)` → `new SqliteAuditRecorder(db)` (전체 치환).

`resource-policy-store`에서 import하는 `DrizzleResourcePolicyRegistry`는 Plan 05a backward-compat alias로 그대로 유지 — 본 plan에서는 건드리지 않는다 (Plan 05d에서 factory로 전환).

- [ ] **Step 5: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store typecheck
```

Expected: 에러 없음. 클래스 사용처 누락 시 unresolved.

- [ ] **Step 6: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test
```

Expected: 모든 테스트 통과 (Task 0과 동일 카운트 — 13 단위 + 2 e2e).

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store && git commit -m "$(cat <<'EOF'
refactor(audit-recorder-store): sqlite/ 디렉토리로 분리 + 클래스 rename

DrizzleAuditRecorder → SqliteAuditRecorder.
backward-compat alias로 기존 호출자 영향 회피.
Plan 06b(PG 어댑터)와 평행 구조 마련.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 외부 호출자 회귀

- [ ] **Step 1: permission-engine 회귀 (간접 의존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter permission-engine test 2>&1 | tail -10
```

Expected: 통과. permission-engine 자체는 audit-recorder-store import 안 하지만, AuditRecorder 인터페이스 호환성 회귀 안전망.

- [ ] **Step 2: resource-policy-store 회귀 (sibling — e2e가 cross-import)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -10
```

Expected: 통과. (audit-recorder-store가 dev dep로 resource-policy-store를 사용하지만, 역방향은 없음 — 안전망 차원.)

- [ ] **Step 3: build (dist 갱신)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store build
```

Expected: dist/index.js, dist/index.cjs, dist/index.d.ts 정상 생성. backward-compat alias가 d.ts에 노출되는지 확인:

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep "DrizzleAuditRecorder\|SqliteAuditRecorder" packages/audit-recorder-store/dist/index.d.ts
```

Expected: 둘 다 export.

- [ ] **Step 4: 의존자 typecheck (있으면)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^audit-recorder-store" typecheck 2>&1 | tail -5
```

Expected: 에러 없음. 의존자 0이어도 정상.

---

## Self-Review

- [ ] git mv로 history 보존 (rename 표시)
- [ ] 클래스 rename + 모든 import 경로 갱신 (adapter.test.ts, e2e-integration.test.ts, index.ts)
- [ ] backward-compat alias 동작 (외부 호출자 코드 변경 없음)
- [ ] audit-recorder-store 13+2 테스트 통과
- [ ] permission-engine 회귀 없음
- [ ] resource-policy-store 회귀 없음
- [ ] dist 재빌드 + d.ts에 두 export 모두 노출

---

## Defer

| 작업 | 이유 |
|---|---|
| `DrizzleAuditRecorder` deprecation 경고 | Plan 06c (factory 도입) 후 deprecation. 외부 호출자가 factory로 마이그레이션할 시점. |
| permission-engine·소비 서비스가 factory 사용으로 전환 | 별도 후속 plan (06d 류, 본 시리즈에서는 미정의 — 06c 완료 후 결정) |
| audit 도메인 cross-domain 분석용 admin role 검증 | Phase 3 RLS plan에서 |

---

## 의존·후속

- **§1 plan** (audit-recorder-store 패키지 신설): 본 plan의 직접 전제. 미완 시 시작 금지.
- **Plan 04c** (db-bootstrap): 본 plan의 직접 의존 아님 (refactor만). 단 06c factory 도입 시 의존.
- **Plan 06b** (PG 어댑터): 본 plan 완료 후. 같은 평행 구조에 pg/ 디렉토리 생성.
- **Plan 06c** (factory + contract test): 06a + 06b 완료 후.
