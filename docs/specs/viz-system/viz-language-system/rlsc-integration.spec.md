---
def:
  tier: component
  id: rlsc-integration
  address: def_document:v2:137358
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: platform-demo
  tags: [runtime, observability, structural]
  links:
    - target: viz-language-system
      type: refines
---

# RLSC 통합 경로

## 목적 ^purpose

RLSC를 context engineering, 기존 좌표계, API 요약, 패키지 구조와 연결하는 통합 경로를 정리한다.

## 구성 ^overview

RLSC는 DOM 수집 → 분석(grid/layers/relations) → 마크업 직렬화 → Context Engineering 프롬프트 생성의 파이프라인을 제공한다. 기존 qa-sdk 좌표 인프라를 `data-qa-address` 속성으로 연결하고, 5가지 목적별 프롬프트 템플릿으로 LLM 워크플로에 주입한다.

## Context Engineering — generateDesignContext

`generateDesignContext(doc, options)` 가 R.L.S.C. 문서를 LLM이 이해할 수 있는 `DesignContext`로 변환한다.

### ContextPurpose — 5가지 목적

| 목적 | 프롬프트 역할 |
|------|-------------|
| `layout-analysis` | 구조적 특성, 계층 관계, 공간 활용 분석 |
| `component-search` | 특정 컴포넌트 위치, 크기, 역할 식별 |
| `design-generation` | 기존 패턴 유지하면서 변경사항을 R.L.S.C. 마크업으로 생성 |
| `design-diff` | 두 시점의 변경 요소, 이동, 크기 변화 분석 |
| `accessibility-audit` | ARIA 역할 누락, 키보드 접근성, 시각적 계층 문제 분석 |

### DesignContext 구조

| 필드 | 내용 |
|------|------|
| `summary` | 자연어 레이아웃 요약 (가시 요소 수, 주요 영역 top 5, 역할 분포) |
| `structure` | R.L.S.C. 마크업 (토큰 예산의 40%까지) |
| `matrix` | 그리드 텍스트 표현 |
| `relations` | 공간 관계 텍스트 |
| `focusDetail` | 포커스 영역 상세 (노드 ID 또는 rect) |
| `prompt` | 전체 프롬프트 (목적별 템플릿 + 데이터 조합) |

### 토큰 예산 관리

- `maxTokens` 옵션 (기본 4,000)
- 1 토큰 = 약 4자로 근사
- structure 섹션에 예산의 40% 할당
- 초과 시 truncate + `... (truncated)` 표시

## 기존 좌표계 통합

RLSC는 패키지 구현은 독립 repository/submodule로 공유할 수 있지만, 좌표 인프라 계약은 qa-sdk의 기존 주소 체계를 재사용한다:

1. **수집 시점**: `data-qa-address` 속성에서 좌표 주소 추출 → `RLSCNode.address`
2. **문서 단위**: `RLSCDocument.address` 에 페이지 수준 좌표 주소 저장
3. **검색**: `findByAddress(doc, address)` 로 특정 좌표 주소를 가진 노드 검색
4. **마크업**: `addr:page_view:v2:42` 형태로 직렬화

## 패키지 경계

| 패키지 | 책임 | 배포/공유 기준 |
|--------|------|---------------|
| `rlsc-analysis` | DOM 스캔, 메타데이터 수집, identifier/index, 영역/overflow 분석 | 독립 submodule + semver dependency |
| `rlsc-perspective` | 수집된 `RLSCDocument`의 CSS 3D Perspective 시각화 | qa-sdk workspace package |
| `rlsc` | 기존 RLSC DSL, rendering, compatibility export | 독립 submodule + semver dependency |
| `@qa-sdk/rlsc-demo` | 분석/시각화 통합 데모 | qa-sdk 내부 demo app |

qa-sdk root는 `pnpm.overrides["rlsc-analysis"] = "link:packages/rlsc-analysis"`로 monorepo 개발 중에도 `rlsc`, `rlsc-perspective`, demo가 같은 analysis 구현을 보게 한다. `pnpm check:rlsc`는 submodule URL/checkout 상태와 package version range 일관성을 검증한다.

외부 소비자는 registry 또는 local tarball 산출물을 설치한다. 구현을 함께 검토하거나 공유해야 하는 경우에는 `git clone --recurse-submodules`로 qa-sdk parent repository와 submodule revision을 함께 고정한다.

## 쿼리 API

| 함수 | 설명 |
|------|------|
| `queryNodes(doc, query)` | 조건 기반 노드 검색 (tag, role, class, text, rect, area, z-range) |
| `findByRect(doc, rect)` | 영역 내 노드 검색 |
| `findByRole(doc, role)` | role 기반 검색 |
| `findByAddress(doc, address)` | 좌표 주소 기반 검색 |
| `findById(doc, id)` | 노드 ID로 단일 노드 검색 |
| `replaceNode(doc, id, patch)` | 불변 노드 교체 |
| `removeNode(doc, id)` | 불변 노드 제거 |
| `diffDocuments(before, after)` | 두 문서 간 차이 계산 (added/removed/moved/resized/reordered) |

## 레거시 패키지 구조 — packages/rlsc

```
src/
  types.ts       ← 전체 타입 정의 (Node, Grid, Layer, Relation, Document, Context, Query)
  collector.ts   ← DOM 수집 (브라우저 전용) + flattenTree
  grid.ts        ← 뷰포트 셀 분할 + 점유 분석 + gridToText
  layers.ts      ← z-index 레이어 분류 + layersToText
  relations.ts   ← 공간 관계 탐지 + relationsToText
  encoder.ts     ← 마크업 직렬화/파싱 (encodeToMarkup, parseMarkup)
  context.ts     ← Context Engineering (generateDesignContext)
  query.ts       ← 검색/교체/삭제/비교 API
  index.ts       ← 공개 export 배럴
```

## platform-demo 통합 — rlsc.html

R.L.S.C. Inspector UI:

- 캔버스: 샘플 레이아웃 + 호버/선택 하이라이트 오버레이
- 패널: 탭 기반 (Tree, Grid, Layers, Relations, Context)
- 바운딩 박스 오버레이: 노드별 경계선 시각화
- 선택 시 포커스 상세 표시
