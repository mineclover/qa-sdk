---
def:
  id: rlsc-facets-plan
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: rlsc
  links:
    - target: rlsc
      type: refines
---

# R.L.S.C.™ 패싯 설계

## 원칙

- 각 패싯은 단일 책임 + 명확한 입출력 계약
- 패싯 간 의존 방향은 단방향 (레벨 위 → 아래 금지)
- 수집(Collection)은 좌표만, 해석(Interpretation)은 수집 결과로만 동작

---

## 패싯 맵

```
[레벨 0] 수집
  collect      DOM → RLSCNode[] (x,y,w,h,zIndex,depth)       브라우저 전용

[레벨 1] 공간 분해        입력: RLSCNode[]
  grid         → LayoutGrid       셀 행렬 (점유, zStack, dominant)
  layers       → LayerStack[]     z-index 구간별 레이어 그룹
  relations    → RLSCRelation[]   8종 공간 관계 (adjacent, contains, flow...)

[레벨 2] 수치 측정        입력: collect + decompose 결과
  measure      → LayoutMetrics    기하에서 설계 수치 추출
                                  (balance, columnSystem, spacing, aspectRatio...)

[레벨 3] 패턴 분류        입력: LayoutMetrics
  classify     → LayoutPattern    수치를 패턴 어휘로 변환
                                  (gridPattern, gridSystem, flowDirection...)

[레벨 4] 검증             입력: declared LayoutPattern + 문서
  conform      → ConformanceResult  선언 vs 인식 비교 + 위반 리포트

[레벨 5] 관측             입력: Element + declared?
  monitor      → LayoutMonitor    DOM 변화 → 자동 재수집 → 재검증 루프

────────────────────────────────────────────────────────────
[출력 패싯]  입력: RLSCDocument (임의 레벨에서 소비)

  serialize    → RLSC/1.0 마크업 문자열        encoder.ts
  visualize    → Canvas / SVG 이미지           canvas.ts
  contextualize→ LLM 프롬프트                  context.ts
  query        → 노드 검색, 문서 diff          query.ts
```

---

## 현재 구조 vs 패싯 경계

### 현황: collect와 decompose가 결합됨

```typescript
// collector.ts 현재 구현
export function collectLayout(root?, options?) → RLSCDocument {
  const rootNode = collectNode(...)       // 레벨 0: DOM → 좌표
  const flatNodes = flattenTree(rootNode)
  return {
    root: rootNode,
    grid:      analyzeGrid(rootNode, viewport),   // 레벨 1: 분해
    layers:    classifyLayers(flatNodes),          // 레벨 1: 분해
    relations: detectRelations(flatNodes),         // 레벨 1: 분해
  }
}
```

`collectLayout` 하나가 레벨 0 + 레벨 1을 모두 수행한다.

### 분리 옵션

**Option A — 현행 유지 (편의 API)**

```
collectLayout()  →  RLSCDocument (root + grid + layers + relations)
```

- 장점: API 단순. 소비자가 한 번만 호출
- 단점: 그리드 cellSize만 바꾸고 싶어도 전체 재수집. 분해 단계를 독립 테스트하기 어려움
- 적합한 경우: 사용처가 "화면 전체를 한 번에 찍어서 넘긴다"는 단순 시나리오

**Option B — 레벨 0 / 레벨 1 분리**

```
collectRaw(element)  →  RLSCNodeTree { root: RLSCNode }   // 레벨 0만
decompose(tree, options?) → RLSCDocument                  // 레벨 1 조합
collectLayout(element, options?) → RLSCDocument           // 편의 래퍼 (A 호환)
```

- 장점: cellSize 변경 시 `decompose`만 재호출. 각 레벨 독립 테스트 가능
- 단점: 내부 타입(`RLSCNodeTree`) 추가. API surface 증가
- 적합한 경우: 동일 DOM에서 다른 설정으로 여러 분석을 수행할 때

**Option C — 지연 분해 (lazy decompose)**

```typescript
const doc = collectLayout(root, {
  grid: { cellSize: 32 },   // 설정 있으면 분석, 없으면 스킵
  layers: true,
  relations: false,
})
```

- 장점: 불필요한 분석 생략 가능. 현행 API 호환
- 단점: 옵션 조합이 복잡해짐. 미분석 필드를 소비자가 체크해야 함

### 권장

**단기: Option A 유지** — 현재 소비자가 없고 테스트도 없으므로 API를 바꿀 비용 대비 이득이 작음.
**중기: Option B 방향** — `metrics.ts` 구현 시 `collectRaw`/`decompose` 분리가 테스트를 단순화함.
테스트에서 DOM 없이 `RLSCNodeTree`를 mock으로 넘기고 `decompose`만 테스트 가능.

---

## 패싯별 계약 명세

### collect

| 항목 | 내용 |
|------|------|
| 파일 | `collector.ts`, `tree-utils.ts` |
| 입력 | `Element`, `CollectorOptions` |
| 출력 | `RLSCDocument` (현행) / `RLSCNodeTree` (Option B) |
| 제약 | 브라우저 전용. 해석 없음. 좌표·CSS 원본값만 기록 |
| 테스트 | 브라우저 환경 가드, nodeCounter 리셋, address 추출 |

### decompose/grid

| 항목 | 내용 |
|------|------|
| 파일 | `grid.ts` |
| 입력 | `RLSCNode` tree, `viewport`, `cellSize?` |
| 출력 | `LayoutGrid` |
| 제약 | 순수 함수. DOM 없이 동작. `RLSCNode[]`만 의존 |
| 테스트 | cellSize 기본값, dominant 선택, coverage clamp, 빈 셀 |

### decompose/layers

| 항목 | 내용 |
|------|------|
| 파일 | `layers.ts` |
| 입력 | `RLSCNode[]` |
| 출력 | `LayerStack[]` |
| 제약 | 순수 함수. z-index 구간 기준 (6 구간) |
| 테스트 | z=0 → background, z=1000 → modal, 혼재 노드 분류 |

### decompose/relations

| 항목 | 내용 |
|------|------|
| 파일 | `relations.ts` |
| 입력 | `RLSCNode[]` |
| 출력 | `RLSCRelation[]` |
| 제약 | 순수 기하 함수. O(n²) 쌍 순회. contains 우선 판정 |
| 테스트 | 8종 관계 기하 경계 케이스 (gap 16/17px, overlap 0.1/0.8) |

### measure

| 항목 | 내용 |
|------|------|
| 파일 | `metrics.ts` |
| 입력 | `RLSCDocument` |
| 출력 | `LayoutMetrics` |
| 제약 | 순수 함수. decompose 결과(grid, relations)를 재사용 |
| 포함 | `classifyLayout(LayoutMetrics) → LayoutPattern` |
| 테스트 | 각 측정 함수 단위 + classifyLayout 변환 |

*`classifyLayout`이 measure 패싯에 있는 이유:*
측정값을 어휘로 변환하는 것은 측정값 구조에 완전히 종속됨.
별도 파일로 분리해도 항상 같이 변경되므로 measure 패싯 내 유지.

### conform

| 항목 | 내용 |
|------|------|
| 파일 | `intent.ts` |
| 입력 | `RLSCDocument`, `declared: LayoutPattern` |
| 출력 | `ConformanceResult` |
| 포함 | `recognizeLayout(doc) → LayoutPattern` (선언 없이 패턴만 인식) |
| 제약 | measure 패싯 의존. DOM 의존 없음 (서버 실행 가능) |
| 테스트 | 위반 탐지 5종, score 계산, 선언 없음 → score 1.0 |

### monitor

| 항목 | 내용 |
|------|------|
| 파일 | `monitor.ts` |
| 입력 | `Element`, `MonitorOptions { declared?, debounceMs? }` |
| 출력 | `LayoutMonitor` (start/stop/snapshot/changes/onConformanceChange) |
| 제약 | 브라우저 전용. MutationObserver + ResizeObserver |
| 의존 | collect + conform 패싯 |
| 테스트 | 브라우저 가드, debounce 단위 테스트 (타이머 mock) |

### serialize (출력)

| 항목 | 내용 |
|------|------|
| 파일 | `encoder.ts` |
| 입력 | `RLSCDocument` |
| 출력 | RLSC/1.0 마크업 문자열 |
| 제약 | 순수 함수. DOM 없이 동작 |
| 테스트 | 라운드트립, 이스케이프, address 필드 |

### visualize (출력)

| 항목 | 내용 |
|------|------|
| 파일 | `canvas.ts` |
| 입력 | `RLSCDocument`, `CanvasRenderOptions` |
| 출력 | Canvas render (브라우저) / SVG string (서버) |
| 제약 | `renderToSVG`는 DOM 없이 동작 (테스트 가능) |
| 테스트 | `renderToSVG` 출력 rect 수, 색상 매핑, depth 그라데이션 |

### contextualize (출력)

| 항목 | 내용 |
|------|------|
| 파일 | `context.ts` |
| 입력 | `RLSCDocument`, `ContextOptions` |
| 출력 | `DesignContext { summary, structure, prompt }` |
| 제약 | 순수 함수. serialize 패싯 의존 (encodeToMarkup 재사용) |
| 테스트 | 토큰 예산 truncate, purpose별 프롬프트 템플릿 |

### query (유틸리티)

| 항목 | 내용 |
|------|------|
| 파일 | `query.ts` |
| 입력 | `RLSCDocument`, query params |
| 출력 | `RLSCNode[]`, `LayoutDiff` |
| 제약 | 순수 함수. 불변 갱신 (원본 변경 없음) |
| 테스트 | 조건 필터 4종, diff 5종 (added/removed/moved/resized/reordered) |

---

## 패싯 간 의존 그래프

```
DOM
 └─ collect ──────────────────────────────── monitor (브라우저)
      │
      ├─ decompose/grid ──┐
      ├─ decompose/layers ┼── measure ── classify ── conform ── monitor
      └─ decompose/relations┘

RLSCDocument (어느 시점이든)
      ├─ serialize    (독립)
      ├─ visualize    (독립, measure.LayoutMetrics 선택적 오버레이)
      ├─ contextualize(serialize 의존)
      └─ query        (독립)
```

규칙: 출력 패싯(serialize/visualize/contextualize/query)은 상위 해석 레벨(measure/classify/conform)에 의존하지 않는다. `RLSCDocument` 좌표만으로 동작한다.

---

## 구현 순서

```
Phase 2: 테스트 — 기존 패싯(grid, layers, relations, encoder, query, context) 검증
Phase 3: monitor.ts 구현 (collect + conform 의존)
Phase 5: metrics.ts 구현 (measure + classify)
Phase 6: intent.ts 구현 (conform)
Phase 7: canvas.ts 구현 (visualize)
```

measure/classify 없이 conform 구현 불가 → Phase 5 → Phase 6 순서 고정.
monitor는 conform 완료 후 onConformanceChange 연결 → Phase 6 이후 완성.
