# VisBug Phase B'1 — 모더나이즈 Implementation Plan

> **Status: 완료 (2026-04-27)** — 모든 Task 실행 + main 머지. vendor SHA `030e115`, monorepo SHA `5759736b`. playwright 56/57 PASS (1건 font 회귀는 FU-2에서 해결).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `vendor/projectvisbug` 빌드/테스트 toolchain을 modern 도구로 교체. 기존 동작 보존.

**Architecture:** Rollup 2 → 4, PostCSS 7 → 8, ava 1.4 → @playwright/test, puppeteer 10 제거. extension/ 및 VisBug/(Xcode)는 손대지 않음. npm 자율(독립) 유지. 산출물 `app/bundle.js` / `app/bundle.min.js` 동일 경로 보존.

**Tech Stack:** Node 20+, npm, Rollup 4, @rollup/plugin-node-resolve, @rollup/plugin-terser, rollup-plugin-postcss 4, PostCSS 8, postcss-cli 11, postcss-import 16, postcss-preset-env 9, @playwright/test 1.50+, browser-sync.

**Spec reference:** `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md` Phase B'1.

**Working directory:** All paths are absolute. Commands assume `cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug`.

---

## File Structure

**Modify:**
- `vendor/projectvisbug/package.json` — devDependencies, scripts
- `vendor/projectvisbug/rollup.config.mjs` — plugin imports
- `vendor/projectvisbug/postcss.config.js` — preset-env stage 옵션
- `vendor/projectvisbug/tests/helpers.js` — puppeteer → playwright API
- `vendor/projectvisbug/app/features/{padding,margin,font,text,move,flex,position,boxshadow,guides,metatip,selectable,accessibility}.test.js` — ava → @playwright/test API (12 files)

**Create:**
- `vendor/projectvisbug/playwright.config.mjs` — playwright runner config
- `vendor/projectvisbug/vitest.config.mjs` — vitest 설정 (Phase B'2 대비, 빈 src 패턴)
- `vendor/projectvisbug/.nvmrc` — Node 20

**Delete:**
- 없음 (빈 파일 삭제 없음)

---

## Task 1: 백업 브랜치 생성 및 baseline 확인

**Files:**
- Modify: `vendor/projectvisbug/` (no file change, branch only)

- [ ] **Step 1: 작업 브랜치 생성**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git checkout -b feature/phase-b1-modernization
git status
```

Expected: branch switched to `feature/phase-b1-modernization`, working tree clean.

- [ ] **Step 2: 현재 npm install 시도 baseline 기록**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm install 2>&1 | tail -30
```

Expected: 일부 deprecated 경고 발생 가능. install 자체는 성공해야 함. 실패 시 출력 캡처해 plan 다음 단계로 진행 (이후 단계가 deps를 새로 깔기 때문).

- [ ] **Step 3: 현재 빌드 상태 기록**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm run bundle 2>&1 | tail -20
ls -la app/bundle.js 2>/dev/null && echo "OK: bundle.js exists"
```

Expected: build 결과 기록 (성공이든 실패든). 실패 시 그 자체가 모더나이즈 사유.

- [ ] **Step 4: Commit 진행 안 함 (baseline은 기록만)**

진행 노트만 console에 남기고 다음 task로.

---

## Task 2: package.json deps 갱신

**Files:**
- Modify: `vendor/projectvisbug/package.json`

- [ ] **Step 1: package.json 백업 후 갱신**

`vendor/projectvisbug/package.json` 파일을 다음 내용으로 변경:

```json
{
  "name": "VisBug",
  "version": "0.4.10-fork.0",
  "description": "Forked VisBug for qa-sdk measurement evaluation",
  "author": "Adam Argyle (upstream); qa-sdk fork",
  "license": "Apache-2.0",
  "type": "module",
  "main": "app/components/vis-bug/vis-bug.element.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/mineclover/ProjectVisBug.git"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "npm run concurrent",
    "concurrent": "concurrently --kill-others \"npm run dev:js\" \"npm run dev:css\" \"npm run dev:server\"",
    "bundle": "rollup -c && postcss app/index.css -o app/bundle.css",
    "bundle:prod": "rollup -c --environment build:prod",
    "dev:js": "rollup -c -w --environment build:dev",
    "dev:css": "postcss app/index.css -o app/bundle.css -w",
    "dev:server": "browser-sync start --server \"app\" --files \"app/index.html,app/bundle.css,app/bundle.js\" --no-open --no-notify --no-ui --no-ghost-mode",
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:server": "browser-sync start --server \"app\" --files \"app/index.html,app/bundle.css,app/bundle.js\" --no-open --no-notify --no-ui --no-ghost-mode",
    "test:ci": "start-server-and-test test:server http://localhost:3000 test"
  },
  "dependencies": {
    "@ctrl/tinycolor": "^4.1.0",
    "blingblingjs": "^2.3.0",
    "colorjs.io": "^0.5.2",
    "construct-style-sheets-polyfill": "^3.1.0",
    "hotkeys-js": "^3.13.7",
    "query-selector-shadow-dom": "^1.0.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@rollup/plugin-node-resolve": "^15.3.0",
    "@rollup/plugin-terser": "^0.4.4",
    "browser-sync": "^3.0.3",
    "concurrently": "^9.0.1",
    "open-props": "^1.7.0",
    "postcss": "^8.4.47",
    "postcss-cli": "^11.0.0",
    "postcss-import": "^16.1.0",
    "postcss-preset-env": "^9.6.0",
    "rollup": "^4.24.0",
    "rollup-plugin-postcss": "^4.0.2",
    "start-server-and-test": "^2.0.8",
    "vitest": "^2.1.0"
  }
}
```

주요 변경:
- ava, esm, puppeteer, web-ext, ragrid 제거 (web-ext는 extension 전용, scope 외)
- extension:* 스크립트 전부 제거 (scope 외)
- deploy 스크립트 제거 (gcloud 의존, scope 외)
- bump 스크립트 제거 (postversion 훅이 extension 의존)
- `"type": "module"` 추가 (ESM 명시)
- `engines.node` 명시
- vitest 추가 (Phase B'2 대비)
- @rollup/plugin-* scoped 패키지로 교체

- [ ] **Step 2: lockfile 정리 + install**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
rm -rf node_modules package-lock.json
npm install
```

Expected: 모든 패키지 설치 성공. 경고는 허용. 에러 시 출력 보고 후속 단계 결정.

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add package.json package-lock.json
git commit -m "chore: modernize deps (rollup 4, postcss 8, playwright, vitest)"
```

---

## Task 3: rollup.config.mjs 업그레이드

**Files:**
- Modify: `vendor/projectvisbug/rollup.config.mjs`

- [ ] **Step 1: 새 plugin 임포트로 교체**

`vendor/projectvisbug/rollup.config.mjs` 전체 내용을 다음으로 교체:

```js
import { nodeResolve } from '@rollup/plugin-node-resolve'
import postcss from 'rollup-plugin-postcss'
import terser from '@rollup/plugin-terser'

const isProd = process.env.build === 'prod'

const plugins = [
  nodeResolve({
    browser: true,
  }),
  postcss({
    extract: false,
    inject: false,
  }),
  ...(isProd ? [terser()] : []),
]

export default {
  input: 'app/index.js',
  output: {
    file: isProd ? 'app/bundle.min.js' : 'app/bundle.js',
    format: 'es',
    sourcemap: isProd ? false : 'inline',
  },
  plugins,
  watch: {
    exclude: ['node_modules/**'],
  },
}
```

주요 변경:
- `rollup-plugin-node-resolve` (deprecated, default export) → `@rollup/plugin-node-resolve` (named export `nodeResolve`)
- `rollup-plugin-terser` (unmaintained, named export) → `@rollup/plugin-terser` (default export)
- `resolve({jsnext: true})` (rollup 1 시절 옵션) → `nodeResolve({browser: true})` (현대 권장)
- `sourcemap: null` (rollup 4 invalid) → `sourcemap: false`

- [ ] **Step 2: dev build 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx rollup -c
ls -la app/bundle.js && head -5 app/bundle.js
```

Expected: `app/bundle.js` 생성. inline sourcemap 포함. 첫 줄에 import 또는 const 등 ES 모듈 코드.

- [ ] **Step 3: prod build 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx rollup -c --environment build:prod
ls -la app/bundle.min.js && wc -c app/bundle.min.js
```

Expected: `app/bundle.min.js` 생성. terser 처리되어 dev bundle보다 작음. sourcemap 없음.

- [ ] **Step 4: 빌드 실패 시 진단**

빌드 실패하면 다음 순서로 진단:
1. import 경로 오류 — 에러 메시지의 파일 위치 확인
2. CommonJS interop 필요성 — `@rollup/plugin-commonjs` 추가 검토 (현재 deps는 모두 ESM이라 불필요할 가능성 높음)
3. `app/index.js`가 가리키는 모듈 누락 — `npm install` 재실행

수정 후 Step 2-3 재실행.

- [ ] **Step 5: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add rollup.config.mjs
git commit -m "chore(build): rollup 2 → 4, scoped plugin packages"
```

---

## Task 4: postcss.config.js 업그레이드

**Files:**
- Modify: `vendor/projectvisbug/postcss.config.js`

- [ ] **Step 1: ESM 형태로 재작성**

`vendor/projectvisbug/postcss.config.js`를 `vendor/projectvisbug/postcss.config.mjs`로 이름 변경 + 내용 교체:

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git mv postcss.config.js postcss.config.mjs
```

`vendor/projectvisbug/postcss.config.mjs` 내용:

```js
import postcssImport from 'postcss-import'
import postcssPresetEnv from 'postcss-preset-env'

export default {
  plugins: [
    postcssImport(),
    postcssPresetEnv({
      stage: 2,
      browsers: [
        'chrome >= 86',
        'firefox >= 79',
        'safari >= 14.1',
        'edge >= 86',
      ],
    }),
  ],
}
```

주요 변경:
- CJS `require` → ESM `import` (package.json `type: module` 일관성)
- `stage: 0` (실험적 전부 허용) → `stage: 2` (브라우저 지원선 명확)
- browsers를 spec의 지원선과 일치 (Chrome 86+, Firefox 79+, Safari 14.1+, Edge 86+)

- [ ] **Step 2: CSS 빌드 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx postcss app/index.css -o app/bundle.css
ls -la app/bundle.css && head -10 app/bundle.css
```

Expected: `app/bundle.css` 생성. CSS 코드 포함.

- [ ] **Step 3: extension.css도 빌드 (extension 폴더 산출물은 검증만, 운영 X)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx postcss app/extension.css -o /tmp/extension-test.css 2>&1 | tail -10
```

Expected: 성공 또는 명확한 에러. 실패 시 README에 "extension CSS는 후속" 문서화 (스코프 외).

- [ ] **Step 4: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add postcss.config.mjs
git commit -m "chore(build): postcss 7 → 8, ESM config, browser support 명시"
```

---

## Task 5: playwright.config.mjs 작성

**Files:**
- Create: `vendor/projectvisbug/playwright.config.mjs`

- [ ] **Step 1: playwright config 작성**

`vendor/projectvisbug/playwright.config.mjs` 파일 생성:

```js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './app/features',
  testMatch: /.*\.test\.js$/,
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run test:server',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
```

주요 결정:
- `testDir: './app/features'` — 기존 feature 테스트와 동일 위치
- `testMatch: /.*\.test\.js$/` — ava 시절 패턴 보존
- `workers: 1` + `fullyParallel: false` — visbug 토글이 single instance에 의존 (multi-tab 충돌 방지)
- `webServer` — playwright가 자동으로 browser-sync 띄움 (수동 띄울 필요 X)

- [ ] **Step 2: chromium 브라우저 설치**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx playwright install chromium
```

Expected: chromium 다운로드 완료. 시간 소요 가능.

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add playwright.config.mjs
git commit -m "chore(test): add playwright config (chromium only, single worker)"
```

---

## Task 6: tests/helpers.js를 playwright fixture로 재작성

**Files:**
- Modify: `vendor/projectvisbug/tests/helpers.js`

- [ ] **Step 1: helpers.js를 playwright fixture로 교체**

`vendor/projectvisbug/tests/helpers.js` 전체를 다음으로 교체:

```js
import { test as base, expect } from '@playwright/test'

/**
 * @typedef {Object} VisBugFixtures
 * @property {import('@playwright/test').Page} visbugPage
 */

/** @type {ReturnType<typeof base.extend<VisBugFixtures>>} */
export const test = base.extend({
  visbugPage: async ({ page }, use) => {
    await page.goto('/')
    await page.evaluate(() => document.body.setAttribute('testing', 'true'))
    await page.waitForSelector('vis-bug')
    await use(page)
  },
})

export { expect }

export const changeMode = async ({ page, tool }) => {
  await page.evaluate((toolName) => {
    const visbug = document.querySelector('vis-bug')
    const li = visbug.$shadow.querySelector(`li[data-tool=${toolName}]`)
    const evt = document.createEvent('MouseEvents')
    evt.initEvent('mouseup', true, true)
    li.dispatchEvent(evt)
  }, tool)
}

export const getActiveTool = async (page) =>
  await page.$eval('vis-bug', (el) => el.activeTool)

export const metaKey = async (page) => {
  const isMac = await page.evaluate(() => window.navigator.platform.includes('Mac'))
  return isMac ? 'Meta' : 'Control'
}
```

주요 변경:
- `puppeteer.launch` 제거 — playwright가 browser/context/page를 fixture로 제공
- `setupPptrTab` / `teardownPptrTab` → `visbugPage` fixture (자동 setup/teardown)
- `evaluateHandle` 문자열 형식 → `evaluate(fn, arg)` 형식 (typesafe)
- `pptrMetaKey` → `metaKey`

- [ ] **Step 2: 임시 import 검증 (실제 테스트 안 돌림)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
node -e "import('./tests/helpers.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'test', 'expect', 'changeMode', 'getActiveTool', 'metaKey' ]` 출력.

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add tests/helpers.js
git commit -m "chore(test): rewrite helpers as playwright fixture"
```

---

## Task 7: padding.test.js를 playwright API로 마이그레이션 (proof)

**Files:**
- Modify: `vendor/projectvisbug/app/features/padding.test.js`

- [ ] **Step 1: padding.test.js 전체 재작성**

`vendor/projectvisbug/app/features/padding.test.js`를 다음으로 교체:

```js
import { test, expect, changeMode, getActiveTool } from '../../tests/helpers.js'

const tool = 'padding'
const test_selector = '[intro] b'

const getPaddingTop = (page) =>
  page.$eval(test_selector, (el) => el.style.paddingTop)

test.beforeEach(async ({ visbugPage }) => {
  await changeMode({ tool, page: visbugPage })
})

test('Can Be Activated', async ({ visbugPage }) => {
  expect(await getActiveTool(visbugPage)).toBe(tool)
})

test('Can Be Deactivated', async ({ visbugPage }) => {
  expect(await getActiveTool(visbugPage)).toBe(tool)
  await changeMode({ tool: 'margin', page: visbugPage })
  expect(await getActiveTool(visbugPage)).toBe('margin')
})

test('Adds padding to side', async ({ visbugPage }) => {
  await visbugPage.click(test_selector)
  expect(await getPaddingTop(visbugPage)).toBe('')

  await visbugPage.keyboard.press('ArrowUp')
  expect(await getPaddingTop(visbugPage)).toBe('1px')
})

test('Removes padding from side', async ({ visbugPage }) => {
  await visbugPage.click(test_selector)
  expect(await getPaddingTop(visbugPage)).toBe('')

  await visbugPage.keyboard.press('ArrowUp')
  expect(await getPaddingTop(visbugPage)).toBe('1px')

  await visbugPage.keyboard.press('ArrowDown')
  expect(await getPaddingTop(visbugPage)).toBe('0px')
})
```

주요 변경:
- `import test from 'ava'` → `import { test, expect, ... } from '../../tests/helpers.js'`
- `t.context.page` → `visbugPage` fixture
- `t.is(a, b)` → `expect(a).toBe(b)`
- `t.pass()` 제거 (playwright는 implicit pass)

원본 파일에서 더 많은 테스트가 있을 수 있음 — 원본을 끝까지 읽고 위 패턴으로 1:1 변환.

- [ ] **Step 2: padding 테스트만 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx playwright test app/features/padding.test.js
```

Expected: 모든 padding 테스트 PASS. 실패 시 에러 출력 캡처해 다음 단계 진행:
- `vis-bug` 셀렉터 못 찾음 → bundle.js 빌드 안 됨 → Task 3 재확인
- `[intro] b` 못 찾음 → app/index.html 구조 변경 의심 → 원본 그대로 두고 진단
- `activeTool` undefined → vis-bug.element.js 변경 없는데 깨짐 → playwright 환경 차이

- [ ] **Step 3: Commit (테스트 통과 시에만)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add app/features/padding.test.js
git commit -m "test(padding): migrate from ava+puppeteer to playwright"
```

테스트 실패 시 commit 금지. 디버깅 후 재시도.

---

## Task 8: 나머지 11개 테스트 파일 마이그레이션

**Files:**
- Modify: `vendor/projectvisbug/app/features/{margin,font,text,move,flex,position,boxshadow,guides,metatip,selectable,accessibility}.test.js` (11 files)

- [ ] **Step 1: 마이그레이션 패턴 적용 (파일별로 반복)**

각 `*.test.js` 파일에 Task 7 Step 1과 동일한 패턴 적용:

1. `import test from 'ava'` 제거
2. `import { ... } from '../../tests/helpers'` (확장자 없음) → `import { test, expect, changeMode, getActiveTool, metaKey } from '../../tests/helpers.js'` (확장자 추가, 필요한 것만)
3. `setupPptrTab` / `teardownPptrTab` 호출 제거 (fixture가 처리)
4. `t.context.page` → `visbugPage`
5. `test.beforeEach(async t => { ... })` → `test.beforeEach(async ({ visbugPage }) => { ... })`
6. `test('name', async t => { ... })` → `test('name', async ({ visbugPage }) => { ... })`
7. `t.is(a, b)` → `expect(a).toBe(b)`
8. `t.true(x)` → `expect(x).toBe(true)`
9. `t.false(x)` → `expect(x).toBe(false)`
10. `t.deepEqual(a, b)` → `expect(a).toEqual(b)`
11. `t.pass()` 삭제
12. `pptrMetaKey` → `metaKey`

각 파일 작업 후 즉시 단일 파일 테스트:

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx playwright test app/features/margin.test.js
```

(파일명만 바꿔 12개 모두 진행)

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx playwright test
```

Expected: 12개 파일 전부 PASS. 실패 케이스가 있으면:
1. 실패 테스트가 마이그레이션 오류인지 (코드 패턴 잘못 변환) — 수정
2. 실패 테스트가 원본부터 깨져있던 케이스인지 — git log 확인 후 spec 외 처리 결정
3. flake (간헐 실패) — `workers: 1`이라 드물지만, retry 설정 검토

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add app/features/*.test.js
git commit -m "test: migrate all 12 feature tests to playwright"
```

---

## Task 9: vitest 설정 추가 (Phase B'2 대비)

**Files:**
- Create: `vendor/projectvisbug/vitest.config.mjs`

- [ ] **Step 1: vitest config 작성**

`vendor/projectvisbug/vitest.config.mjs` 파일 생성:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['app/edit-log/**/*.spec.js'],
    environment: 'jsdom',
    globals: false,
  },
})
```

주요 결정:
- `include` 패턴은 Phase B'2에서 만들 `app/edit-log/*.spec.js`만 매치 (`*.test.js`는 playwright 영역)
- `environment: 'jsdom'` — DOM 흉내가 필요한 단위 테스트용
- `globals: false` — `import { describe, it, expect } from 'vitest'` 명시

- [ ] **Step 2: jsdom 추가**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm install --save-dev jsdom
```

Expected: jsdom 설치. package.json devDependencies에 추가됨.

- [ ] **Step 3: 빈 vitest 실행 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx vitest run
```

Expected: "No test files found" 메시지로 정상 종료 (exit 0). edit-log 디렉터리 아직 없음.

- [ ] **Step 4: package.json scripts에 vitest 추가**

`vendor/projectvisbug/package.json`의 `scripts` 섹션에 다음 라인 추가:

```json
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
```

`"test"` 라인 바로 앞에 위치.

- [ ] **Step 5: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add vitest.config.mjs package.json package-lock.json
git commit -m "chore(test): add vitest config for upcoming edit-log unit tests"
```

---

## Task 10: .nvmrc 추가 + README 업데이트

**Files:**
- Create: `vendor/projectvisbug/.nvmrc`
- Modify: `vendor/projectvisbug/readme.md`

- [ ] **Step 1: .nvmrc 작성**

`vendor/projectvisbug/.nvmrc`:

```
20
```

- [ ] **Step 2: readme.md에 fork 노트 추가**

`vendor/projectvisbug/readme.md` 파일 맨 위에 다음 섹션 삽입 (기존 `<p align="center">` 위):

```markdown
> **qa-sdk fork notice (2026-04-27)**
>
> 이 fork는 qa-sdk 모노레포의 측정 도구 평가를 위해 모더나이즈됨.
> - Build: rollup 4 / postcss 8
> - Tests: @playwright/test (e2e), vitest (unit, edit-log only)
> - Node: 20+
> - **Out of scope**: Chrome/Firefox/Safari/Edge extension builds, Xcode VisBug app — 후속 작업 예정
> - Upstream 환원 의도 없음 (사적 변경)

---

```

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git add .nvmrc readme.md
git commit -m "docs: add .nvmrc and fork notice"
```

---

## Task 11: 통합 검증

**Files:** (검증만, 변경 없음)

- [ ] **Step 1: clean install + 전체 빌드 + 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
rm -rf node_modules
npm install
npm run bundle
npm run bundle:prod
npm run test:unit
npx playwright test
```

Expected:
- 모든 명령 exit 0
- `app/bundle.js`, `app/bundle.min.js`, `app/bundle.css` 생성
- vitest: 0 tests (정상)
- playwright: 12 파일 전부 PASS

- [ ] **Step 2: vendor 산출물 git 상태 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git status
```

Expected: working tree clean (바운들 산출물이 .gitignore에 포함되어 있어야 함). 만약 `app/bundle.js`가 untracked로 나오면 원본 .gitignore 정책 확인 후 결정 (원본은 dev artifact를 commit하지 않는 것이 일반적).

- [ ] **Step 3: monorepo 부모에서 submodule pointer 갱신**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git status
git add vendor/projectvisbug
git commit -m "chore(vendor): bump projectvisbug to phase-b1-modernization HEAD"
```

Expected: monorepo 측에서 submodule HEAD 갱신 commit 생성.

- [ ] **Step 4: 최종 sanity**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git submodule status
```

Expected: vendor/projectvisbug의 commit hash가 새 모더나이즈 HEAD와 일치.

---

## Self-Review Notes (작성자 체크)

**Spec coverage:**
- ✅ rollup 2 → 4 (Task 3)
- ✅ ava → playwright (Tasks 5-8)
- ✅ postcss 8 (Task 4)
- ✅ puppeteer 제거, playwright (Tasks 5-6)
- ✅ vitest 준비 (Task 9, B'2 대비)
- ✅ extension/Xcode skip (Task 10 README)
- ✅ npm 자율 유지 (workspace 진입 X)
- ✅ Node 20+ (Task 10 .nvmrc)
- ✅ 산출물 경로 보존 (`app/bundle.js`, `app/bundle.min.js`)

**Out of plan (의도적 누락):**
- TypeScript 도입 — visbug 내부는 JS 유지 (spec 결정)
- ESLint/prettier 설정 — 모더나이즈 스코프 외 (별도 PR 가능)
- npm-shrinkwrap → package-lock — 이미 lock 사용 중

**위험 요소:**
- 일부 ava 테스트가 puppeteer 특정 API에 의존 시 마이그레이션 깨질 수 있음 → Task 7에서 padding으로 검증 후 패턴 확립
- rollup 4가 내부적으로 commonjs interop 요구 시 추가 플러그인 필요 → Task 3 Step 4 진단 절차에서 처리
