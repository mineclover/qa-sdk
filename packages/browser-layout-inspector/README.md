# browser-layout-inspector

브라우저 extension content script와 브라우저 테스트를 위한 layout inspection 라이브러리다. CSS source 후보와 final computed style은 다른 사실이므로 별도 API로 반환한다.

```ts
import { inspectSelectorLayout } from 'browser-layout-inspector';

const snapshot = inspectSelectorLayout('[data-measure-id="card"]', document, {
  referenceSelector: '#app-shell',
  computedProperties: ['display', 'gap', 'width', 'height'],
});
```

반환값은 `cssInfluences`, `computedStyle`, `metrics`, `position`을 포함한다. rect와 gap은 CSS px이고, 방향성 edge gap이 음수이면 요소가 겹친다는 뜻이다. cross-origin CSS stylesheet는 CSSOM 읽기가 금지될 수 있으며, 이 경우 결과의 `inaccessibleStylesheets`에 진단만 남긴다.

## 순수 측정 API

`browser-layout-inspector/measurement`은 DOM, Chrome extension API, Vitest/Playwright에 의존하지 않는다. 렌더된 `DOMRect`나 테스트에서 만든 CSS px rect·point를 넣어 같은 결과를 얻을 수 있다.

```ts
import {
  matchCssPixels,
  measureElementComparison,
  measureRuler,
  rulerGuides,
} from 'browser-layout-inspector/measurement';

const comparison = measureElementComparison(referenceRect, targetRect);
// signed corresponding-corner deltas + only real positive gaps

const ruler = measureRuler({ x: 24, y: 40 }, { x: 184, y: 120 });
const guides = rulerGuides(ruler);

const width = matchCssPixels(actualWidth, { expected: 320, toleranceCssPx: 0.5 });
if (!width.pass) throw new Error(`width drift: ${width.differenceCssPx}px`);
```

`measureElementComparison`은 포함·겹침을 gap으로 정규화하지 않는다. 대응 모서리와 방향성 edge 값은 계속 signed CSS px이며, 반대 축 투영이 겹친 실제 빈 공간만 positive `gaps`로 반환한다. `matchCssPixels`는 assertion framework를 포함하지 않는 구조화 결과이므로 Playwright, Vitest, custom QA harness에서 자유롭게 사용할 수 있다.
