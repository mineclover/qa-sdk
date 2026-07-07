---
def:
  id: viz-surface-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [scenario, viz, surface]
  links:
    - target: viz-surface-system
      type: refines
    - target: viz-system
      type: depends_on
sources:
  - packages/viz-web/src/main.ts
  - packages/viz-web/src/graph/renderer.ts
  - packages/viz-web/src/graph/updater.ts
  - packages/viz-core/src/concept-grid.ts
  - packages/spec-core/src/visualization/mermaid-gen.ts
---

# Viz Surface 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`viz-surface-system`(panel-layout, graph-renderer-pipeline, graph-renderer-live, concept-hierarchy-grid, viz-core)이 `viz-system`에 의존할 때 기대하는 계약. surface 는 viz-system 의 canvas-viewport, mermaid-gen, api-client, iframe-protocol 을 재사용하여 UI 표면 변경 범위를 제한한다.

## 시나리오 1: graph-renderer-pipeline DAG 레이아웃 결정성 ^overview

**전제**: `viz-system`이 `canvas-viewport-spec` 에 기반하여 2D viewport 추상화를 제공.

**동작**: graph-renderer-pipeline 이 동일 DAG 데이터 입력 → SVG 출력.

**기대**:
- 같은 `ScenarioSpec` 입력은 같은 graph node/edge sequence와 layout을 만든다
- viewport 상호작용은 canvas-viewport controller/HUD/minimap으로 처리한다
- 상태 변화는 renderer API의 node/edge 부분 갱신으로 처리한다

**실패 시 수정 대상**: `viz-system.md`의 `canvas-viewport-spec` — viewport API 가 불완전하면 surface 가 직접 DOM 조작 → viz-core 캡슐화 위반.

## 시나리오 2: graph-renderer-live 실시간 업데이트 ^overview

**전제**: `viz-system`의 `api-client-spec` 이 WebSocket/SSE 구독과 REST replay 조회를 제공.

**동작**: graph-renderer-live 가 session stream을 구독하여 노드/엣지 실시간 갱신.

**기대**:
- WebSocket 연결 끊김 → 지수 backoff 재연결
- 중복 record는 `mergeAndSortRecords()`에서 logId 기준 dedup
- session buffer는 session/record 상한을 둬 oldest 데이터를 정리

**실패 시 수정 대상**: `viz-system.md`의 `api-client-spec` — stream reconnect/dedup 정책이 없으면 surface 가 로컬 버퍼 관리를 재구현.

## 시나리오 3: panel-layout 제약 ^overview

**전제**: `viz-system`이 viz-surface 내 scenario selector, session list, event log, verdict panel, roleplay iframe의 배치 제약을 공유.

**동작**: 작은 뷰포트(<= 768px width)에서 panel 배치.

**기대**:
- pane focus는 canvas-viewport helper로 `focused`/`unfocused` class를 토글
- panel 간 의존은 `main.ts`의 session/spec state와 component interface를 통해 연결
- iframe 통신은 postMessage protocol로 격리

**실패 시 수정 대상**: `viz-system.md`의 panel 배치 제약 — viewport breakpoint 가 viz-core 에 상수로 없으면 각 surface panel 이 다른 breakpoint 사용.

## 시나리오 4: concept-hierarchy-grid + mermaid-gen 연동 ^overview

**전제**: `viz-system`의 `mermaid-gen-spec`이 DKG 그래프에서 Mermaid 텍스트 생성 12종 다이어그램 함수를 제공.

**동작**: concept-hierarchy-grid 가 DKG 노드를 높낮이/plane 그리드에 배치하면서 mermaid-gen 결과를 부가 정보로 첨부.

**기대**:
- grid 좌표는 결정론적 (같은 DKG 입력 → 같은 좌표)
- mermaid-gen 실패 → grid 만 렌더 + warning (전체 실패 금지)
- 카탈로그 함수로 12종 중 선택 가능, unknown kind 요청 → 명시적 에러

**실패 시 수정 대상**: `viz-system.md`의 `mermaid-gen-spec` — 12종 카탈로그가 고정되지 않으면 grid 가 unknown diagram kind 로 런타임 fallback 실패.
