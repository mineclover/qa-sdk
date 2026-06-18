---
def:
  tier: component
  id: visbug-dom-ref-roadmap
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: visbug-bridge
  tags: [measurement, browser, edit-log, dom-ref, selector]
  links:
    - target: visbug-edit-log-spec
      type: refines
    - target: visbug-bridge-spec
      type: refines
  source: vendor/projectvisbug/app/dom-ref/index.js
---

# visbug DomRef 로드맵

## 목적 ^purpose

VisBug/edit-log에서 요소 선택·식별·replay·rlsc join을 **문자열 쿼리 산발**이 아니라 **API + 멀티 심볼 카탈로그**로 통일한다. 노드 1개당 canonical full XPath(SSOT)와 파생 심볼(css, id, attr, legacy nodePath)을 함께 보유한다.

## 현재 한계

| 항목 | 문제 |
|------|------|
| `EditLogTarget.selector` | `#id` 또는 nodePath — querySelector 호환·유일성 불안정 |
| `nodePath` | `div[0]>p[1]` — 형제 삽입 시 drift, CSS 아님 |
| replay | `querySelector(selector)` 단일 경로 |
| search 툴 | CSS 문자열만, 요소당 카탈로그 없음 |

## 목표 모델

```
Element
  └─ DomRefCatalog
       ├─ canonical: full XPath (항상 유일)
       ├─ symbols[]: css / id / attr / nodePath / (후속) rlsc
       ├─ fingerprint: tag, textSnippet (disambiguation)
       └─ capturedAt
```

공개 API (최종):

- `buildDomRefCatalog(element, opts?) → DomRefCatalog`
- `resolveDomRef(catalog, opts?) → Element | null`
- `queryTargets(spec, opts?) → Element[]`

## 단계 (D1–D6)

| Phase | 상태 | 산출 | 검증 |
|-------|------|------|------|
| **D1** | 완료 | `app/dom-ref/` — xpath, symbols, catalog, matchCount, stability, resolve/query (최소) | vitest 9건 |
| **D2** | 완료 | `EditLogTarget.catalog` + `entry.js` 연동, legacy 필드 파생, replay catalog fallback | edit-log unit |
| **D3** | 완료 | formatter DomRef primary/catalog 사용, host DomRef API 노출 | formatter/dom-ref/edit-log unit |
| **D4** | 완료 | search/selectable UI가 `queryTargets` API 사용, bridge controller DomRef API 노출 | feature/bridge unit |
| **D5** | 완료(훅) | `resolveDomRefSymbols(element)`로 `rlsc`/`qa-coord` 심볼 주입 | dom-ref/edit-log/bridge unit |
| **D5b** | 완료(bridge adapter) | `createDomRefSymbolResolver()`로 rlsc-style `locateElement` 결과를 DomRefSymbol로 변환 | bridge unit |
| **D6** | 완료 | 세션 `TargetRegistry` (element/canonical/labelId → catalog 캐시) | dom-ref/edit-log/bridge unit |

### D1 상세 (현재)

- `xpath.js` — full XPath 생성·resolve (`document.evaluate`)
- `symbols.js` — id / data-* / css path / legacy nodePath 후보 + `matchCount`
- `catalog.js` — `buildDomRefCatalog`, stability 정렬, `primary` 심볼
- `resolve.js` — `prefer-stable` / `canonical-only` (D1 최소)

**stability (초기):**

| kind | 점수 | 조건 |
|------|------|------|
| `attr` | 95 | `data-testid`, `data-qa-id` 등 stable attr, unique |
| `id` | 85 | `#id` unique, 동적 id 패널티 |
| `css` | 75 | 짧은 unique CSS path |
| `xpath-relative` | 50 | id 기반 짧은 xpath `//*[@id="…"]` (full 아님) |
| `nodePath` | 25 | legacy `computeNodePath` |
| `xpath` (canonical) | 100 | resolve fallback SSOT |

### D2 상세 (완료)

- `createEntry()` → `target.catalog`, `target.primary`
- `selector` / `nodePath` — `primary`·legacy에서 파생 (하위 호환)
- `correlationId` — `catalog.canonical.value` 기반
- `replay` — `weakRef` → legacy selector → `resolveDomRef(catalog)` fallback

### D3 상세 (완료)

- `toCSS()` — `target.primary`가 CSS-compatible(`attr`/`id`/`css`)이면 legacy selector보다 우선
- `toCSS()` — primary가 XPath이면 `catalog.symbols`의 CSS-compatible 심볼로 fallback
- `queryTargets()` — `{ by: 'symbol' }`, `{ by: 'catalog' }` 지원
- `<vis-bug>` host API — `buildTargetRef(element)`, `resolveTargetRef(catalog)`, `queryTargets(spec)` 노출

### D4 상세 (완료)

- `Search/queryPage()` — `SelectorEngine.queryTargets({ by: 'css', value })` 우선 사용
- `Selectable()` — 반환 API에 `queryTargets` 노출
- `visbug-bridge` controller — `buildTargetRef`, `resolveTargetRef`, `queryTargets` 노출

### D5 상세 (완료: 주입 훅)

- `buildDomRefCatalog(element, { resolveSymbols })` — 외부 심볼 주입
- `createEntry({ resolveDomRefSymbols })` — 캡처 시점에 `rlsc`/`qa-coord` 심볼 포함
- `installEditLog(host, { resolveDomRefSymbols })` — host API와 캡처 경로에 resolver 전달
- `mountVisBug(host, { resolveDomRefSymbols })` — bridge에서 resolver 주입

### D5b

- `createDomRefSymbolResolver({ rlsc, qaCoord })` — `locateElement(element)` 결과를 `rlsc`/`qa-coord` 심볼로 변환
- 실제 `packages/rlsc` 패키지 smoke는 패키지 복구/연결 시 추가

### D6 상세 (완료)

- `createTargetRegistry()` — element/canonical/labelId별 catalog 캐시
- `installEditLog()` — `host.targetRegistry`, `getTargetRefByLabelId`, `getTargetRefByElement` 노출
- `buildTargetRef(element, { labelId })` — catalog 생성과 label 매핑을 동시에 수행
- `Selectable.select()` — 선택 시 `data-label-id`와 catalog를 registry에 등록

## 책임

| 레이어 | 위치 |
|--------|------|
| DomRef SSOT | `vendor/projectvisbug/app/dom-ref/` |
| edit-log 소비 | `app/edit-log/entry.js` (D2~) |
| typed surface | `packages/visbug-bridge` (D2~) |
| 좌표 join | `packages/rlsc` (D5) |

## 참조

- edit-log: `docs/specs/visbug-bridge/visbug-edit-log.spec.md`
- bridge: `docs/specs/visbug-bridge/visbug-bridge.spec.md`
- 코드: `vendor/projectvisbug/app/dom-ref/`
