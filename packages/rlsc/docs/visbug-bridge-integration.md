# rlsc × visbug-bridge integration

`visbug-bridge`를 rlsc의 측정 도구로 소비하는 패턴.

## 개념

```
visbug Web Component (in-page 편집 UI)
    │ user edits
    ▼
EditLogEntry { target: { selector, nodePath, weakRef }, beforeCSS, afterCSS, ... }
    │
    ▼
host code (downstream 측정 도구)
    │ join with rlsc 좌표
    ▼
rlsc.collectLayout → RLSCDocument
    │ findByAddress / queryNodes / findById
    ▼
{ entry, node }  ← 인텐트 + 좌표 결합 데이터
```

## rlsc node id 규칙

`collector.ts`의 `generateId` 함수:

```ts
function generateId(el: Element): string {
  if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
  const cls = el.classList.length > 0 ? `.${el.classList[0]}` : "";
  return `${el.tagName.toLowerCase()}${cls}__${counter}`;
}
```

- `<p id="target">` → node id: `"p#target"`
- id 없는 요소 → `"div.card__3"` 형태 (auto-generated, 불안정)

id 기반 join이 가장 안정적이다.

## 최소 사용 예

```ts
import { mountVisBug } from 'visbug-bridge'
import { collectLayout, queryNodes } from 'rlsc'

const doc = collectLayout(document.getElementById('app')!)

const ctrl = mountVisBug(document.body, {
  onEntry: (entry) => {
    const node = joinEntryToNode(entry, doc)
    if (node) {
      publishIntent({ entry, node })
    }
  },
})

function joinEntryToNode(entry: EditLogEntry, doc: RLSCDocument): RLSCNode | null {
  const sel = entry.target.selector
  if (sel.startsWith('#')) {
    const domId = sel.slice(1)
    // collector id 형식: `${tag}#${id}`
    const matches = queryNodes(doc, {}).filter((n) => n.id.endsWith(`#${domId}`))
    if (matches.length === 1) return matches[0]
  }
  return null
}
```

## 정합성 메모

- rlsc의 `collectLayout`은 한 시점의 스냅샷이다. 사용자 편집(visbug DOM 변형) 후에는 `collectLayout`을 재호출하여 좌표를 갱신해야 한다.
- 라이프사이클 관리: `createLayoutMonitor`를 함께 사용하면 변경 자동 감지 가능.
- `entry.target.weakRef`는 같은 페이지 내에서만 유효하다. 새 페이지/리로드에서는 `selector + nodePath` fallback이 필요하다.
- id 없는 요소의 rlsc node id(`tag.cls__N`)는 `collectLayout` 호출마다 카운터가 초기화되므로 join 키로 사용하면 안 된다.

## 검증

이 패턴의 smoke check: `packages/rlsc/src/visbug-bridge-join.test.ts` (5 tests, vitest).  
브라우저 환경의 e2e는 별도 측정 도구 PR에서 수행.

## 관련 문서

- `docs/specs/visbug-bridge/visbug-bridge.spec.md` — bridge 스펙
- `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md` — 전체 설계
