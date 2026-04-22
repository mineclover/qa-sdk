# Plan 05a — resource-policy-store 디렉토리 재구성

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `resource-policy-store`의 단일 파일 구조를 `src/sqlite/` 하위 디렉토리로 이동. 클래스 rename `DrizzleResourcePolicyRegistry` → `SqliteResourcePolicyRegistry`. PG 어댑터(05b)와의 평행 구조 마련. 외부 호출자에게는 backward-compat (`DrizzleResourcePolicyRegistry` re-export 유지).

**Architecture:** Pure refactor. 비즈니스 로직 변경 0, 파일 이동 + import 갱신만. 12 기존 테스트 그대로 통과해야 한다.

**Tech Stack:** TypeScript 변경 없음.

---

## File Structure

### 이동·rename

| 이전 | 이후 |
|---|---|
| `packages/resource-policy-store/src/drizzle-registry.ts` | `packages/resource-policy-store/src/sqlite/adapter.ts` |
| `packages/resource-policy-store/src/drizzle-registry.test.ts` | `packages/resource-policy-store/src/sqlite/adapter.test.ts` |
| `packages/resource-policy-store/src/schema.ts` | `packages/resource-policy-store/src/sqlite/schema.ts` |

### 수정

| 경로 | 변경 |
|---|---|
| `packages/resource-policy-store/src/index.ts` | re-export 경로 갱신 + backward-compat alias 유지 |
| `packages/resource-policy-store/src/e2e-integration.test.ts` | import 경로 갱신 (필요 시) |

### 클래스 rename

`DrizzleResourcePolicyRegistry` → `SqliteResourcePolicyRegistry`. 외부 호출자는 `DrizzleResourcePolicyRegistry`라는 이름으로 계속 import 가능 (alias re-export).

---

## Task 0: baseline

- [ ] **Step 1: 현재 테스트 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -5
```

Expected: 12+ tests PASS (drizzle-registry + e2e-integration).

- [ ] **Step 2: 외부 호출자 식별**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "from \"resource-policy-store\"\|from 'resource-policy-store'" packages --include="*.ts" | grep -v node_modules | grep -v dist
```

기록: 외부 호출자 목록. 본 plan은 backward-compat 유지 — 호출자 코드 변경 없음.

---

## Task 1: 디렉토리 생성 + 파일 이동

- [ ] **Step 1: sqlite/ 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/resource-policy-store/src/sqlite
```

- [ ] **Step 2: git mv (history 보존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git mv packages/resource-policy-store/src/drizzle-registry.ts packages/resource-policy-store/src/sqlite/adapter.ts && \
  git mv packages/resource-policy-store/src/drizzle-registry.test.ts packages/resource-policy-store/src/sqlite/adapter.test.ts && \
  git mv packages/resource-policy-store/src/schema.ts packages/resource-policy-store/src/sqlite/schema.ts
```

Expected: 3 파일 rename. status 확인:

```bash
cd /Users/junwoobang/workflow/qa-sdk && git status
```

Expected: 3 renamed entries.

---

## Task 2: 클래스·import 경로 갱신

**Files:**
- Modify: `packages/resource-policy-store/src/sqlite/adapter.ts` (클래스 rename + import 경로)
- Modify: `packages/resource-policy-store/src/sqlite/adapter.test.ts` (import 경로)
- Modify: `packages/resource-policy-store/src/index.ts` (re-export 경로)
- Modify: `packages/resource-policy-store/src/e2e-integration.test.ts` (import 경로 — 필요 시)

- [ ] **Step 1: adapter.ts 클래스 rename + schema import 경로 갱신**

`packages/resource-policy-store/src/sqlite/adapter.ts`:

- 클래스명 `DrizzleResourcePolicyRegistry` → `SqliteResourcePolicyRegistry` (선언부)
- `import { resourcePolicies } from "./schema.js";` 그대로 (같은 디렉토리)
- 파일 헤더 주석을 새 위치 반영:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * SqliteResourcePolicyRegistry — permission-engine의 ResourcePolicyRegistry
 * 인터페이스를 SQLite + Drizzle로 영속 구현.
 *
 * Plan 05a에서 sqlite/ 디렉토리로 이동 + 클래스 rename.
 * 비즈니스 로직 변경 없음 — 순수 refactor.
 */
```

- [ ] **Step 2: adapter.test.ts import 경로 갱신**

`packages/resource-policy-store/src/sqlite/adapter.test.ts`:

```ts
// 변경 전: import { DrizzleResourcePolicyRegistry } from "./drizzle-registry.js";
// 변경 후:
import { SqliteResourcePolicyRegistry } from "./adapter.js";
import { RESOURCE_POLICIES_DDL } from "./schema.js";
```

테스트 본문의 `new DrizzleResourcePolicyRegistry(db)` → `new SqliteResourcePolicyRegistry(db)`.

- [ ] **Step 3: index.ts — backward-compat re-export**

`packages/resource-policy-store/src/index.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

// SQLite 어댑터 (기존 경로)
export { SqliteResourcePolicyRegistry } from "./sqlite/adapter.js";
export { resourcePolicies, RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

// Backward-compat alias — 기존 외부 호출자 영향 회피.
// Plan 05c(factory) 도입 후 deprecation 마킹.
export { SqliteResourcePolicyRegistry as DrizzleResourcePolicyRegistry } from "./sqlite/adapter.js";
```

- [ ] **Step 4: e2e-integration.test.ts import 경로 갱신**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -n "drizzle-registry\|schema\.js" packages/resource-policy-store/src/e2e-integration.test.ts
```

만약 `./drizzle-registry.js` 또는 `./schema.js` 직접 import 하면 다음으로 변경:

```ts
import { SqliteResourcePolicyRegistry } from "./sqlite/adapter.js";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";
```

- [ ] **Step 5: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store typecheck
```

Expected: 에러 없음. 클래스 사용처 누락 시 unresolved.

- [ ] **Step 6: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test
```

Expected: 모든 테스트 통과 (Task 0과 동일 카운트).

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/resource-policy-store && git commit -m "$(cat <<'EOF'
refactor(resource-policy-store): sqlite/ 디렉토리로 분리 + 클래스 rename

DrizzleResourcePolicyRegistry → SqliteResourcePolicyRegistry.
backward-compat alias로 기존 호출자 영향 회피.
Plan 05b(PG 어댑터)와 평행 구조 마련.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 외부 호출자 회귀

- [ ] **Step 1: permission-engine 회귀 (e2e 의존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter permission-engine --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: 통과. permission-engine의 e2e 시나리오가 새 import 경로 정상 사용.

- [ ] **Step 2: build (dist 갱신)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store build
```

Expected: dist/index.js, dist/index.cjs, dist/index.d.ts 정상 생성. backward-compat alias가 d.ts에 노출되는지 확인:

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep "DrizzleResourcePolicyRegistry\|SqliteResourcePolicyRegistry" packages/resource-policy-store/dist/index.d.ts
```

Expected: 둘 다 export.

---

## Self-Review

- [ ] git mv로 history 보존 (rename 표시)
- [ ] 클래스 rename + 모든 import 경로 갱신
- [ ] backward-compat alias 동작 (외부 호출자 코드 변경 없음)
- [ ] resource-policy-store 12+ 테스트 통과
- [ ] permission-engine e2e 회귀 없음
- [ ] dist 재빌드 + d.ts에 두 export 모두 노출

---

## Defer

| 작업 | 이유 |
|---|---|
| `DrizzleResourcePolicyRegistry` deprecation 경고 | Plan 05c (factory 도입) 후 deprecation. 외부 호출자가 factory로 마이그레이션할 시점. |
| permission-engine 호출자가 factory 사용으로 전환 | Plan 05d |

---

## 의존·후속

- **Plan 04c** (db-bootstrap): 본 plan의 직접 의존 아님 (refactor만). 단 05c factory 도입 시 의존.
- **Plan 05b** (PG 어댑터): 본 plan 완료 후. 같은 평행 구조에 pg/ 디렉토리 생성.
- **Plan 05c** (factory + contract test): 05a + 05b 완료 후.
- **Plan 05d** (호출자 migration): 05c 완료 후.
