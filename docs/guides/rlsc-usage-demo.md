# RLSC 사용과 데모

현재 qa-sdk에서 바로 설치하고 검증할 수 있는 RLSC 표면은 public `rlsc-analysis` submodule과 `visbug-bridge`다. 전체 DSL encoder, perspective viewer, Inspector 앱은 [pnpm-mcp](https://github.com/mineclover/pnpm-mcp)의 외부 패키지로 관리한다.

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
corepack pnpm --filter rlsc-demo dev
```

이 데모는 RLSC의 Tree/Grid/Layers/Relations/Context와 perspective viewer를 포함한다. qa-sdk의 `packages/rlsc-demo/dist`는 이전 빌드 산출물이며 사용 경로가 아니다.

## 검증 범위

```bash
corepack pnpm --filter rlsc-analysis build
corepack pnpm --filter rlsc-analysis test
corepack pnpm --filter visbug-bridge build
corepack pnpm --filter visbug-bridge test
corepack pnpm --filter visbug-bridge test:e2e
```

Perspective viewer와 geometry accuracy smoke는 `pnpm-mcp` checkout에서 실행한다. qa-sdk root에는 해당 package가 없기 때문에 stale `dist`를 기준으로 한 projection 결과를 root 검증 결과로 해석하지 않는다.
