---
def:
  tier: component
  id: viz-panel-layout
  address: def_document:v2:129
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [frontend, structural, entry-point]
  links:
    - target: viz-surface-system
      type: refines
sources:
  - packages/viz-web/index.html
  - packages/viz-web/src/main.ts
  - packages/viz-web/src/panels/scenario-selector.ts
  - packages/viz-web/src/panels/session-list.ts
  - packages/viz-web/src/panels/event-log.ts
  - packages/viz-web/src/panels/verdict-panel.ts
  - packages/viz-web/src/iframe/roleplay-host.ts
  - packages/viz-web/src/styles/main.css
---

# Viz 패널 레이아웃

## 목적 ^purpose

viz-web의 scenario selector, event log, verdict panel을 하나의 보조 패널 시스템으로 배치하는 레이아웃 규칙을 정리한다.

## 구성 ^overview

viz-web은 header + sidebar + split-pane(left graph/event log, right roleplay iframe) 레이아웃을 따른다. 시나리오 선택기, 세션 목록, 이벤트 로그, verdict 패널, roleplay iframe이 독립 영역으로 분리되어 있으며, pane focus는 canvas-viewport의 focus helper로 제어한다.

## 공통 레이아웃 구조

```
┌──────────────────────────────────────────────────┐
│ #header                                           │
│ ┌─────────────┬───────────────────────────────┐   │
│ │ QA SDK Viz  │ Session / WS / Refresh        │   │
│ └─────────────┴───────────────────────────────┘   │
├──────────────────────────────────────────────────┤
│ ┌──────────┬──────────────────────┬────────────┐ │
│ │ Sidebar  │ Graph + Event Log    │ Roleplay   │ │
│ │          │ split pane           │ split pane │ │
│ └──────────┴──────────────────────┴────────────┘ │
└──────────────────────────────────────────────────┘
```

## 헤더 — #header

- 제목: `QA SDK Viz`
- 세션 정보: 선택 session ID, WebSocket status, verdict refresh 버튼
- 오류: `#error-banner`로 session/API 오류를 표시하고 닫기 버튼으로 숨김

## 시나리오 선택기 (Sidebar)

- `createScenarioSelector()`가 scenario 목록을 로드하고 선택 시 graph/session 상태를 초기화한다.
- `createSessionList()`가 기존 session과 새 session을 나열하고 선택 session replay를 담당한다.
- `createVerdictPanel()`이 recompute된 verdict 결과와 step match/missing/unexpected 정보를 표시한다.

## 이벤트 로그 (Left Pane)

- `createEventLog()`가 event sequence strip과 log row를 렌더링한다.
- `StoredRecord.eventKey`를 spec graph step 번호와 매핑하고, 미매칭 이벤트는 `?` 배지로 표시한다.
- payload는 길이를 제한해 inline 표시하고, sequence chip hover는 singleton tooltip을 사용한다.

## Roleplay 패널 (Right Pane)

- `createRoleplayHost()`가 roleplay-web iframe을 footer/right pane에 삽입한다.
- scenario/session context는 iframe으로 postMessage되고, iframe reload 시 마지막 context를 재전송한다.
- collapse/expand 토글로 iframe 영역을 접거나 펼 수 있다.

## 통합 제약

- 패널 간 정보 전달은 `main.ts`의 session/spec 상태와 component interface를 통해 이뤄진다.
- roleplay iframe 통신은 `iframe-protocol-spec`의 postMessage 타입을 따른다.
- pane focus class는 canvas-viewport helper를 통해 `focused`/`unfocused`로 토글한다.
- 데스크톱 중심 대시보드이며, 작은 뷰포트에서는 split-pane 제약을 보수적으로 유지한다.

## 페이지별 그리드

| 페이지 | Sidebar | Main | Panel |
|--------|---------|------|-------|
| 화면 | Sidebar | Left Pane | Right Pane |
|------|---------|-----------|------------|
| viz-web/index.html | scenario/session/verdict | graph + event log | roleplay iframe |
