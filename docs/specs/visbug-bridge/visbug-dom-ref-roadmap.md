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
| **D2** | 예정 | `EditLogTarget.catalog` + `entry.js` 연동, legacy 필드 파생 | edit-log unit + integration |
| **D3** | 예정 | `replay` / formatters → `resolveDomRef` | replay spec |
| **D4** | 예정 | `queryTargets` + search/selectable API | playwright |
| **D5** | 예정 | rlsc `locateElement` join 확장 | rlsc smoke |
| **D6** | 예정 | 세션 `TargetRegistry` (canonical → catalog 캐시) | optional |

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

### D2 상세

- `createEntry()` → `target.catalog`, `target.primary`
- `selector` / `nodePath` — `primary`·legacy에서 파생 (하위 호환)
- `correlationId` — `canonical.value` 기반 전환 검토

### D3–D6

- D3: replay weakRef → symbols → canonical
- D4: VisBug search를 `queryTargets({ by: 'css' })` 래핑
- D5: 캡처 시 rlsc 심볼 주입
- D6: 선택 시 catalog 캐시 (`data-label-id` 매핑)

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
