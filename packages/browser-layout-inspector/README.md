# browser-layout-inspector

브라우저 extension content script를 위한 read-only layout inspection 라이브러리다. CSS source 후보와 final computed style은 다른 사실이므로 별도 API로 반환한다.

```ts
import { inspectSelectorLayout } from 'browser-layout-inspector';

const snapshot = inspectSelectorLayout('[data-measure-id="card"]', document, {
  referenceSelector: '#app-shell',
  computedProperties: ['display', 'gap', 'width', 'height'],
});
```

반환값은 `cssInfluences`, `computedStyle`, `metrics`, `position`을 포함한다. rect와 gap은 CSS px이고, 방향성 edge gap이 음수이면 요소가 겹친다는 뜻이다. cross-origin CSS stylesheet는 CSSOM 읽기가 금지될 수 있으며, 이 경우 결과의 `inaccessibleStylesheets`에 진단만 남긴다.
