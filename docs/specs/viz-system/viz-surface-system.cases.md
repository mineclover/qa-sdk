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
---

# Viz Surface 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`viz-surface-system`(panel-layout, graph-renderer-pipeline, graph-renderer-live, concept-hierarchy-grid, viz-core)이 `viz-system`에 의존할 때 기대하는 계약. surface 는 viz-system 의 canvas-viewport, mermaid-gen, api-client, iframe-protocol 을 재사용하여 UI 표면 변경 범위를 제한한다.

## 시나리오 1: graph-renderer-pipeline DAG 레이아웃 결정성 ^overview

**전제**: `viz-system`이 `canvas-viewport-spec` 에 기반하여 2D viewport 추상화를 제공.

**동작**: graph-renderer-pipeline 이 동일 DAG 데이터 입력 → SVG 출력.

**기대**:
- 노드 좌표가 입력 해시로 결정 (결정론적 layout)
- viewport 크기 변경 시 layout 재계산, 애니메이션은 viz-core 가 담당
- 노드 수 > 1000 시 progressive render (throttling)

**실패 시 수정 대상**: `viz-system.md`의 `canvas-viewport-spec` — viewport API 가 불완전하면 surface 가 직접 DOM 조작 → viz-core 캡슐화 위반.

## 시나리오 2: graph-renderer-live 실시간 업데이트 ^overview

**전제**: `viz-system`의 `api-client-spec` 이 EventSource SSE 구독 제공.

**동작**: graph-renderer-live 가 SSE 스트림을 구독하여 노드/엣지 실시간 갱신.

**기대**:
- SSE 연결 끊김 → 지수 backoff 재연결
- 중복 이벤트(same ID) → dedup, 최신 상태만 렌더
- 버퍼 가득 참 → oldest drop + metric

**실패 시 수정 대상**: `viz-system.md`의 `api-client-spec` — SSE reconnect/dedup 정책이 없으면 surface 가 로컬 버퍼 관리를 재구현.

## 시나리오 3: panel-layout 제약 ^overview

**전제**: `viz-system`이 viz-surface 내 scenario selector, event log, verdict panel 의 배치 제약을 viz-core 를 통해 공유.

**동작**: 작은 뷰포트(<= 768px width)에서 panel 배치.

**기대**:
- 세로 stack 전환 (가로 배치 금지)
- panel 간 의존(예: event log 선택 → verdict panel 갱신)은 양방향 이벤트 채널로 연결
- resize observer 1회 subscribe, 여러 panel 이 공유

**실패 시 수정 대상**: `viz-system.md`의 panel 배치 제약 — viewport breakpoint 가 viz-core 에 상수로 없으면 각 surface panel 이 다른 breakpoint 사용.

## 시나리오 4: concept-hierarchy-grid + mermaid-gen 연동 ^overview

**전제**: `viz-system`의 `mermaid-gen-spec`이 DKG 그래프에서 Mermaid 텍스트 생성 12종 다이어그램 함수를 제공.

**동작**: concept-hierarchy-grid 가 DKG 노드를 높낮이/plane 그리드에 배치하면서 mermaid-gen 결과를 부가 정보로 첨부.

**기대**:
- grid 좌표는 결정론적 (같은 DKG 입력 → 같은 좌표)
- mermaid-gen 실패 → grid 만 렌더 + warning (전체 실패 금지)
- 카탈로그 함수로 12종 중 선택 가능, unknown kind 요청 → 명시적 에러

**실패 시 수정 대상**: `viz-system.md`의 `mermaid-gen-spec` — 12종 카탈로그가 고정되지 않으면 grid 가 unknown diagram kind 로 런타임 fallback 실패.
