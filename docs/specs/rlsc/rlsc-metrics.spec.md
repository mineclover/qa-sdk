---
def:
  id: rlsc-metrics
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

^purpose

수집된 RLSCDocument에서 설계 메트릭을 계산한다.
게슈탈트 원칙(근접성·연속성·유사성), 황금비, 그리드 패턴, 시각적 균형 등
레이아웃 프레임의 구조적 특성을 수치(`LayoutMetrics`)로 측정한다.
수치를 패턴 어휘로 분류하는 것은 `rlsc-pattern`이 담당한다.

^defines

**타입**

- `LayoutMetrics` — 측정값 집합 (raw 수치)

  *페이지 수준*
  - `balance: { x: number, y: number }` — 좌:우 / 상:하 시각적 무게 비율 (면적 기준)
    - x: `좌측 절반 총 면적 / 우측 절반 총 면적` (1.0 = 균형, 2.0 = 좌측 2배)
    - y: `상측 절반 총 면적 / 하측 절반 총 면적`
  - `dominantFlow: "horizontal" | "vertical" | "grid" | "free"` — 주 흐름 방향
  - `gridPattern: { cols: number, rows: number } | null` — 감지된 도미넌트 영역 그리드
  - `goldenRatioScore: number` — 0–1, 황금비(1.618) 적합도
  - `proximityGroups: ProximityGroup[]` — 근접성 클러스터

  *구조 단위 수준*
  - `columnSystem: { cols: number, gutterPx: number, marginPx: number, rowGapPx?: number } | null`
    — 감지된 컬럼 그리드 시스템 (12, 8, 6, 4, 3, 2, 1 중 하나)
    - `cols`: 컬럼 수. 가시 노드의 x 좌표 클러스터로 추출
    - `gutterPx`: 컬럼 간 간격. adjacent-x 관계에서 median gap
    - `marginPx`: 뷰포트 좌·우 외곽 여백 (left-most 노드 x, right-most 노드 right)
    - `rowGapPx`: 행 간 간격 (adjacent-y median gap). null이면 미감지
  - `spacingValues: number[]` — 감지된 gap·margin 수치 목록 (오름차순, 중복 제거)
  - `spacingBase: number | null` — 가장 작은 공약수 단위 (예: 8 → 8px 배수 시스템)
  - `aspectRatioDistribution: { ratio: number, count: number }[]`
    — 가시 노드의 width/height 비율 분포 (count 내림차순 정렬)

- `ProximityGroup` — 게슈탈트 근접성으로 묶인 노드 집합
  - `nodeIds: string[]`
  - `centroid: { x: number, y: number }` — 그룹 무게 중심
  - `boundingRect: LayoutRect` — 그룹 전체 경계

**함수**

- `packages/rlsc/src/metrics.ts:measureLayout` — `(doc: RLSCDocument) → LayoutMetrics`
  - 아래 측정 함수를 조합하여 단일 LayoutMetrics 반환 (페이지 + 구조 단위 모두)

- `packages/rlsc/src/metrics.ts:measureBalance` — `(nodes, viewport) → { x: number, y: number }`
  - 가시 노드(`visible`)의 면적을 뷰포트 중앙선(x=width/2, y=height/2) 기준으로 분할
  - 한쪽 면적이 0이면 Infinity 대신 관례값 99 반환

- `packages/rlsc/src/metrics.ts:detectGridPattern` — `(grid: LayoutGrid) → { cols: number, rows: number } | null`
  - `extractRegions()` 결과에서 dominant 영역이 규칙적 행·열을 이루는지 판별
  - 행·열 간격 편차가 cellSize × 2 이내이면 그리드로 인정

- `packages/rlsc/src/metrics.ts:scoreGoldenRatio` — `(viewport: { width, height }) → number`
  - `ratio = max(w,h) / min(w,h)`, `score = 1 - abs(ratio - 1.618) / 1.618`
  - 0 미만은 0으로 clamp
  - 분할점(dominant 영역 경계가 0.618 위치에 있는지)도 가산 (+0.2 per matching boundary)

- `packages/rlsc/src/metrics.ts:detectProximityGroups` — `(nodes, gapThreshold?) → ProximityGroup[]`
  - `gapThreshold` 기본값: 32px (ADJACENCY_GAP × 2)
  - 단순 그리디 클러스터링: 아직 미할당 노드에서 시작, gapThreshold 이내 노드 재귀 수집
  - centroid = 그룹 내 노드 rect 중심의 면적 가중 평균

- `packages/rlsc/src/metrics.ts:detectDominantFlow` — `(relations: RLSCRelation[]) → "horizontal" | "vertical" | "grid" | "free"`
  - `flow`, `adjacent-x`, `adjacent-y` 유형만 집계
  - `horizontal > vertical × 1.5` → "horizontal"
  - `vertical > horizontal × 1.5` → "vertical"
  - 양쪽 모두 유의미 → "grid"
  - 나머지 → "free"

- `packages/rlsc/src/metrics.ts:detectColumnSystem` — `(nodes, viewport) → { cols, gutterPx, marginPx, rowGapPx? } | null`
  - 가시 노드를 x 좌표 기준 클러스터링 → 컬럼 경계 추출
  - 컬럼 수가 1, 2, 3, 4, 6, 8, 12 중 하나에 ±1 이내로 근접하면 해당 컬럼 수로 분류
  - 각 클러스터 간 간격 median → `gutterPx`
  - `marginPx`: min(leftmost node x, viewport.width - rightmost node right)
  - 컬럼 패턴 불일치 → null 반환

- `packages/rlsc/src/metrics.ts:measureSpacing` — `(relations: RLSCRelation[], nodes) → { values: number[], base: number | null }`
  - `adjacent-x` 관계의 x 간격 + `adjacent-y` 관계의 y 간격 수집 (px 단위)
  - 중복 제거·정렬 → `values`
  - GCD 알고리즘으로 공약수 단위 추출 → `base` (4 또는 8의 배수면 base = 4 또는 8, 아니면 null)

- `packages/rlsc/src/metrics.ts:measureAspectRatios` — `(nodes) → { ratio: number, count: number }[]`
  - 가시 노드 중 width > 0, height > 0인 것만 대상
  - `ratio = width / height`, 소수점 2자리 반올림 후 집계
  - count 내림차순 정렬

^consumes

- `packages/rlsc/src/types.ts` — RLSCDocument, RLSCNode, LayoutGrid, LayoutRect, RLSCRelation
- `packages/rlsc/src/tree-utils.ts` — flattenTree
- `packages/rlsc/src/grid.ts` — extractRegions (내부 함수 export 필요)

## 구현 항목

- [ ] `LayoutMetrics`, `ProximityGroup` 타입 — `types.ts`에 추가 (columnSystem, spacingValues, spacingBase, aspectRatioDistribution 포함)
- [ ] `metrics.ts` 파일 생성
  - 페이지 수준: `measureBalance`, `detectGridPattern`, `scoreGoldenRatio`, `detectProximityGroups`, `detectDominantFlow`
  - 구조 단위: `detectColumnSystem`, `measureSpacing`, `measureAspectRatios`
  - 조합: `measureLayout`
- [ ] `grid.ts:extractRegions` export 전환 (현재 내부 함수)
- [ ] `index.ts` — `measureLayout`, `LayoutMetrics`, `ProximityGroup` export 추가
- [ ] `metrics.test.ts` — 각 측정 함수 단위 테스트 (DOM 없이 mock 노드)
  - 12-col 배치 → `columnSystem { cols: 12, gutterPx: 16, marginPx: 24 }`
  - spacingValues `[8, 16, 24]` → spacingBase 8
  - dominantFlow: flow/adjacent 관계 집계 검증
