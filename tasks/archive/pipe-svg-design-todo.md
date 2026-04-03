# Pipe SVG 디자인 고도화 TODO

> 생성: 2026-04-02
> 목표: pipeGraphToSvg / viz-web 프리뷰의 노드·엣지 시각 표현 품질 향상

---

## 현황 (as-is)

| 구분 | 현재 상태 |
|------|-----------|
| 노드 shape | rect (rx=4 strict, rx=12 flexible, rx=h/2 folded) 3종 |
| 노드 color | certainty 3종 (green/orange/yellow) |
| 노드 role | 시각 구분 없음 |
| 노드 concern | 시각 구분 없음 |
| 엣지 종류 | stroke-dasharray + stroke-color 단순 구분 |
| 엣지 label | condition 텍스트만 |
| entry node | 구분 없음 |
| 범례 페이지 | 없음 |

---

## 미완료

### P1 — 노드 시각 표현 고도화 (pipe-svg.ts)

#### 1-A. PipeRole 5종 shape 차별화

| role | 현재 | 목표 shape | fill color |
|------|------|-----------|------------|
| `producer` | rect | 오각형(하단 뾰족) + 굵은 테두리 | `#e3f2fd` (파랑 연) |
| `consumer` | rect | 좌측 반원 결합 rect (→ 입구 표시) | `#f3e5f5` (보라 연) |
| `transformer` | rect | 평행사변형 (data in→out) | `#e8f5e9` (초록 연) |
| `router` | rect | 마름모(diamond) | `#fff8e1` (노랑 연) |
| `observer` | rect | 점선 테두리 얇은 rect | `#fce4ec` (분홍 연) |

- SVG path로 각 shape 정의 (`renderNodeShape(role, x, y, w, h)`)
- 현재 certainty color → role color로 primary 전환, certainty는 테두리 스타일로만 표현

#### 1-B. PipeConcern 8종 배지

concerns 배열 → 노드 우상단에 아이콘 배지(◆ 8px) 최대 4개 표시

| concern | 배지 색 | 기호 |
|---------|---------|------|
| `resilience` | `#ef9a9a` | R |
| `latency` | `#ffcc02` | L |
| `concurrency` | `#80cbc4` | C |
| `data-mutation` | `#f48fb1` | M |
| `data-read` | `#a5d6a7` | D |
| `async-coupling` | `#90caf9` | A |
| `data-filtering` | `#ce93d8` | F |
| `observability` | `#b0bec5` | O |

- `renderConcernBadges(concerns, cx, cy, w, h)` 분리 함수

#### 1-C. Entry node 표시

- entryPipeId 노드: 좌측에 삼각형 "▶" 마커 추가
- `renderEntryMarker(x, y, h)` 분리 함수

#### 1-D. Folded node 개선

- 현재: rx=h/2 stadium
- 목표: 이중 테두리(outer+inner rect) + 내부 "×N pipes" 텍스트 표시

---

### P2 — 엣지 시각 표현 고도화 (pipe-svg.ts)

#### 2-A. ConnectionKind 8종 완전 차별화

| kind | 현재 | 목표 stroke | 목표 marker | 색상 |
|------|------|-------------|------------|------|
| `next` | 실선 → | 실선 → | filled arrowhead | `#546e7a` |
| `conditional` | 점선 → | 점선 → + 조건 배지 | open arrowhead | `#1976d2` |
| `event` | 두꺼운 선 | 이중 실선 (stroke + outline) | filled arrowhead (크게) | `#6a1b9a` |
| `error` | 빨간 실선 | 빨간 파선 (3 3) | X cross marker | `#c62828` |
| `compensate` | o--o | 보라 점선 | 양끝 원형 | `#ad1457` |
| `fan-out` | 실선 → | 실선 (연한 파랑) + 분기 원점 | hollow arrowhead | `#0288d1` |
| `join` | 실선 → | 실선 (연한 초록) + 합류 점 | filled arrowhead | `#2e7d32` |
| `feedback` | 점선 → | 곡선 U턴 경로 (arc) + 주황 점선 | open arrowhead | `#e65100` |

- `edgeMarkerDefs()` → defs 섹션에 8종 마커 정의
- `edgePath(from, to, kind)` → kind별 path d 계산 (feedback=arc, 나머지=bezier)
- feedback edge: 같은 방향으로 U턴하는 arc 경로 (controlY 오프셋 +60)

#### 2-B. Conditional edge 조건 라벨 배지

- 현재: plain text
- 목표: 배경 rect + 텍스트 (pill 형태, `#e3f2fd` 배경)

#### 2-C. 엣지 굵기 차별화

| kind | stroke-width |
|------|-------------|
| `event` | 3px |
| `error`, `compensate` | 2.5px |
| `next`, `conditional`, `fan-out`, `join` | 2px |
| `feedback` | 1.5px (약함) |

---

### P3 — Design Catalog 페이지 (viz-web)

**파일**: `packages/viz-web/pipe-design.html` + `src/pipe-design.ts`

#### 3-A. 노드 갤러리 섹션

- PipeRole 5종 × certainty 3종 = 15 노드 카드 격자
- 각 카드: 미니 SVG 노드 + role명 + certainty명
- concerns 배지 8종 개별 표시 샘플

#### 3-B. 엣지 갤러리 섹션

- ConnectionKind 8종 각각: A──────→B 미니 SVG (150×60)
- kind 이름 + 설명 텍스트 + 색상 코드 표시

#### 3-C. 실제 그래프 섹션

- "선형 체인 / 분기 / 팬아웃 / 에러 처리" 4가지 미니 그래프
- 고도화된 디자인 적용 확인용

#### 3-D. 범례(Legend) 오버레이

- pipe-preview.html에도 우하단 토글 버튼으로 범례 패널 추가

---

## 작업 순서

```
1-D (folded) → 1-A (role shape) → 1-B (concern 배지) → 1-C (entry)
     ↓
2-A (edge 8종) → 2-B (조건 라벨) → 2-C (굵기)
     ↓
P3 design catalog 페이지
```

### 구현 파일

| 파일 | 작업 |
|------|------|
| `packages/core/src/pipe/pipe-svg.ts` | P1, P2 전체 |
| `packages/core/src/pipe/pipe-svg.test.ts` | 새 shape/marker 테스트 추가 |
| `packages/viz-web/pipe-design.html` | P3 신규 |
| `packages/viz-web/src/pipe-design.ts` | P3 신규 |
| `packages/viz-web/pipe-preview.html` | 범례 오버레이 추가 |

---

## 완료

- [x] P1-A PipeRole 5종 shape 차별화 (producer/consumer/transformer/router/observer)
- [x] P1-B PipeConcern 8종 배지 (우측 원형 배지, 최대 4개)
- [x] P1-C Entry node 마커 (좌측 삼각형 ▶)
- [x] P1-D Folded node 이중 테두리 + ×N pipes 텍스트
- [x] P2-A ConnectionKind 8종 완전 차별화 (색/선/마커)
- [x] P2-B Conditional edge 조건 라벨 pill 배지
- [x] P2-C 엣지 굵기 차별화 (event=3px, error/compensate=2.5px, 나머지=2px)
- [x] P3 Design Catalog 페이지 (pipe-design.html + pipe-design.ts)
  - 노드 갤러리: role 5종, certainty 3종, folded 3단계
  - 엣지 갤러리: ConnectionKind 8종
  - concern 배지 8종
  - 실전 샘플 4가지
