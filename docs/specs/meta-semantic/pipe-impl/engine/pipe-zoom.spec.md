---
def:
  id: pipe-zoom
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: meta-semantic-folding
      type: depends_on
    - target: pipe-analyze
      type: depends_on
    - target: pipe-interpret
      type: depends_on
---

# PipeGraph 줌 레벨 시각화 데이터 모델

## 목적 ^purpose

PipeGraph를 3단계 줌 레벨(group/module/leaf)로 변환하여
시각화 렌더러(Mermaid, D3, Canvas 등)에 넘길 데이터를 계산한다.
실제 렌더링은 하지 않으며, 노드/엣지/레이아웃/스타일 데이터만 제공한다.

## 정의 ^defines

- `ZoomView` — 특정 줌 레벨의 노드/엣지/요약 뷰
- `ZoomNode` — 위치·크기·스타일·역할·관심사를 포함한 렌더링 노드
- `ZoomEdge` — 연결 종류와 조건을 포함한 렌더링 엣지
- `ZoomNodeStyle` — 타입 확실성(strict/flexible/mixed) 시각 인코딩
- `ZoomLevelMap` — 3단계 줌 뷰 일괄 맵

## 소비 ^consumes

- `PipeGraph`, `PipeSpec`, `PipeConnection` (pipe-spec.ts)
- `foldSubgraph`, `detectFoldRegions`, `FoldedContract` (pipe-fold.ts)
- `countPipePaths`, `countGraphPaths` (pipe-path.ts)
- `extractPipeConcerns`, `propagatePipeConcerns`, `classifyPipeRole` (pipe-interpret.ts)

---

## 3 패싯

### 뷰 계산 (view)

줌 레벨에 따라 PipeGraph를 접어서 ZoomView를 생성한다.

| 함수 | 입력 | 설명 |
|------|------|------|
| `computeZoomView(graph, level)` | PipeGraph + FoldLevel | 단일 줌 레벨 뷰 계산 |
| `computeZoomLevels(graph)` | PipeGraph | 3단계 일괄 계산 → ZoomLevelMap |

줌 레벨별 접기 전략:

| 레벨 | 접는 영역 | 결과 |
|------|----------|------|
| `group` | scope-cluster + linear-chain + SCC 전부 | 최대 축소 |
| `module` | linear-chain + SCC만 (scope-cluster 유지) | 중간 상세 |
| `leaf` | 없음 | 전체 파이프 노출 |

불변량: `group.nodes ≤ module.nodes ≤ leaf.nodes` (단조 증가)

테스트: `pipe-zoom-view.test.ts` (16 tests)

### 레이아웃 (layout)

위상 정렬 기반 DAG 레이아웃. 노드 x/y 좌표를 할당한다.

| 함수 | 설명 |
|------|------|
| `computeLayout(view)` | ZoomView의 노드 위치 계산 → ZoomView 반환 |

알고리즘:
1. **레이어 할당** — 최장 경로 기반 (incoming 없는 노드 = layer 0)
2. **레이어 내 정렬** — barycenter 휴리스틱 (부모 평균 위치 기준)
3. **좌표 변환** — layer → x (LAYER_GAP=200px), 레이어 내 인덱스 → y (NODE_GAP=100px)

테스트: `pipe-zoom-layout.test.ts` (4 tests)

### 스타일 (style)

타입 확실성 시각 인코딩 + 노드 크기 + 관심사 추출.

| 개념 | 판정 기준 | 시각 인코딩 |
|------|----------|-----------|
| `strict` | dataContract의 모든 타입이 concrete | polygon + solid + 차가운 색 |
| `flexible` | any/unknown/Record<string,any>/T 포함 | cloud + dashed + 따뜻한 색 |
| `mixed` | strict + flexible 혼재 | cloud + dashed |

노드 크기: `BASE × (1 + log₂(paths) × 0.5)` — 경로 수에 비례

관심사: leaf 레벨은 `propagatePipeConcerns`(전파 포함), 그 외는 `extractPipeConcerns`(직접만)

테스트: `pipe-zoom-style.test.ts` (6 tests)

---

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/pipe-zoom.ts` | 구현 (타입 + 뷰 + 레이아웃 + 스타일) |
| `core/src/pipe-zoom-view.test.ts` | 뷰 패싯 테스트 (16 tests) |
| `core/src/pipe-zoom-layout.test.ts` | 레이아웃 패싯 테스트 (4 tests) |
| `core/src/pipe-zoom-style.test.ts` | 스타일 패싯 테스트 (6 tests) |
| `core/src/__fixtures__/pipe-zoom-fixtures.ts` | 공유 fixture |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-zoom   # 26 tests (3 files)
```
