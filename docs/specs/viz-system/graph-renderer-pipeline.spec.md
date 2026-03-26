---
def:
  id: graph-renderer-pipeline
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: graph-renderer-spec
      type: refines
---

# 그래프 렌더러 파이프라인

## 목적 ^purpose

`SpecGraph`를 DAG 레이아웃으로 배치하고 SVG로 렌더링하는 그래프 렌더러의 핵심 파이프라인을 정리한다.

## 구성 ^overview

platform-demo의 diagram.html이 DKG 그래프를 Mermaid 기반 DAG로 렌더링한다. 사이드바에서 다이어그램을 선택하면, 노드/엣지 데이터를 Mermaid 문법으로 변환하고 SVG로 렌더링한다. 별도로 viz-3d-core.js가 좌표 축을 Three.js 3D 그리드로 시각화한다.

## 렌더링 파이프라인

```
registry-service API
  │
  ├── /api/diagrams → 다이어그램 목록
  │     └── 사이드바 트리 뷰에 표시
  │
  └── /api/diagrams/:id → 단일 다이어그램 데이터
        │
        ├── Mermaid 문법 생성
        │     ├── 노드: [id](label) — 카테고리별 클래스
        │     └── 엣지: source --> target — 관계 타입 라벨
        │
        └── mermaid.render()
              └── SVG 출력 → main content 영역에 삽입
```

## 사이드바 — 다이어그램 선택기

- 폴더 구조: prefix, service, DSL, observation 카테고리별 그룹
- 검색 필터: 다이어그램 ID/라벨 텍스트 매칭
- 선택 시 하이라이트 + 메인 영역 갱신
- 카운트 배지: 각 카테고리 내 다이어그램 수

## Mermaid 렌더링

- `mermaid.init()` 로 초기화 (dark 테마)
- 노드에 카테고리별 CSS 클래스 적용 (색상 구분)
- 엣지에 관계 타입을 라벨로 표시
- SVG는 메인 영역에 삽입되어 스크롤/줌 가능

## 3D 그리드 — viz-3d-core.js 파이프라인

```
BROWSER_CATALOG (prefix/axis 정의)
  │
  ├── 그리드 구성: prefix별 axis entries → 셀 행렬
  │     ├── 2D 그리드: entries × cols (기본)
  │     └── 3D 그리드: axes3d.x × axes3d.y × axes3d.z
  │
  ├── 뷰 레이아웃: layer/category/dsl/service 기준 배치
  │     └── viewPositions 계산 (카메라 위치 프리셋)
  │
  └── Three.js 렌더링
        ├── 셀 → InstancedMesh (카테고리별 색상)
        ├── 그리드 프레임 → LineSegments
        ├── 라벨 → CSS2DRenderer
        └── 활성 셀 → opacity/emissive 변경
```

## 스타일 매핑 원칙

- 스타일은 데이터 의미를 시각적 속성(색상, 선 굵기)으로 번역
- 레이아웃 알고리즘과 분리 — layout 결과를 무효화하지 않는 선에서 스타일 변경
- 카테고리 색상은 `viz-3d-core.js`의 `THEME.categories`에서 중앙 관리
- 셀 opacity 변화는 레이아웃 재계산 없이 material만 갱신

## 네비게이션

- 카메라 프리셋: layer, category, dsl, service 뷰
- 마우스 드래그: 카메라 회전 (OrbitControls)
- 스크롤: 줌 인/아웃
- 셀 클릭: 해당 prefix/entry 상세 정보 표시
