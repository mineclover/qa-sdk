### Task 2.17: catalog 파일 (header-vocabulary, event-vocabulary)

**Files:**
- Create: `simulations/enterprise-pm/contracts/header-vocabulary.catalog.ts`
- Create: `simulations/enterprise-pm/contracts/event-vocabulary.catalog.ts`

- [ ] **Step 2.17.1: header-vocabulary.catalog.ts**

```typescript
// 본 사이클에서 시뮬이 사용하는 custom HTTP 헤더 목록.
// sim-identifier-grammar #4 HTTP header builder가 이 목록만 허용.
export const SIM_HEADER_VOCABULARY = [
  { domain: "service", attr: "version" },        // x-service-version
  { domain: "canary",  attr: "override" },        // x-canary-override
  { domain: "canary",  attr: "stage" },           // x-canary-stage
  { domain: "trace",   attr: "id" },              // x-trace-id
  { domain: "trace",   attr: "decision-id" },     // x-trace-decision-id
  { domain: "sim",     attr: "scenario" },        // x-sim-scenario
] as const;
```

- [ ] **Step 2.17.2: event-vocabulary.catalog.ts**

```typescript
// outbox event name builder(#5) + schemaHash(#6)가 참조하는 도메인/aggregate/verb 사전.
export const SIM_EVENT_VOCABULARY = {
  domains: ["approval", "auth", "pm", "document", "notification"] as const,
  aggregates: {
    approval:     ["budget", "resource", "expense", "time-off"] as const,
    auth:         ["user", "role", "department", "bitmap"] as const,
    pm:           ["project", "task", "member", "assignment"] as const,
    document:     ["document", "comment", "version"] as const,
    notification: ["notification", "subscription"] as const,
  },
  verbsPast: ["submitted", "approved", "rejected", "revised", "cancelled", "completed", "issued"] as const,
} as const;
```

- [ ] **Step 2.17.3: Commit**

```bash
git add simulations/enterprise-pm/contracts/
git commit -m "feat(sim-contracts): header + event vocabulary catalog for grammar"
```

### Task 2.18: 통합 라운드트립 property test

**Files:**
- Create: `packages/sim-identifier-grammar/tests/roundtrip.test.ts`

- [ ] **Step 2.18.1: 모든 builder/parser 쌍 라운드트립 메타 테스트**

`packages/sim-identifier-grammar/tests/roundtrip.test.ts`:

```typescript
import { describe, it } from "vitest";
import * as fc from "fast-check";
import * as G from "../src/index.js";

// 각 builder와 parser 쌍이 build → parse → equal 라운드트립을 만족하는지
// 한 곳에서 메타 테스트한다. 식별자별 단위 테스트는 src/<name>.test.ts에 있다.

describe("identifier grammar roundtrip (meta)", () => {
  it("service prefix #1", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("svc", "slice", "evt", "cache"),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (category, name) => {
          const o = { namespace: "sim", category, name } as const;
          if (G.parseServicePrefix(G.buildServicePrefix(o as any)) === o) return true;
          return JSON.stringify(G.parseServicePrefix(G.buildServicePrefix(o as any))) ===
            JSON.stringify(o);
        },
      ),
      { numRuns: 100 },
    );
  });

  // 나머지 14종도 같은 형식. Task 2.5~2.16 완료 시점에 채운다.
  // 본 step에서는 #1~#3만 채워서 통합 테스트 동작을 확인하고,
  // 후속 Task 2.5~2.16에서 각자 본인 항목을 추가한다.
});
```

- [ ] **Step 2.18.2: 테스트 통과 확인**

```bash
pnpm --filter sim-identifier-grammar test roundtrip
```

기대: 1+ 테스트 PASS.

- [ ] **Step 2.18.3: Commit**

```bash
git add packages/sim-identifier-grammar/tests/roundtrip.test.ts
git commit -m "test(sim-identifier-grammar): integration roundtrip property suite"
```

### Task 2.19: 정적 린트 스크립트

**Files:**
- Create: `scripts/lint-identifiers.ts`
- Modify: `package.json` (root)

- [ ] **Step 2.19.1: 실패 테스트(스모크) — 린터가 실제 위반을 잡는지 확인할 fixture 작성**

본 step에서는 린터의 첫 단순 검사(host.docker.internal 잔존 + image tag 정규식 위반)만 구현한다. 추가 검사(template literal builder 강제 등)는 후속 task로 분리.

`scripts/lint-identifiers.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * sim:lint:identifiers — 시뮬 영역에서 식별자 grammar 위반을 정적 검출.
 * 본 step의 1차본은 다음 위반을 잡는다:
 *  (1) docker-compose.sim.yaml의 image: 가 grammar #3 image tag 정규식을 위반
 *  (2) docker-compose.sim.yaml에 host.docker.internal alias 잔존
 *  (3) compose label 키가 grammar #9 label key 정규식 위반
 *
 * 추가 검사(소스 코드의 template literal 합성 등)는 본 단계 이후로 분리.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { glob } from "tinyglobby";

const ROOT = resolve(__dirname, "..");
const errors: string[] = [];

const IMAGE_TAG_RE = /^([a-z][a-z0-9-]+)\/([a-z0-9-]+):(v[1-9][0-9]*(?:-(candidate|retired))?|latest)$/;
// 본 사이클의 grammar 검증 대상은 시뮬 자체 image (qa-sdk 또는 qa-sdk-sim 레지스트리)에 한함.
// 외부 base image (redis:7-alpine, postgres:16-alpine, node:22 등)는 grammar 적용 대상 아님 — skip.
const SIM_IMAGE_PREFIX_RE = /^qa-sdk(-sim)?\//;
const LABEL_KEY_RE = /^sim\.[a-z][a-z0-9-]{0,30}$/;

const composeFiles = await glob(["simulations/enterprise-pm/docker-compose*.y*ml"], {
  cwd: ROOT,
  absolute: true,
});

for (const file of composeFiles) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.includes("host.docker.internal") && !line.includes("extra_hosts")) {
      errors.push(`${file}:${i + 1} host.docker.internal 잔존 (extra_hosts 외)`);
    }
    const imageMatch = line.match(/^\s*image:\s*(\S+)/);
    if (imageMatch && SIM_IMAGE_PREFIX_RE.test(imageMatch[1]) && !IMAGE_TAG_RE.test(imageMatch[1])) {
      errors.push(`${file}:${i + 1} image tag grammar 위반 (qa-sdk image): ${imageMatch[1]}`);
    }
    const labelMatch = line.match(/^\s+([a-zA-Z][a-zA-Z0-9.-]*):\s*\S+$/);
    if (labelMatch && /^sim\./.test(labelMatch[1]) && !LABEL_KEY_RE.test(labelMatch[1])) {
      errors.push(`${file}:${i + 1} label key grammar 위반: ${labelMatch[1]}`);
    }
  });
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log("identifier grammar lint OK");
```

- [ ] **Step 2.19.2: package.json (root)에 스크립트 추가**

루트 `package.json`의 `"scripts"` 블록에 다음 라인 추가:

```json
"sim:lint:identifiers": "tsx scripts/lint-identifiers.ts"
```

- [ ] **Step 2.19.3: 린트 실행 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm sim:lint:identifiers
```

기대: `identifier grammar lint OK` 출력. 위반이 있으면 정확한 파일:라인 출력.

- [ ] **Step 2.19.4: tinyglobby가 없으면 추가**

```bash
pnpm add -wD tinyglobby
```

만약 워크스페이스 root devDep에 이미 있으면 skip.

- [ ] **Step 2.19.5: Commit**

```bash
git add scripts/lint-identifiers.ts package.json pnpm-lock.yaml
git commit -m "feat(scripts): sim:lint:identifiers — compose grammar checks"
```

### Task 2.20: identifier-gate CI workflow

**Files:**
- Create: `.github/workflows/identifier-gate.yml`

- [ ] **Step 2.20.1: workflow yaml 작성 (def-gate.yml 패턴 그대로)**

`.github/workflows/identifier-gate.yml`:

```yaml
name: identifier-gate

on:
  pull_request:
    paths:
      - 'simulations/enterprise-pm/**'
      - 'packages/sim-identifier-grammar/**'
      - 'scripts/lint-identifiers.ts'
      - '.github/workflows/identifier-gate.yml'
  push:
    branches: [main]
    paths:
      - 'simulations/enterprise-pm/**'
      - 'packages/sim-identifier-grammar/**'
  workflow_dispatch:

concurrency:
  group: identifier-gate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  identifier-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        run: |
          corepack enable
          corepack prepare pnpm@10.30.3 --activate

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.local/share/pnpm/store/v3
          key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-${{ runner.os }}-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build sim-identifier-grammar
        run: pnpm --filter sim-identifier-grammar build

      - name: Typecheck (follow-up #16 — fixture/EventName 정합성)
        run: pnpm --filter sim-identifier-grammar typecheck

      - name: Roundtrip property tests
        run: pnpm --filter sim-identifier-grammar test

      - name: Static identifier lint
        run: pnpm sim:lint:identifiers
```

> **typecheck step 추가 (follow-up #16)**: vitest는 esbuild로 transpile만 하므로 type mismatch 있는 fixture도 runtime PASS. cross-section 정합성 회귀를 차단하려면 `tsc --noEmit`를 별도 step으로 둔다 — 식별자별 builder input 타입과 fixture가 일치 보장.

- [ ] **Step 2.20.2: workflow 문법 검증 (선택, gh act 또는 yamllint)**

```bash
yamllint .github/workflows/identifier-gate.yml || true
```

- [ ] **Step 2.20.3: Commit**

```bash
git add .github/workflows/identifier-gate.yml
git commit -m "ci(identifier-gate): trigger on sim/grammar changes"
```
