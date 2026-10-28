# Track D — Codegen 결정론·Digest 헤더·Drift CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 Catalog에서 codegen을 몇 번 실행해도 같은 바이트가 나오고, 생성물이 어떤 catalog digest·generator version에서 나왔는지 헤더로 추적되며, 커밋된 생성물이 source와 어긋나면 CI가 실패한다.

**Architecture:** 생성 헤더에서 실행 시각을 제거하고 generator version을 넣는다(Task 1, T0 불필요). T0 머지 후 불완전한 `computeCatalogHash`를 T0 `computeCatalogDigest`로 교체하고, drift 판정용 `sourceDigest`(catalog + dkgConfig + generator + options)를 별도로 기록한다. BROWSER_CATALOG 생성기는 core `flattenForBrowser`를 import하고 snapshot 문맥 상수를 함께 생성한다. drift 검사는 "재생성 후 바이트 비교"이며 해시 lockfile을 두지 않는다.

**Tech Stack:** TypeScript, tsup(codegen-core), tsx(viz-3d script), Node 22, GitHub Actions

**Spec:** [README](../README.md) R-4, X-7·X-8·X-16, D-6 / Drive 원본 Phase 4

## Global Constraints

- `generateCatalogTypes()` — 같은 catalog → 같은 출력 (CLAUDE.md Codegen 규칙). 시각·난수·환경 의존 값 금지
- `demo-types`, `BROWSER_CATALOG`는 자동 생성물 — 직접 수정 금지, 이 트랙의 생성기로만 갱신
- CLI는 tsup 단일 번들: 동적 import 금지, 정적 import 사용
- `GENERATION`은 registry `catalogHash`(B Task 4 이후 `shortDigest(catalog digest)`)와 같은 값을 써야 한다 — SDK 비교(`context/src/qa-context.ts`)가 일치하도록
- 생성물 헤더의 digest는 전체 64 hex. 표시용 12자는 `contentHash`/`GENERATION`에만 사용 (D-6)
- `--filter "!pkg"` negation을 workflow YAML에 쓰지 않는다

## Review Focus

1. **dkgConfig만 바뀐 경우** → `catalogDigest`는 같고 `sourceDigest`·`dsl.ts`는 달라지며 drift 검사가 잡는다. 테스트: Task 2 Step 1.
2. **dim kind나 refEntries만 바뀐 catalog** → digest가 달라진다(현재 hash는 놓침). 테스트: Task 2 Step 1.
3. **OS·locale이 다른 머신에서 생성** → 같은 출력 (`localeCompare` 제거). 테스트: Task 1 Step 1 (정렬 비교를 code unit 기준으로 고정).
4. **생성기 버전만 올라간 경우** → 헤더의 generator version이 바뀌어 drift로 잡힘(의도된 재생성 유도). 테스트: Task 1 Step 1.
5. **BROWSER_CATALOG가 core flatten과 다른 결과** → 재구현 제거 후 동치. 테스트: Task 3 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/codegen-core/src/catalog-typescript.ts` (+test) | 헤더 결정론, digest 교체, async 전환 |
| `packages/codegen-core/src/generator-info.ts` (신규) | `GENERATOR_NAME`, `GENERATOR_VERSION` (package.json에서 build 시 주입) |
| `packages/cli/src/commands/codegen.ts` | async 호출, provenance metadata에 digest 기록 |
| `packages/core/src/catalog/browser-flatten.ts` | `BrowserCatalog` 정본 타입, snapshot 문맥 생성 helper |
| `packages/viz-3d/scripts/generate-browser-catalog.ts` | core `flattenForBrowser` 사용, 헤더·문맥 상수 생성 |
| `packages/browser-codec/src/demo-catalog-browser.ts` | 생성물 (재생성) |
| `packages/demo-types/src/**` | 생성물 (재생성) |
| `scripts/catalog-codegen-drift.mjs` (신규) | 재생성 후 바이트 비교 |
| `.github/workflows/codegen-drift.yml` (신규) | drift job |

**Interfaces:**
- Consumes (T0, Task 2부터): `computeCatalogDigest`, `digestCanonical`, `shortDigest`, `LEGACY_V1_CODEC`
- Produces:

```ts
// codegen-core
export const GENERATOR_NAME: 'codegen-core';
export const GENERATOR_VERSION: string;
export interface CatalogCodegenResult {
  files: CatalogCodegenFile[];
  contentHash: string;     // = shortDigest(catalogDigest) — 기존 필드 의미 유지
  catalogDigest: string;   // 'sha256:<64 hex>'
  sourceDigest: string;    // catalog + dkgConfig + generator + options
}
export function generateCatalogTypes(catalog: Catalog, dkgConfig?: DkgConfig, options?: CatalogCodegenOptions): Promise<CatalogCodegenResult>;

// core browser-flatten.ts — 생성물이 export하는 문맥 (B의 CatalogSnapshotWire와 필드 호환, snapshot_version 없음)
export interface BrowserCatalogSnapshot { readonly catalog_id: string; readonly digest: string; readonly codec_version: string }
```

---

### Task 0: Baseline

- [ ] **Step 1:** `cd /Users/junwoobang/workflow/qa-sdk && for p in codegen-core @qa-sdk/cli demo-types @qa-sdk/browser-codec @qa-sdk/viz-3d; do echo "== $p"; corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL" | tail -2; done` → PASS (패키지 이름은 각 `package.json`의 `name`으로 확인)
- [ ] **Step 2: 현재 비결정성 확인** — `node packages/cli/dist/index.js codegen --output "$TMPDIR/cg1"`, 1초 뒤 `--output "$TMPDIR/cg2"`, `diff -r` → 헤더 timestamp 줄만 다름을 기록.

---

### Task 1: 헤더 결정론 (T0 불필요)

**Files:** `packages/codegen-core/src/catalog-typescript.ts`, `packages/codegen-core/src/generator-info.ts`, `packages/codegen-core/src/catalog-typescript.test.ts` (없으면 신규)

- [ ] **Step 1: 실패하는 테스트**

```ts
import { DEMO_CATALOG } from 'demo-snapshot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GENERATOR_NAME, GENERATOR_VERSION } from './generator-info.js';
import { generateCatalogTypes } from './catalog-typescript.js';

describe('generateCatalogTypes 결정론', () => {
  afterEach(() => vi.useRealTimers());

  it('실행 시각이 달라도 출력이 같다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const a = generateCatalogTypes(DEMO_CATALOG);
    vi.setSystemTime(new Date('2027-06-30T12:34:56Z'));
    const b = generateCatalogTypes(DEMO_CATALOG);
    expect(b.files).toEqual(a.files);
  });

  it('헤더에 generator 이름·버전을 기록하고 시각은 기록하지 않는다', () => {
    const { files } = generateCatalogTypes(DEMO_CATALOG);
    for (const f of files) {
      const head = f.content.split('\n').slice(0, 3).join('\n');
      expect(head).toContain(`${GENERATOR_NAME}@${GENERATOR_VERSION}`);
      expect(head).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });
});
```

codegen-core가 `demo-snapshot`을 devDependency로 갖지 않으면 추가한다(codegen-core → demo-snapshot은 순환이 아님: demo-snapshot은 codegen-core에 의존하지 않는지 `grep codegen-core packages/demo-snapshot/package.json`으로 확인).

Run: `corepack pnpm --filter codegen-core exec vitest run src/catalog-typescript.test.ts` → FAIL

- [ ] **Step 2: 구현**

`generator-info.ts`:

```ts
/** 생성물 헤더에 기록하는 generator 식별자. 버전은 package.json과 일치해야 한다 (test로 고정) */
export const GENERATOR_NAME = 'codegen-core' as const;
export const GENERATOR_VERSION = '0.1.0';
```

`generator-info.test.ts`에서 `package.json`을 읽어 `GENERATOR_VERSION`과 같은지 검증한다(빌드 시 주입 대신 테스트로 drift 차단 — tsup 설정 변경 없이 단순 유지).

`catalog-typescript.ts`:
- `header(catalogId, contentHash, timestamp)` → `header(catalogId, contentHash)`: 첫 줄 `// Generated from Catalog "${catalogId}" (hash: ${contentHash}) by ${GENERATOR_NAME}@${GENERATOR_VERSION}`
- `const ts = new Date().toISOString()` 제거, 모든 `gen*` 함수 시그니처에서 `ts` 인자 제거
- `computeCatalogHash`의 `localeCompare` 정렬을 기본 `toSorted()`로 바꾼다(Task 2에서 함수 자체가 교체되지만, Task 1 단독 머지 시에도 locale 독립)

- [ ] **Step 3: 재생성·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter codegen-core build && corepack pnpm --filter @qa-sdk/cli build && corepack pnpm --filter demo-types run generate && corepack pnpm --filter codegen-core test && corepack pnpm --filter demo-types test
git add packages/codegen-core/src packages/codegen-core/package.json packages/demo-types/src
git commit -m "fix(codegen): 생성 헤더에서 시각 제거, generator version 기록"
```

`demo-types/src/lifecycle.test.ts`가 헤더 timestamp 형식을 검사하면 generator version 형식 검사로 바꾼다.

---

### Task 2: T0 digest로 교체 (T0 머지 후)

**Files:** `packages/codegen-core/src/catalog-typescript.ts` (+test), `packages/cli/src/commands/codegen.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

```ts
import { computeCatalogDigest, shortDigest } from '@qa-sdk/core';

it('contentHash는 catalog digest의 표시용 축약이다', async () => {
  const r = await generateCatalogTypes(DEMO_CATALOG);
  expect(r.catalogDigest).toBe(await computeCatalogDigest(DEMO_CATALOG));
  expect(r.contentHash).toBe(shortDigest(r.catalogDigest));
});

it('dim 정의만 바뀌어도 catalogDigest가 바뀐다', async () => {
  const changed = structuredClone(DEMO_CATALOG);
  const [prefixId, prefix] = Object.entries(changed.prefixes).find(([, p]) => p.versions.some((v) => v.refEntries))!;
  const version = prefix.versions.find((v) => v.refEntries)!;
  const [label] = Object.keys(version.refEntries!);
  (version.refEntries as Record<string, { values: number[] }>)[label].values = [...version.refEntries![label].values].reverse();
  expect((await generateCatalogTypes(changed)).catalogDigest).not.toBe((await generateCatalogTypes(DEMO_CATALOG)).catalogDigest);
  expect(prefixId).toBeTruthy();
});

it('dkgConfig만 바뀌면 catalogDigest는 같고 sourceDigest는 다르다', async () => {
  const a = await generateCatalogTypes(DEMO_CATALOG, { constraints: [] } as never);
  const b = await generateCatalogTypes(DEMO_CATALOG, { constraints: [{ id: 'X' }] } as never);
  expect(b.catalogDigest).toBe(a.catalogDigest);
  expect(b.sourceDigest).not.toBe(a.sourceDigest);
});
```

`dkgConfig` 최소 형태는 `DkgConfig` 타입의 필수 필드에 맞춘다(`packages/core/src/catalog/dkg-config.types.ts`). Task 1 테스트의 동기 호출은 `await`로 바꾼다.

- [ ] **Step 2: 구현**
  - `generateCatalogTypes`를 `async`로 바꾼다. 호출부는 `packages/cli/src/commands/codegen.ts` 하나뿐이다(`grep -rn "generateCatalogTypes(" packages --include='*.ts'`로 재확인).
  - `computeCatalogHash` 삭제. `catalogDigest = await computeCatalogDigest(catalog)`, `contentHash = shortDigest(catalogDigest)`, `sourceDigest = await digestCanonical({ catalog, dkgConfig: dkgConfig ?? null, generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION }, options: options ?? {} })`.
  - 헤더 2번째 줄에 `// catalogDigest: ${catalogDigest} · sourceDigest: ${sourceDigest}` 추가.
  - `prefix-ids.ts`의 `VERSION_META`에 `catalogDigest`, `codecVersion: LEGACY_V1_CODEC` 추가. `GENERATION`은 `${catalogId}:${contentHash}` 유지(이제 registry 값과 같은 알고리즘).
  - CLI `codegen.ts`: `await generateCatalogTypes(...)`, `maybeWriteCodegenArtifactRegistryRecords`의 `metadata`에 `catalogDigest`, `sourceDigest` 추가.
- [ ] **Step 3: 재생성·검증·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter codegen-core build && corepack pnpm --filter @qa-sdk/cli build && corepack pnpm --filter demo-types run generate && corepack pnpm --filter codegen-core test && corepack pnpm --filter @qa-sdk/cli test && corepack pnpm --filter demo-types test
git add packages/codegen-core/src packages/cli/src/commands/codegen.ts packages/demo-types/src
git commit -m "feat(codegen): catalog digest·source digest를 생성물에 기록"
```

---

### Task 3: BROWSER_CATALOG 생성기 통합

**Files:** `packages/core/src/catalog/browser-flatten.ts` (+ `browser-flatten.test.ts` 신규), `packages/viz-3d/scripts/generate-browser-catalog.ts`, `packages/browser-codec/src/demo-catalog-browser.ts`

- [ ] **Step 1: 실패하는 테스트 (core)**

```ts
import { describe, expect, it } from 'vitest';
import { flattenForBrowser } from './browser-flatten.js';
import { SNAPSHOT_FIXTURE } from './snapshot/__fixtures__/snapshot-fixture.js';

describe('flattenForBrowser', () => {
  it('prefix마다 최신 version 하나와 고정 차원만 담는다', () => {
    const flat = flattenForBrowser(SNAPSHOT_FIXTURE);
    expect(flat.svc.version).toBe('v2');
    expect(flat.svc.labels).toEqual(['env', 'role']);
    expect(flat.svc.dims.env).toMatchObject({ kind: 'axis', entries: ['dev', 'prod', 'stage'], capacity: 4 });
  });
});
```

(현재 `flattenForBrowser`는 테스트가 0건이다 — 00-code-inventory §5 참고.)

생성기 동치 테스트: viz-3d에 `scripts/generate-browser-catalog.test.ts`를 추가해, 현재 커밋된 `demo-catalog-browser.ts`의 `BROWSER_CATALOG`와 `flattenForBrowser(DEMO_CATALOG)`가 `toEqual`인지 검사한다. 다르면 차이를 PR에 기록한다(재구현이 이미 drift했다는 뜻).

- [ ] **Step 2: 구현**
  - `browser-flatten.ts`: `BrowserCatalogSnapshot` 인터페이스와 `browserCatalogSnapshotOf(catalog): Promise<BrowserCatalogSnapshot>`(= `{ catalog_id, digest: await computeCatalogDigest(catalog), codec_version: LEGACY_V1_CODEC }`) 추가. `latestPrefixVersion` 인라인(:57)을 runtime import로 교체.
  - 생성 스크립트: 로컬 `BrowserDimDef`/`BrowserPrefixDef`/`BrowserCatalog`/`flattenForBrowser` 삭제, `@qa-sdk/core`에서 import. 출력 파일 헤더를 codegen-core와 같은 형식(`by generate-browser-catalog@<viz-3d version>`, `catalogDigest`)으로 쓰고 `export const BROWSER_CATALOG_SNAPSHOT: BrowserCatalogSnapshot = {...}`를 함께 생성.
  - browser-codec의 `BrowserCatalog` 타입 import 교체는 Track A 소유 파일이므로 여기서 하지 않는다. 머지 후 A에 알린다([01-tracks.md](../01-tracks.md) §3.1).
- [ ] **Step 3: 재생성·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter @qa-sdk/viz-3d run prebuild && corepack pnpm --filter @qa-sdk/core test && corepack pnpm --filter @qa-sdk/browser-codec test && corepack pnpm --filter @qa-sdk/viz-3d test
git add packages/core/src/catalog/browser-flatten.ts packages/core/src/catalog/browser-flatten.test.ts packages/viz-3d/scripts packages/browser-codec/src/demo-catalog-browser.ts
git commit -m "refactor(codegen): BROWSER_CATALOG 생성기가 core flattenForBrowser를 사용"
```

---

### Task 4: Drift 검사와 CI

**Files:** `scripts/catalog-codegen-drift.mjs` (신규), `package.json` (root script), `.github/workflows/codegen-drift.yml` (신규)

- [ ] **Step 1: 스크립트 작성** — `scripts/tax-codegen-drift.mjs`의 구조(dist import, 결과 출력, exit code)를 따르되 해시 lockfile 대신 **재생성 후 바이트 비교**:
  1. `packages/cli/dist/index.js codegen --output <tmp>/demo-types` 실행 (`node:child_process` `execFileSync`)
  2. `<tmp>`의 각 파일을 `packages/demo-types/src/`의 같은 이름 파일과 비교 (생성 대상 파일 목록은 `<tmp>` 디렉토리 listing에서 파생)
  3. viz-3d 생성기를 출력 경로 인자(`--out <tmp>/demo-catalog-browser.ts`, Task 3에서 인자 지원 추가)로 실행 후 `packages/browser-codec/src/demo-catalog-browser.ts`와 비교
  4. 다른 파일이 있으면 경로 목록과 "`pnpm codegen:update`로 재생성 후 커밋" 안내를 출력하고 `exit 1`
- [ ] **Step 2:** root `package.json`에 `"codegen:check": "node scripts/catalog-codegen-drift.mjs"`, `"codegen:update": "pnpm --filter demo-types run generate && pnpm --filter @qa-sdk/viz-3d run prebuild"`.
- [ ] **Step 3: workflow**

```yaml
name: codegen drift

on:
  pull_request:
    paths:
      - 'packages/demo-snapshot/**'
      - 'packages/codegen-core/**'
      - 'packages/core/src/catalog/**'
      - 'packages/demo-types/src/**'
      - 'packages/browser-codec/src/demo-catalog-browser.ts'
      - 'packages/viz-3d/scripts/**'
      - 'scripts/catalog-codegen-drift.mjs'
      - '.github/workflows/codegen-drift.yml'
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: |
          corepack enable
          corepack prepare pnpm@11.28.6 --activate
      - run: pnpm install --filter '@qa-sdk/cli...' --filter '@qa-sdk/viz-3d...' --frozen-lockfile
      - run: pnpm --workspace-concurrency=1 --filter '@qa-sdk/cli...' run build
      - run: node scripts/catalog-codegen-drift.mjs
```

- [ ] **Step 4: 검증** — 로컬에서 `pnpm codegen:check` PASS. `packages/demo-types/src/axes.ts`에 공백 1줄을 추가하고 다시 실행해 FAIL과 파일 경로 출력을 확인한 뒤 되돌린다(직접 편집으로 되돌리기, git restore 금지).
- [ ] **Step 5: Commit** — `ci: catalog codegen drift 검사 추가`

---

### Task 5: 미사용 codegen 패키지 판정 (X-16)

- [ ] **Step 1:** `grep -rn "data-object-codegen\|track-codegen" packages --include='*.ts' --include='package.json' | grep -v node_modules`로 소비처를 다시 센다.
- [ ] **Step 2:** 결과와 공개 API 영향(외부 npm 소비 여부 — Verdaccio publish 목록 확인)을 00-code-inventory X-16에 기록하고, 삭제 여부는 사람에게 결정을 요청한다. 이 Task에서는 삭제하지 않는다.
