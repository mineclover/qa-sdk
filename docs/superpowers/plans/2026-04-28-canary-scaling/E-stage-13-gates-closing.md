## 단계 13: 인프라 검증 게이트 활성화 + 사이클 마감

**Spec 참조:** `05-error-and-scenarios.md` §4 + 본 사이클 전체 (`00-overview.md` ~ `06-roadmap.md`)

본 단계는 카나리·스케일링 1차 사이클의 마지막이다. Plan A·B·C·D·E의 단계 1~12에서 분산 도입한 인프라 검증 6종이 모두 활성 상태인지 cross-check 매트릭스로 확인하고, BFF write·read DataSource 정적 가드 두 lint rule을 root ESLint 설정에 묶고, 17 시나리오 + 인프라 검증 6종을 단일 entrypoint(`pnpm sim:smoke:full`)로 결합하며, DoD 8개 체크리스트를 1차 사이클 완료 보고서에 첨부해 본 사이클을 닫는다.

### File Structure (단계 13)

| 종류 | 경로 |
|---|---|
| Create | `docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md` |
| Create | `scripts/sim-smoke-full.ts` |
| Create | `packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.ts` |
| Create | `packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.test.ts` |
| Modify | `packages/sim-eslint-rules/src/index.ts` (rule 신규 export) |
| Modify | `packages/sim-eslint-rules/package.json` (필요 시 typescript-eslint utils 의존 추가) |
| Modify | `.eslintrc.cjs` (root) — `sim/no-write-import-in-bff` + `sim/no-write-call-on-read-datasource` 활성화 검증 |
| Modify | `package.json` (root) — `sim:smoke:full` 스크립트 추가 |
| Modify | `simulations/enterprise-pm/README.md` — 1차 사이클 완료 표기 + 후속 sub-project 5종 인덱스 링크 |

### Task 13.1: 인프라 검증 6종 cross-check 매트릭스

**Files:**
- Create: `docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md` (cross-check 매트릭스 섹션만 본 task에서 채움. DoD/후속 인덱스는 Task 13.5에서 채움)

본 task는 spec 05 §4 인프라 검증 6종(identifier-grammar 라운드트립 / identifier-gate CI / catalog 4-way 정합성 / host.docker.internal negative grep / BFF write DataSource lint / read DataSource INSERT/UPDATE/DELETE 차단)이 Plan A·B·C·D·E의 어느 task로 활성화됐는지 1:1 매핑을 보고서에 박는다. 매핑이 비어 있으면 본 단계 task가 존재해야 함을 나타내고, 본 사이클 닫기 전 보강한다.

- [ ] **Step 13.1.1: 보고서 골격 + 매트릭스 작성**

`docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md`:

```markdown
# Enterprise-PM Canary & Scaling — 1차 사이클 완료 보고

> 본 보고는 spec 06 §5 Definition of Done을 충족했음을 증명하고, 인프라 검증 6종(spec 05 §4)이 활성화된 위치를 cross-check로 명시한다.

## 1. 인프라 검증 6종 cross-check 매트릭스

| spec 05 §4 검증 | 활성화 위치 (Plan/Task) | 실행 명령 |
|---|---|---|
| identifier-grammar 라운드트립 | Plan A 단계 2 — Task 2.18 (통합 라운드트립 property test) + 식별자별 Task 2.5~2.16 | `pnpm --filter sim-identifier-grammar test` |
| identifier-gate CI | Plan A 단계 2 — Task 2.20 (`.github/workflows/identifier-gate.yml`) | (CI 자동) + 로컬: `pnpm sim:lint:identifiers` |
| catalog ↔ compose ↔ env 4-way 정합성 | Plan B 단계 3 — Task 3.7 (`scripts/validate-catalog.ts`) | `pnpm sim:catalog:validate` |
| host.docker.internal negative grep | Plan A 단계 1 — Task 1.5.1 (sim 디렉터리 grep gate) + Task 2.19 (compose 라인 단위 lint) | Task 1.5.1 명령 + `pnpm sim:lint:identifiers` |
| BFF 모듈에서 write DataSource import 없음 | Plan C 단계 8 — Task 8.6 (`sim/no-write-import-in-bff` ESLint custom rule) | `pnpm lint` (root) |
| read DataSource로 INSERT/UPDATE/DELETE 호출 없음 | **단계 13 — Task 13.3 (`sim/no-write-call-on-read-datasource`)** + 런타임 PG `default_transaction_read_only=on` (Plan A 단계 4 read replica 부팅 옵션) | `pnpm lint` + 런타임 `set_session_authorization` 거부 |

## 2. (이후 Task 13.5에서 채움)
```

- [ ] **Step 13.1.2: 매트릭스 무결성 셀프 체크**

매트릭스의 각 행이 가리키는 task가 실제 존재하는지 grep으로 확인한다.

```bash
cd /Users/junwoobang/workflow/qa-sdk
grep -n "Task 2.18\|Task 2.20\|Task 1.5\|Task 2.19" docs/superpowers/plans/2026-04-28-canary-scaling/A-foundation.md
grep -n "Task 3.7" docs/superpowers/plans/2026-04-28-canary-scaling/_fragments/B-stage-3-sim-service-catalog.md
ls docs/superpowers/plans/2026-04-28-canary-scaling/_fragments/ | grep -E "C-stage-8|task-8.6"
```

기대: 처음 두 grep은 hit. 세 번째는 Plan C 작성 시점에 fragment 존재. 빈 결과면 Plan C 작성을 선행 (본 task는 매핑 보고만 담당).

- [ ] **Step 13.1.3: 보고서 매트릭스만 우선 commit**

```bash
git add docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md
git commit -m "docs(spec/canary-cycle1): cross-check matrix — 인프라 검증 6종 활성화 위치"
```

### Task 13.2: BFF write DataSource lint 활성화 검증

**Files:**
- Modify: `.eslintrc.cjs` (root, plugin/rule 등록 검증)

본 task는 신규 rule을 만들지 않는다. Plan C 단계 8 Task 8.6에서 만든 `sim/no-write-import-in-bff` rule이 root ESLint 설정에 등록되어 있고, BFF 디렉터리 fixture에서 의도적 위반이 정확히 검출되는지 통합 lint를 돌려 회귀 가드를 닫는다.

- [ ] **Step 13.2.1: root .eslintrc.cjs에서 rule 등록 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
grep -n "sim/no-write-import-in-bff\|sim-eslint-rules" .eslintrc.cjs
```

기대: 두 토큰 모두 hit. `plugins: [..., "sim"]` + `rules: { "sim/no-write-import-in-bff": "error", ... }` 라인이 있어야 한다. 없으면 `.eslintrc.cjs`에 다음을 추가한다 (Plan C에서 누락된 경우의 보강):

```javascript
module.exports = {
  // ... 기존 설정
  plugins: [/* 기존 */, "sim"],
  rules: {
    // ... 기존
    "sim/no-write-import-in-bff": "error",
  },
};
```

- [ ] **Step 13.2.2: BFF 디렉터리에 의도적 위반 fixture로 회귀 검증**

`apps/bff/__lint_fixtures__/violation.ts.fixture` (lint 대상에서 제외되도록 확장자는 `.fixture`):

```typescript
// lint fixture — 본 파일은 .eslintignore 또는 overrides로 lint 대상에서 제외하되,
// 별도 unit test에서 RuleTester로 검증한다.
import { writeRepository } from "@qa-sdk-sim/approval-write-datasource"; // ← rule 위반
export const x = writeRepository;
```

`packages/sim-eslint-rules/src/rules/no-write-import-in-bff.test.ts`에 (Plan C에서 만든 RuleTester 케이스가 있으면 skip) BFF path prefix 매칭 케이스 1건 추가:

```typescript
ruleTester.run("no-write-import-in-bff", rule, {
  valid: [
    { code: 'import { readRepository } from "@qa-sdk-sim/approval-read-datasource";',
      filename: "/repo/apps/bff/src/handler.ts" },
  ],
  invalid: [
    { code: 'import { writeRepository } from "@qa-sdk-sim/approval-write-datasource";',
      filename: "/repo/apps/bff/src/handler.ts",
      errors: [{ messageId: "writeImportInBff" }] },
  ],
});
```

- [ ] **Step 13.2.3: 통합 lint 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm lint 2>&1 | tee /tmp/sim-lint.log
grep "no-write-import-in-bff" /tmp/sim-lint.log || echo "rule이 lint 출력에 등장하지 않음 — fixture 경로/플러그인 등록 확인"
```

기대: rule violation이 fixture 외 실제 BFF 코드에서 0건. fixture 자체는 `.eslintignore`로 제외했으므로 lint 출력에는 등장하지 않으면 된다. RuleTester 단위 테스트는 PASS.

- [ ] **Step 13.2.4: 회귀 게이트 명세를 보고서에 추가**

`완료-보고.md` §1 매트릭스에 BFF 행 옆에 검증 일시·실행자(local/CI)를 기록할 컬럼 자리를 비워둔다. CI에서 `pnpm lint`를 강제하는 워크플로 경로(`.github/workflows/`)도 grep으로 1회 확인한다.

```bash
grep -rn "pnpm lint\|sim/no-write" .github/workflows/ || echo "CI에서 sim ESLint plugin 미강제 — Plan C 단계 8에서 보강 필요"
```

- [ ] **Step 13.2.5: Commit**

```bash
git add .eslintrc.cjs packages/sim-eslint-rules/src/rules/no-write-import-in-bff.test.ts
git commit -m "test(sim-eslint-rules): BFF path prefix 매칭 케이스 보강 + root 등록 검증"
```

### Task 13.3: read DataSource INSERT/UPDATE/DELETE 호출 차단 lint (신규)

**Files:**
- Create: `packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.ts`
- Create: `packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.test.ts`
- Modify: `packages/sim-eslint-rules/src/index.ts`

Plan C 단계 8 Task 8.6은 _import 차단_ 만 다룬다. 그러나 같은 read 모듈을 import한 이후 호출 사이트에서 `Repository#save / insert / update / delete` 같은 변경 메서드를 호출하면 정적 lint를 우회한다. 본 task는 호출 사이트 자체를 정적으로 거부하는 신규 rule을 추가한다. spec 05 §4의 6번째 검증 항목이 본 task로 활성화된다.

- [ ] **Step 13.3.1: 실패 테스트 작성**

`packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.test.ts`:

```typescript
import { RuleTester } from "@typescript-eslint/rule-tester";
import { rule } from "./no-write-call-on-read-datasource.js";

const tester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: { ecmaVersion: 2023, sourceType: "module" },
});

tester.run("no-write-call-on-read-datasource", rule, {
  valid: [
    {
      code: `
        import { readRepository } from "@qa-sdk-sim/approval-read-datasource";
        await readRepository.find({ where: { id: 1 } });
      `,
    },
    {
      // write datasource는 본 rule 대상이 아님 (BFF import lint와 책임 분리)
      code: `
        import { writeRepository } from "@qa-sdk-sim/approval-write-datasource";
        await writeRepository.save(entity);
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { readRepository } from "@qa-sdk-sim/approval-read-datasource";
        await readRepository.save(entity);
      `,
      errors: [{ messageId: "writeCallOnReadDatasource", data: { method: "save" } }],
    },
    {
      code: `
        import { readRepository as r } from "@qa-sdk-sim/approval-read-datasource";
        await r.insert({});
      `,
      errors: [{ messageId: "writeCallOnReadDatasource", data: { method: "insert" } }],
    },
    {
      code: `
        import { readRepository } from "@qa-sdk-sim/approval-read-datasource";
        await readRepository.update({}, {});
        await readRepository.delete({});
      `,
      errors: [
        { messageId: "writeCallOnReadDatasource", data: { method: "update" } },
        { messageId: "writeCallOnReadDatasource", data: { method: "delete" } },
      ],
    },
  ],
});
```

- [ ] **Step 13.3.2: 테스트 실패 확인**

```bash
pnpm --filter sim-eslint-rules test no-write-call-on-read-datasource
```

기대: FAIL (모듈 미존재).

- [ ] **Step 13.3.3: 최소 구현**

`packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.ts`:

```typescript
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

const WRITE_METHODS = new Set(["save", "insert", "update", "delete", "upsert", "remove"]);
// spec 05 §4 — read DataSource 모듈 식별. catalog로 외부화 가능하지만, 1차 구현은 inline.
const READ_DATASOURCE_MODULE_RE = /^@qa-sdk-sim\/[a-z][a-z0-9-]*-read-datasource$/;

const createRule = ESLintUtils.RuleCreator((name) => `https://docs/sim/${name}`);

export const rule = createRule<[], "writeCallOnReadDatasource">({
  name: "no-write-call-on-read-datasource",
  meta: {
    type: "problem",
    docs: {
      description:
        "read DataSource 모듈에서 import한 식별자에 대해 write 메서드(save/insert/update/delete/upsert/remove) 호출을 금지한다.",
    },
    messages: {
      writeCallOnReadDatasource:
        "read DataSource로 import한 식별자에 write 메서드({{method}})를 호출할 수 없습니다 (CQRS 분리 — spec 05 §4).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const readBindings = new Set<string>();

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const src = node.source.value;
        if (typeof src !== "string") return;
        if (!READ_DATASOURCE_MODULE_RE.test(src)) return;
        for (const spec of node.specifiers) {
          readBindings.add(spec.local.name);
        }
      },
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;
        const method = callee.property.name;
        if (!WRITE_METHODS.has(method)) return;

        // 단순 케이스: readRepository.save(...)
        if (callee.object.type === "Identifier" && readBindings.has(callee.object.name)) {
          context.report({ node, messageId: "writeCallOnReadDatasource", data: { method } });
        }
      },
    };
  },
});
```

`packages/sim-eslint-rules/src/index.ts`에 추가:

```typescript
import { rule as noWriteCallOnReadDatasource } from "./rules/no-write-call-on-read-datasource.js";
// ... 기존 rule import

export = {
  rules: {
    // ... 기존
    "no-write-call-on-read-datasource": noWriteCallOnReadDatasource,
  },
};
```

`.eslintrc.cjs`의 rules 블록에 등록:

```javascript
"sim/no-write-call-on-read-datasource": "error",
```

- [ ] **Step 13.3.4: 테스트 통과 + 통합 lint 회귀**

```bash
pnpm --filter sim-eslint-rules build
pnpm --filter sim-eslint-rules test no-write-call-on-read-datasource
pnpm lint
```

기대: RuleTester 4건 PASS, root `pnpm lint`는 위반 0건. 위반이 발견되면 BFF/reporting slice 코드를 read 전용으로 정정한다 (Plan C 단계 8 Task 8.x 회귀).

- [ ] **Step 13.3.5: Commit**

```bash
git add packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.ts \
        packages/sim-eslint-rules/src/rules/no-write-call-on-read-datasource.test.ts \
        packages/sim-eslint-rules/src/index.ts \
        .eslintrc.cjs
git commit -m "feat(sim-eslint-rules): no-write-call-on-read-datasource (CQRS 호출 차단)"
```

### Task 13.4: pnpm sim:smoke:full — 17 시나리오 + 인프라 검증 6종 통합 entrypoint

**Files:**
- Create: `scripts/sim-smoke-full.ts`
- Modify: `package.json` (root) — `sim:smoke:full` 스크립트 추가

본 task는 사이클 마감 검증의 단일 entrypoint를 만든다. spec 05 §4의 인프라 gate → §3의 17 시나리오 매트릭스 순서를 준수하고(§4 "인프라 gate 실패 시 시나리오 매트릭스 skip"), 실패 시 어느 단계에서 끊겼는지 정확한 진단을 출력한다.

- [ ] **Step 13.4.1: 통합 스크립트 작성**

`scripts/sim-smoke-full.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * sim:smoke:full — 1차 사이클 마감 검증.
 *
 * 순서 (spec 05 §4: 인프라 gate → 시나리오 매트릭스):
 *   1) identifier-grammar 라운드트립
 *   2) identifier 정적 lint (host.docker.internal grep 포함)
 *   3) catalog 4-way 정합성
 *   4) ESLint root (BFF write import + read write call 차단 통합)
 *   5) 시나리오 1~8 (기존 회귀)
 *   6) 시나리오 9~17 (신규)
 *
 * 실패 시 즉시 abort + 어느 단계에서 끊겼는지 식별 가능한 종료 코드.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

interface Stage {
  id: string;
  label: string;
  cmd: string;
  args: string[];
  cwd?: string;
  // spec 05 §4 매핑
  spec: string;
}

const STAGES: Stage[] = [
  {
    id: "grammar-roundtrip",
    label: "identifier-grammar 라운드트립",
    cmd: "pnpm",
    args: ["--filter", "sim-identifier-grammar", "test"],
    spec: "05 §4 #1",
  },
  {
    id: "identifier-lint",
    label: "identifier 정적 lint (host.docker.internal grep + image tag + label key)",
    cmd: "pnpm",
    args: ["sim:lint:identifiers"],
    spec: "05 §4 #2 + #4",
  },
  {
    id: "catalog-validate",
    label: "catalog 4-way 정합성",
    cmd: "pnpm",
    args: ["sim:catalog:validate"],
    spec: "05 §4 #3",
  },
  {
    id: "eslint-root",
    label: "ESLint (BFF write import + read write call 차단)",
    cmd: "pnpm",
    args: ["lint"],
    spec: "05 §4 #5 + #6",
  },
  {
    id: "scenarios-1-8",
    label: "기존 시나리오 1~8 회귀",
    cmd: "pnpm",
    args: ["sim:e2e", "--filter", "scenario-[1-8]-*"],
    cwd: resolve(ROOT, "simulations/enterprise-pm"),
    spec: "06 §5 DoD #2 (기존 회귀)",
  },
  {
    id: "scenarios-9-17",
    label: "신규 시나리오 9~17",
    cmd: "pnpm",
    args: ["sim:e2e", "--filter", "scenario-(9|1[0-7])-*"],
    cwd: resolve(ROOT, "simulations/enterprise-pm"),
    spec: "05 §3 + 06 §5 DoD #2",
  },
];

const passed: string[] = [];
const failed: { id: string; spec: string; code: number } | null = null as any;

for (const stage of STAGES) {
  console.log(`\n[sim:smoke:full] ▶ ${stage.label} (${stage.spec})`);
  const r = spawnSync(stage.cmd, stage.args, {
    stdio: "inherit",
    cwd: stage.cwd ?? ROOT,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`\n[sim:smoke:full] ✗ FAIL @ stage=${stage.id} spec=${stage.spec} exit=${r.status}`);
    console.error(`[sim:smoke:full] 통과한 단계: ${passed.join(", ") || "(없음)"}`);
    console.error(`[sim:smoke:full] 진단 가이드: spec 05 §6 분류 트리 — 이 단계 실패가 다음 단계의 위장 실패를 만들 수 있으므로 본 단계만 먼저 fix.`);
    process.exit(2);
  }
  passed.push(stage.id);
}

console.log(`\n[sim:smoke:full] ✓ 전 단계 PASS — 1차 사이클 DoD 후보 충족`);
console.log(`[sim:smoke:full] 다음 절차: 단계 13 Task 13.5 — 완료-보고.md DoD 체크리스트 확정`);
```

- [ ] **Step 13.4.2: package.json (root) 스크립트 등록**

루트 `package.json`의 `"scripts"` 블록에 추가:

```json
"sim:smoke:full": "tsx scripts/sim-smoke-full.ts"
```

- [ ] **Step 13.4.3: 진단 출력 검증 (의도적 실패 주입)**

`docker-compose.sim.yaml` 어딘가에 일시적으로 `host.docker.internal` 1줄을 다시 넣고 실행해 단계 2가 정확히 실패하는지 확인한다.

```bash
cd /Users/junwoobang/workflow/qa-sdk
# 임시 위반 주입 (수동 편집) 후
pnpm sim:smoke:full
```

기대 출력:
```
[sim:smoke:full] ▶ identifier-grammar 라운드트립 (05 §4 #1)
... PASS
[sim:smoke:full] ▶ identifier 정적 lint (host.docker.internal grep ...) (05 §4 #2 + #4)
... host.docker.internal 잔존 (extra_hosts 외)
[sim:smoke:full] ✗ FAIL @ stage=identifier-lint spec=05 §4 #2 + #4 exit=1
[sim:smoke:full] 통과한 단계: grammar-roundtrip
[sim:smoke:full] 진단 가이드: spec 05 §6 분류 트리 — ...
```

확인 후 임시 위반을 되돌린다 (반드시 git diff로 0 라인 차이 검증 후 Step 13.4.4로 진행).

- [ ] **Step 13.4.4: 정상 경로 실행 + green 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm sim:up                                   # docker compose 부팅
pnpm sim:smoke:full | tee /tmp/smoke-full.log
echo "exit=$?"
```

기대: `exit=0` + 마지막 줄에 `전 단계 PASS`. 실패 시 분류 트리에 따라 좁힌다 (spec 05 §6).

- [ ] **Step 13.4.5: Commit**

```bash
git add scripts/sim-smoke-full.ts package.json
git commit -m "feat(scripts): sim:smoke:full — 17 시나리오 + 인프라 검증 6종 통합 entrypoint"
```

### Task 13.5: 1차 사이클 완료 보고서 + 후속 sub-project 인덱스

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md` (DoD + 검증 결과 표 + 후속 인덱스 섹션 채움)
- Modify: `simulations/enterprise-pm/README.md` (1차 사이클 완료 표기 + 후속 sub-project 5종 링크)

본 task는 spec 06 §5 DoD 8개 항목과 spec 06 §4 후속 sub-project 5종을 보고서에 결합한다. 보고서가 채워지고 모든 체크가 OK면 사이클을 닫는다.

- [ ] **Step 13.5.1: DoD 8개 체크리스트 + 검증 결과 표 채움**

`docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md`에 §1 매트릭스 다음으로 추가:

```markdown
## 2. Definition of Done — spec 06 §5

| # | 항목 | 결과 | 증거 |
|---|---|---|---|
| 1 | 13단계 모두 main 머지 | OK / NG | `git log --oneline --grep="단계 [0-9]"` |
| 2 | 17 시나리오 모두 PASS | OK / NG | `pnpm sim:smoke:full` 로그 (Task 13.4) |
| 3 | 인프라 검증 6종 모두 통과 | OK / NG | §1 매트릭스 + smoke 로그 stage `identifier-*` / `catalog-validate` / `eslint-root` |
| 4 | break-glass CLI 4종 단위 테스트 PASS | OK / NG | `pnpm --filter @qa-sdk-sim/canary-cli test` (Plan E 단계 12) |
| 5 | controller 30s 사이클 24시간 무중단 (스모크) | OK / NG | `pnpm sim:controller:soak` 로그 + audit-recorder cycle row 수 |
| 6 | 6개 spec 문서 ↔ 코드 drift 없음 | OK / NG | `pnpm def-doctor` 또는 동등 |
| 7 | README + `00-overview.md`가 변경 영향을 명시 | OK / NG | 본 Step 13.5.3 + spec 00 후기 단락 |
| 8 | 본 보고서 §1·§2·§3가 모두 채워짐 | OK / NG | 본 task |

각 항목의 OK/NG는 사이클 마감 시 운영자가 수동 확정한다. NG 항목이 1건이라도 있으면 본 사이클은 닫지 않고, 해당 항목의 spec/Plan task로 회귀한다.

## 3. 후속 sub-project 인덱스 — spec 06 §4

본 사이클에 흡수되지 않은 5개 항목은 별도 brainstorming → spec → plan 사이클로 진행한다.

| # | 후속 sub-project | 본 사이클 처리 | 후속에서 다룰 범위 |
|---|---|---|---|
| 3 | 일반화된 카오스 매트릭스 | fault-injector 1차 토대 (Plan E 단계 10) | 카오스 시나리오 일반화 — fault 종류 × 대상 서비스 매트릭스, 운영 모드 카오스 게임 데이 |
| 4 | sim-otel-utils의 fetch-with-trace 표준 retry/backoff | controller 내부 retry만 (Plan D 단계 9) | HTTP retry 표준화 — 모든 외부 호출에 일관된 backoff/jitter, trace propagation 결합 |
| 6 | k6 시나리오 매트릭스 + SLO 대시보드 | 시나리오 12에 burst generator 1개 (Plan E 단계 11) | 부하 시나리오 일반화 + SLO 정의 + 대시보드 시각화 |
| 7 | BFF lint rule 일반화 | read DataSource lint 2개 (Task 8.6 + 13.3) | outbox emit 금지 + path prefix 검증 등 BFF 책임 lint 매트릭스 |
| 8 | README MSA·DB·운영 모드 단락 | 본 design 문서 군 (00~06) 자체가 부분 답 | README + 운영자 매뉴얼 — 사이클·escape hatch·복구 절차 단일화 |

각 후속 sub-project는 본 보고가 닫히는 시점에 `docs/proposals/` 또는 후속 `docs/superpowers/specs/` 폴더로 이관한다. 인덱스만 본 보고서에 남기고, 후속 작업의 진척도는 본 보고서가 추적하지 않는다 (스코프 분리).

## 4. cycle close 선언

위 §1 / §2 / §3가 모두 OK이면, 본 보고서 하단에 다음을 기록한다:

```
- closed-at: <ISO8601>
- closed-by: <operator>
- next-cycle-kickoff: <ISO8601 or TBD>
```

closed-at 기록 후에는 본 보고서를 immutable으로 본다. 회귀가 발견되면 새 사이클 spec에서 본 보고를 참조하되 본 보고를 수정하지 않는다.
```

- [ ] **Step 13.5.2: 보고서가 spec 06 §4 / §5 표를 빠짐없이 인용했는지 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk
diff <(grep -E "^\| [0-9]+ \|" docs/superpowers/specs/2026-04-28-canary-scaling/06-roadmap.md | grep -A0 "^| [0-9] |") \
     <(grep -E "^\| [0-9]+ \|" docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md) || true
grep -c "^| [0-9] |" docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md
```

기대: §2 DoD 8행 + §3 후속 5행 = 최소 13행. 누락된 항목이 있으면 본 step에서 보강 후 진행.

- [ ] **Step 13.5.3: simulations/enterprise-pm/README.md 갱신**

`simulations/enterprise-pm/README.md` 상단 또는 "운영 모드" 섹션 직후에 다음 단락 추가:

```markdown
## 1차 사이클 (2026-04-28) 완료

- 사이클 spec: `docs/superpowers/specs/2026-04-28-canary-scaling/`
- 완료 보고: `docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md`
- 검증 entrypoint: `pnpm sim:smoke:full` (17 시나리오 + 인프라 검증 6종)
- escape hatch: `pnpm sim:canary {abort|force-promote|controller stop}`, `pnpm sim:scale set --pin`

후속 sub-project (spec 06 §4) 5종은 별도 brainstorming → spec → plan 사이클로 진행한다.
```

- [ ] **Step 13.5.4: 보고서 + README 함께 commit**

```bash
git add docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md \
        simulations/enterprise-pm/README.md
git commit -m "docs(spec/canary-cycle1): DoD 8 + 후속 sub-project 5 + README 1차 완료 단락"
```

- [ ] **Step 13.5.5: 사이클 close — 운영자 수동 확정**

DoD §2의 8행이 모두 OK인지 운영자가 확인한 후, 보고서 §4의 `closed-at`/`closed-by`를 채우고 별도 commit으로 사이클을 닫는다.

```bash
# 운영자 수동 단계
$EDITOR docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md   # closed-at/closed-by 기록
git add docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md
git commit -m "chore(spec/canary-cycle1): cycle close — DoD 8/8 OK"
```

본 commit 이후 본 사이클은 immutable이다. 회귀 발견 시 새 사이클 spec에서 본 보고를 참조한다 (수정 금지).
