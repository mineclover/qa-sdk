# VisBug 모더나이즈 + edit-log 통합 설계

> 2026-04-27. ProjectVisBug fork(`vendor/projectvisbug`)를 모더나이즈하고, 사용자 편집을 기록·노출하는 edit-log 기능을 추가하여 rlsc/pretext의 측정 도구로 평가한다.

## 목적

1. **인간 인텐트 신호 캡처** — 디자이너가 visbug로 page를 어떻게 바꾸려 하는지를 구조화된 엔트리로 기록한다. rlsc(자동 측정)와 결합하여 "현재 구조 ↔ 원하는 변경" 신호를 얻는다.
2. **측정 도구로서의 평가 기반** — visbug Web Component를 rlsc/pretext 평가 파이프라인에서 host로 삼아 소비할 수 있는 표준 API 표면을 제공한다.
3. **빌드/테스트 토대 정리** — 오래된 rollup 2/ava 1.4/postcss 7/puppeteer 10 스택을 modern 도구로 교체해 신규 코드 작성 비용을 낮춘다.

## 라이브러리 역할

| 라이브러리 | 위치 | 역할 |
|---|---|---|
| `@chenglou/pretext` | `node_modules` (외부 OSS) | DOM 없는 멀티라인 텍스트 측정. 측정 ground truth |
| `rlsc` | `packages/rlsc` | DOM/레이아웃 수집 → grid/relation/pattern/intent 좌표계 DSL. text-occupancy에서 pretext 위임 |
| `vendor/projectvisbug` (fork) | `vendor/` | 브라우저 in-page DOM/CSS 편집기. 본 스펙으로 **사용자 편집 인텐트 emitter** 역할 추가 |
| `visbug-bridge` (신규) | `packages/visbug-bridge` | qa-sdk 측 단일 진입점. visbug Web Component 마운트 + typed listener wiring |

### 통합 그림

```
[측정 대상 페이지 DOM]
   │
   ├─→ rlsc.collector → grid/relation/pattern (자동 관측, 좌표계 DSL)
   │      └─→ pretext (text-occupancy ground truth)
   │
   └─→ visbug WebComp (사용자 인텐트 layer)
          ↓ (사용자 편집)
        EditLogEntry { feature, target, args, before/afterCSS, source, correlationId }
          ↓
        host listener (rlsc / 측정 도구)
          ↓
        자동 분석 + 인간 시그널 결합 → 인텐트/회귀 데이터셋
```

### 의존 방향

```
rlsc → visbug-bridge → vendor/projectvisbug/dist/
rlsc → @chenglou/pretext
역방향 금지
```

## 단계 분리

작업은 3단계로 분리한다. 각 단계는 독립 검증/롤백 가능하며 PR 단위로 작게 유지한다.

### Phase B'1 — 모더나이즈
- `vendor/projectvisbug` 내부 빌드/테스트 도구 갱신
- 산출물 `dist/visbug.esm.js` 안정화
- extension/ 및 VisBug/(Xcode)는 손대지 않음 (평가 단계 스코프 외)

### Phase B'2 — edit-log core + API
- `app/edit-log/` 신규 모듈
- `<vis-bug>` 엘리먼트에 capture/listener API 결합
- UI 없음. headless 측정 가능 시점

### Phase B'3 — UI + bridge 통합
- `app/components/edit-log-panel/` 신규 컴포넌트
- `packages/visbug-bridge` 공개

## 결정 요약 (Q&A 결과)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 모더나이즈(B'1) 먼저, 그 다음 edit-log | 새 코드가 현대 빌드/테스트 위에 얹혀 부채 누적 회피 |
| 2 | 산출물은 Web Component 라이브러리만 | 측정 평가 단계라 extension/Xcode 빌드까지 가져갈 필요 없음 |
| 3 | EditLogEntry는 rich(feature + target + args + before/afterCSS) | copy 시 CSS/Script/JSON 형식 선택 가능 |
| 4 | 메모리 + host listener 조합 | 영속화는 host 책임. 디버그 편의용 localStorage는 v1 제외 |
| 5 | API 4종 + replay = verification utility | CustomEvent / setter / AsyncIterator / 명령형 메서드 모두 같은 dispatcher 위에. replay는 UI 없이 검증 도구로 노출 |
| 6 | 하이브리드 toolchain | vendor 내부는 npm + rollup 4 자율, qa-sdk 측은 thin bridge |
| 7 | MutationObserver baseline + visbug feature wrapper | wrapper 누락 시에도 변경 캡처. feature 메타는 wrapper로 부착 |
| 8 | dedup이 아닌 **capture-all + 분석 단계 병합** | correlationId로 그룹핑. agreement/divergence 메타로 capture 충실도 측정 가능 |
| 9 | bridge 패키지 이름 = `visbug-bridge` (unscoped) | qa-sdk 라이브러리 컨벤션 |
| 10 | vendor는 pnpm workspace 외부 | npm 자율 유지. bridge가 file: 링크 |
| 11 | fork = 사적 변경 | upstream 친화 제약 없이 자유롭게 정리 |
| 12 | replay 분리 X — verification 모드로 포함 | "기록 → replay → 같은 결과" = capture 충실도 검증 |

## 아키텍처

```
┌──────────────────────────────────────────────────────────────────────┐
│                       qa-sdk 모노레포                                  │
│                                                                       │
│  ┌────────────────────────────────┐    ┌──────────────────────────┐  │
│  │  packages/visbug-bridge        │    │  packages/rlsc           │  │
│  │  (pnpm + tsup, ESM/CJS dual)   │    │  (host/소비자 후보)        │  │
│  │                                │    │                          │  │
│  │  - re-export <vis-bug> el      │←───│  imports bridge          │  │
│  │  - typed EditLogEntry          │    │  registers listener      │  │
│  │  - VisBugController helper     │    │  joins entries with      │  │
│  │    (DOM mount + listener wire) │    │  rlsc analysis           │  │
│  └────────────┬───────────────────┘    └──────────────────────────┘  │
│               │ deps: file:../../vendor/projectvisbug                │
│               ↓                                                       │
└───────────────┼───────────────────────────────────────────────────────┘
                │
┌───────────────┼───────────────────────────────────────────────────────┐
│  vendor/projectvisbug   (git submodule, npm + rollup 4 + vitest)      │
│                                                                       │
│  app/                                                                 │
│  ├ components/vis-bug/vis-bug.element.js   ← Web Component 진입       │
│  ├ features/{padding,margin,font,...}.js   ← 11개 액션                │
│  ├ edit-log/                          ★ Phase B'2                    │
│  │  ├ entry.js          ← EditLogEntry 정규화 + before/after 캡처     │
│  │  ├ dispatcher.js     ← in-memory ring buffer + subscribe           │
│  │  ├ mutation-watcher.js ← MutationObserver baseline                 │
│  │  ├ feature-wrapper.js ← features/* monkey-patch                    │
│  │  ├ formatters.js     ← copy 출력 (CSS / script / JSON)             │
│  │  ├ replay.js         ← replay(entry, {mode})                       │
│  │  ├ merge.js          ← correlationId 병합 + agreement/divergence   │
│  │  └ index.js          ← install(host) entry                         │
│  └ components/edit-log-panel/         ★ Phase B'3                    │
│     └ edit-log-panel.element.js                                       │
│                                                                       │
│  dist/                                                                │
│  ├ visbug.esm.js        ← Web Component bundle (rollup 4)             │
│  └ visbug.types.d.ts    ← jsdoc 기반 TS types                         │
└───────────────────────────────────────────────────────────────────────┘
```

## 컴포넌트

### `vendor/projectvisbug/app/edit-log/` (Phase B'2)

| 모듈 | 책임 | 의존 |
|---|---|---|
| `entry.js` | `EditLogEntry` 타입/팩토리. `{ id, ts, feature, target: {selector, nodePath, weakRef}, args, beforeCSS, afterCSS, source: 'feature'\|'mutation', correlationId }` 정규화. before/after는 `getComputedStyle` 스냅샷에서 변경된 prop만 추출 | — |
| `dispatcher.js` | 단일 ring buffer (기본 max 1000). `push/getAll/clear/subscribe`. 외부에 직접 노출 X | entry |
| `mutation-watcher.js` | document에 MutationObserver. attributes(`style`,`class`)/childList/characterData 감시. 모든 변경을 source='mutation'으로 push (병합은 분석 단계) | dispatcher, entry |
| `feature-wrapper.js` | `features/*.js` 액션 함수 monkey-patch. before/after CSS 캡처 + feature/args 부착 + correlationId 계산 후 source='feature'로 push. 원래 함수 throw는 push 없이 재전파 | dispatcher, entry, features/* |

**correlationId 산출**: `hash(target.nodePath + sorted(changedProps).join(',') + Math.floor(ts / 100))`. 100ms 버킷이면 wrapper와 mutation-observer가 동일 변경에 대해 같은 id를 산출. 버킷 크기는 너무 작으면(<50ms) MutationObserver의 microtask 지연으로 split, 너무 크면(>500ms) 별개 변경이 충돌. 기본 100ms은 visbug 키-홀드 반복 입력 간격(50ms)보다 크지만 사용자 인지 단위는 보존.
| `merge.js` | 같은 correlationId 그룹을 1엔트리로 결합. `agreement` (afterCSS 일치 여부) / `divergence` (불일치 prop diff) 산출 | entry |
| `formatters.js` | `toCSS/toScript/toJSON(entries)`. 단일 entry 변환 실패는 그 엔트리만 skip | entry |
| `replay.js` | `replay(entry, {mode: 'css'\|'feature'})`. css: target에 afterCSS 적용. feature: target 재해결 후 features/[feature](args) 호출. `agreement===false` 시 warning 메타 동봉 | entry, features/*, formatters |
| `index.js` | `install(host)` — 위 전부를 `<vis-bug>` 인스턴스에 결합 | 위 전부 |

### `vendor/projectvisbug/app/components/vis-bug/vis-bug.element.js` (수정, Phase B'2)

- `connectedCallback`에서 `editLog.install(this)` 호출
- 인스턴스 메서드: `getHistory({merge: 'none'\|'correlated'\|'analyzed'})`, `clearHistory()`, `replay(entry, opts)`, `editLogStream()` (AsyncIterable)
- 인스턴스 setter: `set onEditLog(fn)` (단일 콜백)
- `editlog` CustomEvent dispatch (bubbles: true, composed: true) — Shadow DOM 통과

### `vendor/projectvisbug/app/components/edit-log-panel/` (Phase B'3)

- 토글 가능한 패널. 기존 hotkey-map 패턴 재사용
- 엔트리 리스트 + per-entry copy 메뉴(CSS/Script/JSON) + clear 버튼
- visbug toolbar에 토글 아이콘 추가

### `packages/visbug-bridge/src/` (Phase B'3)

| 모듈 | 책임 |
|---|---|
| `types.ts` | `EditLogEntry`, `EditLogListener`, `VisBugMountOptions` (logger?, bufferSize?) |
| `mount.ts` | `mountVisBug(host: HTMLElement, opts) → VisBugController`. Web Component import + custom element define + opts.onEntry wire |
| `controller.ts` | `VisBugController { getHistory(), clearHistory(), replay(), unmount(), entries: AsyncIterable<EditLogEntry> }` |
| `index.ts` | public export |

## 데이터 흐름

### Capture

```
사용자가 visbug에서 padding 변경 (예: Alt+ArrowUp)
   │
   ↓
features/padding.js 액션
   │
   ├─ feature-wrapper monkey-patch
   │     1. beforeCSS = snapshot(target, ['padding-top', ...])
   │     2. 원래 함수 호출 (실제 DOM 변경)
   │     3. afterCSS = snapshot(target, [...])
   │     4. correlationId = hash(target.nodePath + changedProps + tsBucket)
   │     5. dispatcher.push({ source: 'feature', feature: 'padding', args,
   │                          before/afterCSS, correlationId, ... })
   │
   └─ MutationObserver fires (속성 변경)
      → dispatcher.push({ source: 'mutation', changedAttrs,
                          before/afterCSS, correlationId, ... })
      ※ wrapper와 mutation 둘 다 push (capture-all)

dispatcher.push
   │
   ├─ ring buffer 저장 (overflow 시 oldest evict + 1회 warn)
   ├─ <vis-bug>에서 CustomEvent 'editlog' dispatch
   ├─ onEditLog setter 등록되어 있으면 호출
   └─ editLogStream() AsyncIterable 구독자에게 yield
```

### 분석 단계 병합

```
getHistory({merge})
   │
   ├─ 'none'       (기본 stream/event) → 원본 그대로
   ├─ 'correlated' → 같은 correlationId 그룹을 1엔트리로 결합
   │     {
   │       feature, args, target, beforeCSS, afterCSS,
   │       sources: ['feature', 'mutation'],
   │       agreement: boolean,        ← afterCSS 일치 여부
   │       divergence?: { prop → {wrapper, mutation} }
   │     }
   └─ 'analyzed'   → host가 mergePolicy 주입 (사용자 정의)
```

### Consume (host 측)

```ts
import { mountVisBug } from 'visbug-bridge'

const ctrl = mountVisBug(document.body, {
  onEntry: (entry) => {
    const coord = rlsc.locate(entry.target.selector)
    intentSink.push({ entry, coord, page })
  }
})

// headless
for await (const entry of ctrl.entries) { ... }

// verification
const result = ctrl.replay(savedEntry, { mode: 'css' })
// { ok: boolean, reason?, warning?, divergence? }
```

### Copy (사용자 향)

```
[Copy CSS ▾] 클릭
   ↓
formatters.toCSS(getHistory({merge: 'correlated'}))
   ├─ selector 그룹핑
   ├─ entry.afterCSS의 변경된 prop만 출력
   └─ "selector { prop: value; ... }" 텍스트
   ↓
navigator.clipboard.writeText(cssText)
```

## 에러 처리

### 원칙
- **fail-open**: edit-log 실패가 visbug 본체 편집을 막지 않음
- **에러 격리**: 모듈별 try/catch + console.warn(브라우저 환경). host listener 예외는 다른 listener 차단 안 함
- **silent-empty 금지**: 실패 시 경고 + 진단 정보

### 모듈별

| 모듈 | 시나리오 | 처리 |
|---|---|---|
| `feature-wrapper` | beforeCSS 캡처 실패 | wrapper 무력화하고 원래 함수 직접 호출. entry skip + warn |
| `feature-wrapper` | 원래 함수 throw | warn + push 없음 + throw 재전파 |
| `mutation-watcher` | observer callback throw | try/catch 흡수. 다음 mutation 계속 |
| `dispatcher.push` | listener throw | listener별 try/catch. 한 listener 실패가 다른 listener 차단 X |
| `dispatcher.subscribe` | unsubscribe 후 호출 | no-op |
| `editLogStream()` | consumer break/return | iterator close 시 subscribe 해제 |
| `formatters.*` | 단일 entry 변환 실패 | 그 entry만 skip + warn. 나머지 출력 |
| `replay({mode:'css'})` | target resolve 실패 | `{ok: false, reason: 'target-not-found'}` 반환 (throw X) |
| `replay({mode:'css'})` | style 적용 throw | `{ok: false, reason: 'style-apply-failed', cause}` |
| `replay({mode:'feature'})` | feature 함수 missing/throw | `{ok: false, reason: 'feature-replay-failed', cause}` |
| `mountVisBug` | host 미존재 | throw (사용자 코드 버그라 fail-loud) |
| `mountVisBug` | onEntry throw | bridge가 try/catch + warn. 스트림은 계속 |

### Ring buffer overflow
- 기본 max 1000. 초과 시 oldest evict + 1회 warn
- mountVisBug opts로 `bufferSize` 조정 가능

### Replay agreement warning
- `agreement === false` 머지 entry replay 시 `{ok: true, warning: 'divergent-capture', divergence}`

### 측정 가치
- 실패 자체가 데이터 — replay `ok: false` 비율 = capture 충실도 메트릭
- `agreement === false` 비율 = visbug 본체 회귀 검출 신호

## 브라우저 지원선

WeakRef, AsyncIterator, CustomElements v1, 표준 MutationObserver — Chrome 86+ / Firefox 79+ / Safari 14.1+ / Edge 86+. visbug 자체 호환선과 일치.

## Logger 컨벤션

- visbug 내부(JS, browser SDK): `console.warn` 허용 (CLAUDE.md 브라우저 SDK 규칙)
- bridge: `mountVisBug(host, { logger? })` opts로 외부 logger 주입 가능. 미주입 시 `console.warn`. 직접 `console.*` 호출 X

## 테스트 전략

### Phase B'1 (모더나이즈)

| 대상 | 도구 | 통과 기준 |
|---|---|---|
| 빌드 산출물 | rollup 4 + 수동 smoke | `dist/visbug.esm.js` 로드, `<vis-bug>` define 성공 |
| 기존 feature 테스트 | ava → vitest 마이그레이션 | 기존 11개 `*.test.js` 전부 green |
| 기존 e2e | puppeteer → playwright | 기존 e2e 시나리오 green |
| postcss 8 출력 | 시각 비교 | `app/bundle.css` 의미 변경 없는지 확인 |

마이그레이션 1:1 — 새 테스트 추가 X.

### Phase B'2 (edit-log core)

vendor 내 vitest:

| 단위 | 케이스 |
|---|---|
| `entry.js` | snapshot diff가 변경된 prop만 추출 / nodePath 안정성(같은 노드 두 번 → 같은 path) / WeakRef API 노출 형태 (GC 비결정성으로 deref 동작 자체는 별도 통합 테스트로) |
| `dispatcher.js` | push → 다수 subscribe 호출 / unsubscribe 후 미호출 / ring buffer evict 시점 / clear 후 빈 상태 |
| `mutation-watcher.js` | style/class/characterData 감지 / observer disconnect |
| `feature-wrapper.js` | 원래 함수 호출 / before/after 캡처 / throw 시 push 없이 재전파 / correlationId 결정성 |
| `merge.js` | correlationId 매칭 그룹핑 / agreement true/false 판정 / divergence prop별 diff |
| `formatters.js` | toCSS selector 그룹핑+prop 병합 / toScript 재현 코드 문법 정합 / toJSON round-trip / 1개 entry 실패 시 나머지 유지 |
| `replay.js` | css 모드 성공/실패 / feature 모드 성공 / target-not-found 에러 객체 / agreement===false warning 동봉 |

vendor playwright e2e:
- `<vis-bug>` 마운트 → 단축키 입력 → CustomEvent 'editlog' 발생
- onEntry 콜백 호출
- editLogStream() AsyncIterator로 N개 수집

### Phase B'3 (UI + bridge)

vendor 내 vitest:
- `edit-log-panel`: 엔트리 렌더 / copy 버튼 → clipboard mock / clear 동작

bridge 내 vitest:
- `mountVisBug` controller 반환 모양 / `getHistory()` 위임 / `controller.entries` AsyncIterable
- `onEntry` throw 시 다른 listener 영향 없음

qa-sdk playwright e2e:
- bridge 통해 마운트 → 단축키 → controller로 history 조회
- merge 옵션별 결과 형태

### TDD
- Phase B'2/B'3 신규 코드는 vitest test-first
- Phase B'1 모더나이즈는 기존 테스트 통과가 게이트

### 측정 도구 자체 검증
- rlsc 측에서 visbug-bridge 통합 후 "엔트리 → 좌표 join" 시나리오 e2e (별도 PR)

## 스코프 외

- visbug Chrome/Firefox/Safari/Edge **extension 빌드** — 평가 단계 후속
- VisBug Xcode 프로젝트 — 평가 단계 후속
- localStorage 영속화 — host 책임
- replay v2 (UI 표면) — v1은 verification 용도로만
- def-catalog 좌표 부여 — Phase B'3 시점에 `docs/specs/visbug-bridge/` 별도 spec 작성

## 다음 단계

본 design doc 승인 후 `superpowers:writing-plans` skill로 Phase B'1/B'2/B'3 각각의 implementation plan을 작성한다.
