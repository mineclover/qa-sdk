---
def:
  tier: component
  id: rlsc-integration
  address: def_document:v2:137358
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: platform-demo
  tags: [runtime, observability, structural]
  links:
    - target: viz-language-system
      type: refines
    - target: visbug-bridge-spec
      type: refs
sources:
  - packages/rlsc-analysis/src/index.ts
  - packages/rlsc-analysis/src/browser.ts
  - packages/rlsc-analysis/smoke/accuracy.mjs
  - packages/visbug-bridge/test/rlsc-integration.spec.ts
---

# RLSC 통합 경로

## 목적 ^purpose

현재 qa-sdk가 소유하는 RLSC 실행 경계와 브라우저 사용 경로를 고정한다. 화면 수집·분석은 `rlsc-analysis`, 편집 인텐트와 좌표 심볼 연결은 `visbug-bridge`가 담당한다. Inspector UI와 전체 RLSC DSL은 외부 `pnpm-mcp` 패키지의 책임이다.

## 구성 ^overview

현재 검증 경로는 다음과 같다.

```text
DOM metadata
  └─ rlsc-analysis/browser: scanScreen()
       ├─ RLSCDocument + nodes + index
       ├─ metrics / pattern / overflowIssues
       └─ byQaAddress() / byXPath() / byComponentId()

VisBug edit
  └─ visbug-bridge: createDomRefSymbolResolver()
       └─ EditLogEntry.target.catalog.symbols[].kind === "rlsc"
            └─ scan.byQaAddress(symbol.value) 로 RLSC node join
```

## 현재 패키지 경계

| 패키지 | 현재 책임 | 위치 |
|--------|-----------|------|
| `rlsc-analysis` | DOM 수집, metadata, identifier/index, area/layout/text 분석, graphics adapter contract | `packages/rlsc-analysis` public submodule |
| `visbug-bridge` | VisBug Web Component mount, edit-log listener, DomRef와 `rlsc`/`qa-coord` 심볼 연결 | `packages/visbug-bridge` |
| `rlsc` | encoder, context, query, compatibility surface | 외부 `pnpm-mcp/packages/rlsc` |
| `rlsc-perspective` | `RLSCDocument` 3D viewer | 외부 `pnpm-mcp/packages/rlsc-perspective` |
| `rlsc-demo` | 수집·분석·오버레이를 보여주는 Inspector | 외부 `pnpm-mcp/packages/rlsc-demo` |

qa-sdk의 `packages/rlsc-demo`와 `packages/rlsc-perspective`에는 추적되는 source/package가 없다. 로컬에 남은 `dist`는 무시되는 이전 산출물이므로 실행 경로로 문서화하지 않는다.

## 좌표 metadata 계약

`rlsc-analysis/browser`가 수집하는 노드는 다음 DOM metadata를 보존한다.

| DOM attribute | RLSC 필드 | bridge 용도 |
|---------------|-----------|-------------|
| `data-component-id` | `identifier.componentId` | 안정적인 컴포넌트 조회 |
| `data-qa-address` | `address`, `identifier.qaAddress` | `scan.byQaAddress()` join key |
| `data-debug-label` | `debugLabel` | 사람이 읽는 진단 라벨 |
| `data-boundary` | `boundary` | 경계/소유권 표시 |

`collectLayout()`는 현재 문서 수준 `RLSCDocument.address`를 자동으로 채우지 않는다. 페이지 주소가 필요하면 소비자가 별도 metadata를 보관하고, 노드 수준 주소는 `data-qa-address`로 연결한다.

## 브라우저 소비 API

`rlsc-analysis` root export는 순수 분석용이고, DOM API는 `/browser` subpath에서 가져온다.

```ts
import { normalizeGraphicsLayoutSpecFromRLSCNode } from 'rlsc-analysis';
import { scanScreen } from 'rlsc-analysis/browser';

const scan = scanScreen(document.body, {
  includeText: true,
  collect: { addressAttribute: 'data-qa-address' },
});

const submit = scan.byQaAddress('checkout:form:submit')[0];
const layout = submit
  ? normalizeGraphicsLayoutSpecFromRLSCNode(submit)
  : null;

console.log({
  nodeCount: scan.nodes.length,
  overflowIssues: scan.overflowIssues,
  metrics: scan.metrics,
  submit,
  layout,
});
```

`scanScreen()`이 반환하는 주요 값은 `doc`, `nodes`, `index`, `metrics`, `pattern`, `overflowIssues`, `textOccupancies`와 직접 조회 함수들이다. `collectLayoutWithText()`의 `textPrepared`는 현재 빈 map이며, `analyzeTextOccupancy()`는 Canvas/pretext 측정이 아니라 결정론적 문자 폭 추정이다. 텍스트 수치는 레이아웃 힌트로만 사용한다.

## VisBug join 사용법

```ts
import { createDomRefSymbolResolver, mountVisBug } from 'visbug-bridge';
import { scanScreen } from 'rlsc-analysis/browser';

const scan = scanScreen(document.body);
const resolveDomRefSymbols = createDomRefSymbolResolver({
  rlsc: {
    locateElement: (element) => element.getAttribute('data-qa-address'),
  },
});

mountVisBug(document.body, {
  entryFilter: 'all',
  resolveDomRefSymbols,
  onEntry(entry) {
    const symbol = entry.target.catalog?.symbols.find((item) => item.kind === 'rlsc');
    const node = symbol ? scan.byQaAddress(symbol.value)[0] : undefined;
    console.log({ entry, rlscNode: node });
  },
});
```

`rlsc` 심볼이 없으면 bridge의 canonical XPath가 fallback 후보가 된다. 현재 bridge smoke는 이 두 경로를 검증한다. 실제 edit/replay 조작은 브라우저 데모에서 확인하고, 분석 snapshot은 편집 전후에 다시 `scanScreen()`으로 수집한다.

## 외부 Inspector 데모

전체 Tree/Grid/Layers/Relations/Context 화면이 필요하면 공개 [pnpm-mcp/packages/rlsc-demo](https://github.com/mineclover/pnpm-mcp/tree/main/packages/rlsc-demo)를 사용한다.

실행 명령은 `git clone` 후 `corepack pnpm --filter rlsc-demo dev`이며, 상세 사용 예제는 `docs/guides/rlsc-usage-demo.md`에 둔다.

qa-sdk 안에서 바로 실행할 수 있는 현재 데모는 VisBug bridge와 RLSC join을 합친다.

```bash
corepack pnpm --filter visbug-bridge demo
```

브라우저에서 [http://localhost:4173/packages/visbug-bridge/demo/edit-log-preview.html](http://localhost:4173/packages/visbug-bridge/demo/edit-log-preview.html)을 열고 점선 박스를 편집한다. 각 edit-log 항목에 `RLSC join: <node id>`가 표시되며, feature/mutation 카운터와 intent 병합을 함께 확인할 수 있다.

## 검증 명령

검증 명령은 `corepack pnpm --filter rlsc-analysis test`와 `corepack pnpm --filter visbug-bridge test:e2e`를 기본으로 한다. 전체 명령은 `docs/guides/rlsc-usage-demo.md`에 둔다.

브라우저 accuracy smoke와 perspective viewer는 `pnpm-mcp` checkout에서 실행한다. qa-sdk root에는 perspective package가 없으므로 stale `dist`를 기준으로 한 결과를 성공 근거로 사용하지 않는다.
