---
def:
  id: rlsc-plan
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: rlsc
  tags: [structural]
  links:
    - target: rlsc
      type: refines
---

# R.L.S.C.™ 구현 계획

> **[Superseded]** Phase 1–2 완료. 현행 계획은 `rlsc-facets.plan.md` 참조. Phase 3(LayoutMonitor)은 제거가 아닌 구현 방향으로 변경됨.

## 현황 평가 (코드 직접 검토)

| 모듈 | 상태 | 비고 |
|------|------|------|
| `collector.ts` | 완료 | nodeCounter 이미 per-call 리셋 ✓ |
| `grid.ts` | 완료 | extractRegions 그리드 병합 로직 완전 |
| `layers.ts` | 완료 | z-index 6구간 분류 정확 |
| `relations.ts` | 완료 | 8종 공간 관계 + flow 탐지 |
| `encoder.ts` | 버그 있음 | cellSize:120 하드코딩, root 타입 cast |
| `context.ts` | 버그 있음 | `{layers}` 미교체, `unknown as string` |
| `query.ts` | 완료 | 불변 갱신, diff 5종 |
| `types.ts` | 완료 | LayoutMonitor 인터페이스 stub 존재 |
| 테스트 | **없음** | vitest 설치만, .test.ts 0개 |
| 브라우저 가드 | **없음** | window/document 직접 사용 |
| 다른 패키지 연동 | **없음** | 고립 상태 |

---

## Phase 1 — 버그 수정

### 1-1. 브라우저 환경 가드

`packages/rlsc/src/collector.ts` — `collectLayout()` 진입부 (현재 line 188):

```typescript
export function collectLayout(root?: Element, options?: CollectorOptions): RLSCDocument {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('collectLayout은 브라우저 환경에서만 실행 가능합니다')
  }
  nodeCounter = 0
  ...
}
```

### 1-2. encoder.ts:126 — cellSize:120 수정

`parseMarkup` 내 grid 플레이스홀더:

```typescript
// 변경 전 (버그)
grid: { cellSize: 120, cols: 0, rows: 0, cells: [] }

// 변경 후 — 재계산 불가 플레이스홀더임을 명시
grid: { cellSize: 0, cols: 0, rows: 0, cells: [] }
```

`cellSize: 0`으로 "재계산 필요" 시그널을 명시. 120은 근거 없는 임의값.

### 1-3. context.ts:288 — {layers} 교체 누락 버그

`accessibility-audit` 템플릿에 `{layers}` 플레이스홀더가 있지만 `buildPrompt` 함수에서 교체 없음. 두 가지 수정 방법:

**Option A (권장)** — `buildPrompt` 함수에 `layers` 파라미터 추가:
```typescript
function buildPrompt(purpose, data: { ..., layers: string }) {
  template = template.replace('{layers}', data.layers)
}
```
`generateDesignContext`에서 `layersToText(doc.layers)` 계산 후 전달.

**Option B** — 템플릿에서 `{layers}` → `{relations}`로 통일 (간단하나 정보 손실).

### 1-4. context.ts:18 — 타입 핵 제거

```typescript
// 변경 전
const DEFAULT_CONTEXT_OPTIONS: Required<ContextOptions> = {
  focus: undefined as unknown as string,
  ...
}

// 변경 후 — Required<ContextOptions> 대신 명시적 타입
const DEFAULT_CONTEXT_OPTIONS = {
  purpose: 'layout-analysis' as ContextPurpose,
  focus: undefined,
  sections: ['tree', 'grid', 'layers', 'relations'] as const,
  maxTokens: 4000,
} satisfies Partial<ContextOptions>
```

---

## Phase 2 — 테스트

**목표**: 기하 계산 + 파이프라인 왕복 검증 (브라우저 DOM 없이 pure 로직만 테스트)

### 2-1. encoder 라운드트립

```typescript
// packages/rlsc/src/encoder.test.ts
const mockDoc: RLSCDocument = {
  version: '1.0', viewport: { width: 1920, height: 1080 },
  url: 'https://test.example', timestamp: '2026-01-01T00:00:00Z',
  root: { id: 'div#root', tag: 'div', ... },
  grid: { cellSize: 16, cols: 120, rows: 68, cells: [...] },
  layers: [...], relations: [...]
}
const markup = encodeToMarkup(mockDoc)
const parsed = parseMarkup(markup)
expect(parsed.root?.id).toBe('div#root')
expect(parsed.viewport).toEqual({ width: 1920, height: 1080 })
```

### 2-2. relations 기하 경계 케이스

순수 기하 함수이므로 DOM 없이 테스트 가능:

| 테스트 | 기대값 |
|--------|--------|
| A rect 완전 포함 B (depth A < B) | contains |
| 겹침 비율 정확히 0.1 (10%) | overlaps 포함 |
| 겹침 비율 정확히 0.8 (80%) | stacked (z 다를 때) |
| x 간격 16px | adjacent-x 포함 |
| x 간격 17px | adjacent-x 제외 |
| 왼쪽 정렬 차이 4px | aligned-x 포함 |
| 형제 노드 2개 | flow 1건 |

### 2-3. grid 분석

DOM 없이 mock RLSCNode 트리로 테스트:
- 16px cellSize 기본값 검증
- dominant 선택 — 가장 넓은 교차 면적 노드
- coverage 0~1 범위 보장

### 2-4. query API

- `queryNodes({ role: 'banner' })` — role 필터
- `queryNodes({ minArea: 1000, maxArea: 5000 })` — 면적 범위
- `queryNodes({ zRange: { min: 10 } })` — z-index 범위
- `diffDocuments(before, after)` — added / removed / moved / resized / reordered 각각 검증

### 2-5. context 토큰 예산

- `maxTokens: 10` → structure가 truncate + `... (truncated)` 포함 검증

---

## Phase 3 — LayoutMonitor 결정

현재 `types.ts`에 인터페이스만 존재. **사용처 없음**.

**권장: 인터페이스 제거 (Option B)**

이유:
- 현재 0개 소비자
- MutationObserver/ResizeObserver는 브라우저 전용 → 테스트 어려움
- 구현 복잡도 대비 즉각적 가치 없음
- 필요 시 v2에서 추가 가능

제거 범위:
- `types.ts` — `LayoutMonitor`, `LayoutChange` 인터페이스
- `index.ts` — 두 타입 export 제거

---

## Phase 4 — 통합

### 4-1. rlsc.html → npm 패키지 연결

현재 715줄 독립 HTML. rlsc npm 패키지를 실제 import하도록 연결:

```html
<script type="module">
  import {
    collectLayout, encodeToMarkup, analyzeGrid,
    classifyLayers, detectRelations, generateDesignContext
  } from '../../packages/rlsc/dist/index.js'  // 개발 중 직접 경로
  window.rlsc = { collectLayout, encodeToMarkup, analyzeGrid, ... }
</script>
```

현재 HTML 내부 JS가 같은 로직을 인라인으로 구현하고 있어 드리프트 발생 위험.

### 4-2. 소비자 추가

`browser-sdk`에서 QA 이벤트 수집 시 레이아웃 컨텍스트 첨부:

```typescript
// 이벤트 emit 직전 레이아웃 스냅샷을 메타데이터로 추가
import { collectLayout, generateDesignContext } from 'rlsc'
const layout = collectLayout()
const ctx = generateDesignContext(layout, { purpose: 'layout-analysis', maxTokens: 500 })
emit({ ...event, rlscContext: ctx.summary })
```

---

## 실행 순서

```
Phase 1 (1-2, 1-3 우선 — 실제 버그) → Phase 1 (1-1, 1-4)
     → Phase 2 (테스트)
     → Phase 3 (LayoutMonitor 제거)
     → Phase 4 (통합)
```

Phase 1의 1-2(cellSize 버그), 1-3({layers} 버그)가 가장 즉각적인 수정 항목.
Phase 2 완료 전 Phase 4 진행 권장하지 않음.
