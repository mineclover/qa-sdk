---
status: source-backed
sources:
  - packages/rlsc-analysis/src/index.ts
  - packages/rlsc-analysis/src/browser.ts
  - packages/rlsc-analysis/src/index.test.ts
  - packages/rlsc-analysis/README.md
  - docs/archive/todo/rlsc-text-occupancy.todo.md
---

# RLSC × pretext 텍스트 점유 분석 통합 설계

> 2026-04-06. RLSC에 pretext 라이브러리를 통합하여 텍스트의 시각적 공간 점유를 측정한다.
> 2026-07-08 현재 구현 소유 표면은 `packages/rlsc-analysis`이며, 기존 `rlsc` 명칭은 이 설계의 역사적 패키지명으로 읽는다.

## 목적

RLSC는 현재 요소의 bounding box만 수집하고, 그 안에서 **텍스트가 실제로 얼마나 공간을 차지하는지** 알지 못한다. `@chenglou/pretext`의 DOM-free 텍스트 측정을 통합하여:

1. **디자인 품질 분석** — 텍스트가 컨테이너 대비 x/y 축 점유율, 경계 접촉 여부, 여백 분포 판단
2. **LLM 컨텍스트 최적화** — 텍스트 시각적 가중치를 `generateDesignContext()`에 반영
3. **반응형 예측** — 뷰포트 변경 시 텍스트 리플로우를 DOM 없이 예측

## 아키텍처 대칭

RLSC와 pretext는 동일한 2단계 패턴을 공유한다:

| | RLSC | pretext |
|---|---|---|
| Heavy phase (1회) | `collectLayout()` — DOM 순회 | `prepare()` — 텍스트 분할 + Canvas 측정 |
| Light phase (N회) | `measureLayout()` — 캐시된 노드로 산술 | `layout()` — 캐시된 너비로 산술 |
| 캐시 단위 | `RLSCNode` (rect, zIndex...) | `PreparedText` (widths[], kinds[]) |

이 대칭을 살려 **수집 시 prepare, 후처리 시 layout**으로 자연스럽게 끼운다.

## 데이터 흐름

```
collectLayoutWithText(element)          ← 신규 함수 (기존 collectLayout 유지)
  ├─ collectNode()          → RLSCNode + fontInfo (기존 확장)
  ├─ getComputedStyle()     → fontString, lineHeight, textAlign, padding
  └─ prepare(fullText, fontString) → PreparedText
       ↓
  { doc: RLSCDocument, textPrepared: TextPreparedMap }
       ↓ (후처리)
analyzeTextOccupancy(doc, preparedMap)
  ├─ layout(prepared, contentWidth, lineHeight) → height, lineCount
  ├─ measureLineStats(prepared, contentWidth)   → maxLineWidth
  ├─ measureNaturalWidth(prepared)              → shrinkWrap width
  └─ text-align + padding 반영 → TextOccupancy[]
       ↓
aggregateTextRegions(doc, occupancies)
  └─ extractRegions() + TextOccupancy[] → 영역별 텍스트 밀도
```

## 핵심 설계 결정

### 1. PreparedText 저장: 별도 Map

`RLSCNode`에 넣지 않는다. 이유:
- PreparedText는 불투명(opaque) 타입, JSON 직렬화 불가
- RLSCNode는 순수 직렬화 가능 데이터로 유지해야 함
- `TextPreparedMap = Map<nodeId, PreparedText>` 으로 분리

### 2. fontInfo는 RLSCNode에 추가

fontString, lineHeight, textAlign, padding은 원시값. 직렬화 가능하므로 노드에 부착:

```typescript
interface TextFontInfo {
  readonly fontString: string    // "500 16px Inter"
  readonly lineHeight: number    // px
  readonly textAlign: string     // left|center|right|justify
  readonly padding: { top: number; right: number; bottom: number; left: number }
}
```

`RLSCNode.fontInfo?: TextFontInfo` — 텍스트가 있는 노드에만 존재.

### 3. content-box 기준 측정

텍스트가 사용할 수 있는 실제 영역 = rect - padding:

```
contentWidth  = rect.width  - padding.left - padding.right
contentHeight = rect.height - padding.top  - padding.bottom
```

### 4. text-align → 텍스트 x 위치 결정

```
left:    textX = padding.left
center:  textX = padding.left + (contentWidth - maxLineWidth) / 2
right:   textX = padding.left + contentWidth - maxLineWidth
justify: textX = padding.left (각 줄이 contentWidth를 채움)
```

### 5. 경계 접촉 판정

각 방향의 여백(margin)이 threshold(기본 4px) 미만이면 접촉으로 판정:

```
margin.top    = textY  (padding.top 기준 상대)
margin.bottom = contentHeight - textHeight - margin.top
margin.left   = textX - padding.left
margin.right  = contentWidth - maxLineWidth - margin.left
```

### 6. pretext API 매핑

| RLSC 필요 | pretext API | 비고 |
|-----------|-------------|------|
| x축 점유율 | `measureLineStats(p, w).maxLineWidth / contentWidth` | fillX |
| y축 점유율 | `layout(p, w, lh).height / contentHeight` | fillY |
| 줄 수 | `layout(p, w, lh).lineCount` | 직접 |
| 반응형 예측 | `layout(same p, newWidth, lh)` | prepare 재실행 불필요 |
| shrink-wrap 크기 | `measureNaturalWidth(p)` | 자연 너비 |
| 줄별 너비 (LLM) | `layoutWithLines(p, w, lh).lines[].width` | 상세 컨텍스트용 |

## 출력 타입

```typescript
interface TextOccupancy {
  readonly nodeId: string
  readonly renderedRect: LayoutRect      // 뷰포트 좌표 기준 텍스트 실제 영역
  readonly fillX: number                 // 0–1, x축 점유율
  readonly fillY: number                 // 0–1, y축 점유율
  readonly lineCount: number
  readonly naturalWidth: number          // shrink-wrap 너비
  readonly margins: { top: number; right: number; bottom: number; left: number }
  readonly boundaryContact: { top: boolean; right: boolean; bottom: boolean; left: boolean }
  readonly overflows: boolean            // 텍스트가 컨테이너 밖으로 넘침
}

interface TextRegionDensity {
  readonly regionId: string              // GridRegion nodeId
  readonly textArea: number              // 영역 내 텍스트 총 면적 (px²)
  readonly regionArea: number            // 영역 면적 (px²)
  readonly density: number               // 0–1, textArea / regionArea
  readonly avgFillX: number              // 영역 내 노드 평균 x 점유
  readonly avgFillY: number              // 영역 내 노드 평균 y 점유
  readonly contactCount: number          // 경계 접촉 노드 수
}
```

## 통합 지점

| 기존 모듈 | 변경 |
|-----------|------|
| `types.ts` | `TextFontInfo`, `TextOccupancy`, `TextRegionDensity` 타입 추가 |
| `collector.ts` | `collectNode()`에서 font 정보 수집, `collectLayoutWithText()` 신규 함수 |
| `metrics.ts` | `measureLayout()`에 텍스트 메트릭 통합 가능 |
| `context.ts` | `generateDesignContext()`에 텍스트 점유 정보 섹션 추가 |
| `intent.ts` | `checkConformance()`에 텍스트 경계 위반 규칙 추가 가능 |
| **신규** `text-occupancy.ts` | `analyzeTextOccupancy()`, `aggregateTextRegions()` |

## API 전략

기존 `collectLayout()` 시그니처를 유지하고, `collectLayoutWithText()`를 별도 함수로 추가:

```typescript
// 기존 — 변경 없음
export function collectLayout(root?, options?): RLSCDocument

// 신규 — doc + textPrepared 함께 반환
export function collectLayoutWithText(root?, options?): {
  doc: RLSCDocument
  textPrepared: TextPreparedMap
}
```

내부적으로 `collectNode()`를 공유하여 로직 중복 없음. 향후 `collectLayout()` deprecation 경로 확보.

## 테스트 전략

이중 전략:

- **단위 테스트** (Node.js): pretext를 mock하여 `text-occupancy.ts` 순수 산술 로직 검증. `prepare()`/`layout()`/`measureLineStats()` 반환값을 stub.
- **통합 테스트** (Playwright): 브라우저 환경에서 실제 Canvas + pretext E2E 검증. `platform-demo` rlsc 페이지 활용.

이유: text-occupancy 로직(margin, boundary contact, text-align 오프셋)은 순수 산술. 실제 폰트 메트릭 정확성은 브라우저에서만 의미 있으므로 Node.js에서 native Canvas 의존성 불필요.

## 성능

- pretext `prepare()`: ~0.0002ms/block (공식 벤치마크). 1000 노드 = ~0.2ms — 병목 아님
- `getComputedStyle()` 비용은 이미 `collectNode()`에서 발생 — 추가 비용 없음
- 기존 collectNode 필터(`minSize`, `visible`)가 적용된 노드만 prepare 호출 — 별도 필터 불필요
- pretext 내부 캐시가 동일 font×segment 재사용 → 동일 폰트 반복 텍스트(버튼, 메뉴) 자동 최적화

## 제약

- `prepare()`는 브라우저 Canvas API 필요 — 서버 환경에서는 OffscreenCanvas 또는 미지원
- pretext는 `@chenglou/pretext`로 직접 의존성 추가
- 이모지 보정은 pretext 내부에서 자동 처리 (별도 작업 불필요)
- `system-ui` 폰트는 macOS에서 부정확 — getComputedStyle resolved font 사용 권장
