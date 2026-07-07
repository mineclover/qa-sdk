---
def:
  id: scope-nesting-visualization-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [scenario, scope-nesting, visualization]
  links:
    - target: scope-nesting-visualization
      type: refines
    - target: scope-nesting-system
      type: depends_on
sources:
  - packages/viz-core/src/scope-nesting-timeline.ts
  - packages/viz-core/src/scope-nesting-timeline.test.ts
  - packages/viz-web/src/scope-nesting-preview.ts
  - packages/viz-web/scope-nesting.html
---

# Scope Nesting 시각화 — 소비자 기대 시나리오

## 목적 ^purpose

`scope-nesting-visualization`(timeline-renderer + preview-surface, viz-core 기반 SVG 렌더링)이 `scope-nesting-system`에 의존할 때 기대하는 계약. 시각화는 scope-nesting-system 의 5계층 simulation 출력(L0~L3)을 통합 타임라인으로 렌더링해야 하므로, layer 경계와 데이터 모델이 안정적이어야 한다.

## 시나리오 1: 5계층 simulation 입력 스키마 고정 ^overview

**전제**: `scope-nesting-system`의 `scope-nesting-simulation-layers`가 L0→L1→L1.5→L2→L3 5계층 모델을 정의.

**동작**: timeline-renderer 가 각 layer 의 simulation 결과를 받아 SVG 타임라인 생성.

**기대**:
- 각 layer 결과가 동일한 shape 의 "layer, events[], range" 스키마로 전달
- 누락 layer → 해당 track 비워두고 warning (전체 렌더 실패 금지)
- L1.5 는 L1/L2 사이 intermediate 로 별도 track 배치

**실패 시 수정 대상**: `scope-nesting-system.md`의 `scope-nesting-simulation-layers` — layer 출력 스키마가 고정되지 않으면 visualization 은 layer 별로 다른 파싱 로직을 유지.

## 시나리오 2: viz-core renderer contract 재사용 ^overview

**전제**: `scope-nesting-system`이 "`viz-core`는 재사용 가능한 rendering/data contract 를 소유" 하도록 분해.

**동작**: scope-nesting-timeline-renderer 가 `viz-core` 의 SVG primitive (`line`, `rect`, `tick`) 와 D3 scales 를 재사용.

**기대**:
- viz-core 의 coordinate contract 준수 (x: time axis, y: layer track)
- viz-core API breaking change 시 scope-nesting visualization 이 빌드 실패로 조기 감지
- renderer 가 viz-core 공개 함수만 import (private symbol 접근 금지)

**실패 시 수정 대상**: `viz-system.md`의 `viz-core` — rendering/data contract 가 공개 surface 로 노출되지 않으면 visualization 이 private 구현에 의존하여 drift.

## 시나리오 3: preview-surface 상호작용 ^overview

**전제**: `scope-nesting-system`이 "`viz-web` 은 예제 데이터, 탭/필터 UI, preview surface 소유" 로 분해.

**동작**: preview 페이지에서 사용자가 layer 필터, 시간 range 필터 적용.

**기대**:
- 필터 적용 시 renderer 가 입력 데이터 subset 만 렌더 (client-side 필터)
- 필터 변경이 URL query 에 반영 (공유 가능)
- 필터 결과가 비어 있으면 explicit empty state UI 렌더

**실패 시 수정 대상**: `scope-nesting-system.md`의 preview surface 분해 원칙 — viz-web 이 data 소유까지 확장되면 scope-nesting spec 이 UI 배포에 묶여 결합도 증가.

## 시나리오 4: pipe-svg 토큰 + canvas-viewport 추상 재사용 ^overview

**전제**: `scope-nesting-system`이 "기존 pipe-svg 토큰 + canvas-viewport 추상화를 재사용하여 시각화 일관성 확보" 규정.

**동작**: 동일한 style token (색상, 두께, 폰트) 이 pipe simulation 시각화와 scope-nesting 시각화에 공통 적용.

**기대**:
- 토큰 변경 시 양쪽 UI 동시 반영
- canvas-viewport 의 pan/zoom 상호작용이 scope-nesting timeline 에서도 동작
- breaking change 시 타입 시스템 수준에서 감지 (TypeScript exhaustive)

**실패 시 수정 대상**: `scope-nesting-system.md` §"분해 원칙" — 재사용 대상(pipe-svg 토큰, canvas-viewport)이 외부 spec 에 없으면 토큰이 중복 정의되어 시각 일관성 위배.
