# visbug-bridge

qa-sdk 모노레포에서 `vendor/projectvisbug`(fork)를 소비하는 thin bridge.

## 사용

```ts
import { mountVisBug } from 'visbug-bridge'

const ctrl = mountVisBug(document.body, {
  bufferSize: 500,
  onEntry: (entry) => {
    // entry: EditLogEntry
  },
})

const merged = ctrl.getHistory({ merge: 'correlated' })
ctrl.clearHistory()
const result = ctrl.replay(merged[0], { mode: 'css' })
ctrl.unmount()
```

## 의존

`file:../../vendor/projectvisbug`. vendor 산출물은 vendor 측 `npm run bundle` 결과를 참조한다.
