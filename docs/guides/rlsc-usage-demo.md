# RLSC 사용과 데모

현재 qa-sdk에서 바로 설치하고 검증할 수 있는 RLSC 표면은 public `rlsc-analysis` submodule과 `visbug-bridge`다. 전체 DSL encoder, perspective viewer, Inspector 앱은 [pnpm-mcp](https://github.com/mineclover/pnpm-mcp)의 외부 패키지로 관리한다.

## 클론한 qa-sdk에서 시작하기

submodule까지 받아야 `visbug-bridge demo`가 vendor VisBug와 RLSC 분석 패키지를 함께 빌드할 수 있다.

```bash
git clone --recurse-submodules https://github.com/mineclover/qa-sdk.git
cd qa-sdk
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm --filter rlsc-analysis build
corepack pnpm --filter rlsc-analysis test
corepack pnpm --filter visbug-bridge demo
```

Node.js 22 이상과 Corepack을 사용한다. 데모 서버가 열리면 [edit-log-preview.html](http://127.0.0.1:4173/packages/visbug-bridge/demo/edit-log-preview.html)을 열고, 종료할 때는 서버 터미널에서 `Ctrl-C`를 누른다. `4173` 포트가 사용 중이면 현재 demo script의 포트 고정값을 바꾸거나 다른 checkout에서 실행한다.

## 분석만 사용하는 경우

DOM API는 `rlsc-analysis/browser`에서 가져온다. 주소 metadata를 붙인 뒤 한 번 스캔하면 노드, layout metric, overflow, 재식별 index를 함께 얻는다.

```ts
import {
  annotateElement,
  normalizeGraphicsLayoutSpecFromRLSCNode,
  toFigmaAutoLayoutFromGraphicsLayoutWithDiagnostics,
} from 'rlsc-analysis';
import { scanScreen } from 'rlsc-analysis/browser';

const submit = document.querySelector<HTMLButtonElement>('#checkout-submit');
if (!submit) throw new Error('submit button not found');
annotateElement(submit, {
  componentId: 'CheckoutForm.SubmitButton',
  qaAddress: 'checkout:form:submit',
  debugLabel: 'Submit order',
});

const scan = scanScreen(document.body, {
  includeText: true,
  collect: { addressAttribute: 'data-qa-address' },
});
const node = scan.byQaAddress('checkout:form:submit')[0];
if (!node) throw new Error('RLSC node not found');

const canonical = normalizeGraphicsLayoutSpecFromRLSCNode(node);
const figma = canonical
  ? toFigmaAutoLayoutFromGraphicsLayoutWithDiagnostics(canonical, {
      onDiagnostic: console.debug,
    })
  : null;

console.table({
  nodeCount: scan.nodes.length,
  overflowIssues: scan.overflowIssues.length,
  dominantFlow: scan.metrics.dominantFlow,
  submitId: node.id,
});
console.log({ node, canonical, figma });
```

`collectLayoutWithText()`와 `scanScreen({ includeText: true })`의 text occupancy는 현재 Canvas/pretext 실측이 아니라 결정론적인 문자 폭 추정이다. 텍스트 수치는 비교와 경고에 사용하고, 최종 렌더링 판단에는 실제 브라우저 측정을 사용한다. `createLayoutMonitor()`도 root resize와 DOM mutation을 감시하는 경량 monitor이며, window resize와 모든 descendant의 독립적인 ResizeObserver를 제공하는 계약은 아니다.

## Snapshot 가독성 리뷰

`scanScreen()`의 `result.doc`는 손실 없는 원본 snapshot이라 JSON으로 바로 출력하면 트리·grid·layer·relation·styleStack이 모두 포함된다. demo 규모의 DOM에서는 pretty JSON이 수십만 자와 수만 줄까지 커질 수 있으므로 사람이 읽는 리뷰 출력으로는 과하다. 노드 수와 raw 크기는 viewport와 대상 DOM에 따라 달라진다. VisBug demo는 `.demo-canvas`만 scan root로 사용해 오른쪽 panel과 toolbar를 snapshot에서 제외한다.

검토할 때는 세 층을 분리한다.

1. `summarizeRLSCDocument(doc)` — viewport, node/layer/relation 수와 relation type별 개수
2. `formatRLSCSnapshot(doc, options)` — 깊이·노드·relation 행을 제한한 들여쓰기 트리
3. `JSON.stringify(doc, null, 2)` — 저장·diff·기계 소비용 원본

```ts
import { formatRLSCSnapshot, summarizeRLSCDocument } from 'rlsc-analysis';
import { scanScreen } from 'rlsc-analysis/browser';

const result = scanScreen(document.body, {
  includeText: true,
  collect: { addressAttribute: 'data-qa-address' },
});

console.table(summarizeRLSCDocument(result.doc));
console.log(
  formatRLSCSnapshot(result.doc, {
    maxDepth: 5,
    maxNodes: 120,
    maxRelations: 24,
    includeAnalysis: true,
    maxIssues: 8,
    includeAttributes: true,
  }),
);

// 원본 보관이 필요할 때만 사용한다.
const rawSnapshot = JSON.stringify(result.doc, null, 2);
```

읽기 쉬운 출력은 `RLSC snapshot v1.0` 헤더, viewport/counts, stable identifier가 포함된 tree, bounded layer/relation 목록 순서로 표시된다. 현재 VisBug demo panel은 최대 80 nodes와 16 relation rows를 보여준다. 이 text projection은 원본을 대체하지 않으며, 생략된 노드와 relation 행은 `omitted`로 표시한다.

`includeAnalysis: true`를 켜면 flow, balance, grid/spacing, text density, area overflow 같은 review용 신호가 별도 `analysis:` 섹션에 추가된다. full `metrics`/`pattern` 객체와 issue 목록이 필요할 때는 `analyzeAreas(doc)`를 직접 사용한다.

작은 fixture에서는 전체 tree를 확인해도 되지만, 큰 DOM에서는 relation이 노드 쌍에 따라 빠르게 늘어날 수 있다. `maxDepth`, `maxNodes`, `maxRelations`를 먼저 제한하고, 필요할 때만 raw JSON을 별도 파일로 저장한다.

## VisBug 편집을 RLSC 노드에 연결하는 경우

```ts
import { createDomRefSymbolResolver, mountVisBug } from 'visbug-bridge';
import { scanScreen } from 'rlsc-analysis/browser';

const scan = scanScreen(document.body);
const resolveDomRefSymbols = createDomRefSymbolResolver({
  rlsc: {
    locateElement: (element) => element.getAttribute('data-qa-address'),
  },
});

const controller = mountVisBug(document.body, {
  entryFilter: 'all',
  resolveDomRefSymbols,
  onEntry(entry) {
    const symbol = entry.target.catalog?.symbols.find((item) => item.kind === 'rlsc');
    const node = symbol ? scan.byQaAddress(symbol.value)[0] : undefined;
    console.log('edit', entry.feature, entry.source, { symbol, node });
  },
});

// 필요하면 편집 후 새 geometry snapshot을 수집한다.
const afterEdit = scanScreen(document.body);
controller.unmount();
```

RLSC 심볼이 없는 entry는 bridge가 만든 canonical XPath를 fallback으로 사용할 수 있다. 편집 전후 문서를 비교할 때는 기존 `scan`을 재사용하지 말고 `scanScreen()`을 다시 호출한다.

## 현재 저장소에서 실행하는 데모

```bash
corepack pnpm --filter rlsc-analysis test
corepack pnpm --filter visbug-bridge demo
```

`visbug-bridge demo`는 vendor bundle, `rlsc-analysis`, bridge를 빌드한 뒤 `http://localhost:4173`에서 다음 페이지를 연다.

[edit-log-preview.html](http://localhost:4173/packages/visbug-bridge/demo/edit-log-preview.html)

점선 박스를 VisBug로 편집하면 오른쪽 패널에서 `feature`와 `mutation` entry를 볼 수 있다. 각 entry는 `data-qa-address`를 통해 `RLSC join: <node id>`를 표시하고, `intent 병합` 버튼은 `getHistory({ merge: 'intent' })` 결과를 보여준다. 데모는 실제 외부 API나 비용이 드는 서비스에 연결하지 않는다.

## 전체 Inspector가 필요한 경우

qa-sdk에는 `rlsc-demo` 소스가 없으므로 다음 외부 checkout에서 실행한다.

```bash
git clone https://github.com/mineclover/pnpm-mcp.git
cd pnpm-mcp
corepack pnpm install
corepack pnpm --filter rlsc-demo dev -- --host 127.0.0.1
```

브라우저: [http://127.0.0.1:5173/](http://127.0.0.1:5173/). 현재 외부 checkout의 `rlsc-demo dev` 화면은 Summary/overlay와 raw Document projection을 제공한다. raw Document는 canonical `result.doc` 전체나 RLSC/1.0 markup과 구분해서 본다. RLSC/1.0 markup은 사람·LLM 검토용 compact 표현이며 lossless JSON 복원 포맷이 아니다. 현재 `rlsc-demo build`는 외부 checkout HEAD에서 `rlsc-perspective` source 경계 문제로 실패할 수 있으므로 dev 실행을 기준으로 한다. qa-sdk의 `packages/rlsc-demo/dist`는 이전 빌드 산출물이며 사용 경로가 아니다.

## 검증 범위

```bash
corepack pnpm --filter rlsc-analysis build
corepack pnpm --filter rlsc-analysis test
corepack pnpm --filter visbug-bridge build
corepack pnpm --filter visbug-bridge test
corepack pnpm --filter visbug-bridge test:e2e
```

Perspective viewer와 geometry accuracy smoke는 `pnpm-mcp` checkout에서 실행한다. qa-sdk root에는 해당 package가 없기 때문에 stale `dist`를 기준으로 한 projection 결과를 root 검증 결과로 해석하지 않는다.
