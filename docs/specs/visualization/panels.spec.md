---
def:
  id: viz-panels-spec
  address: def_document:v1:1
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: deprecated
  layer: experience
  svc: platform-demo
  tags: [tier-frontend]
  links:
    - target: graph-renderer-spec
      type: depends_on
---
# 시각화 UI 패널 — 시나리오 선택, 이벤트 로그, Verdict 표시

## 목적 ^purpose

viz-web의 세 보조 패널 레이아웃. 시나리오 선택기, 실시간 이벤트 로그, 판정 결과 표시 패널의 배치와 구조.

## 상태

implemented

## 1. Scenario Selector (scenario-selector.ts)

ingest-server에서 시나리오 목록을 조회하고, 사용자가 선택하면 `ScenarioSpec`을 콜백으로 전달한다.

```typescript
function createScenarioSelector(
  container: HTMLElement,
  onSelect: (spec: ScenarioSpec) => void,
): void;
```

### 동작

1. 마운트 시 `GET /v1/scenarios`로 목록을 비동기 로드한다.
2. `<select>` 드롭다운에 `"scenario_id (vN)"` 형식으로 옵션을 생성한다.
3. 선택 시 `<dl>` 형태의 상세 정보(Domain, Version, Steps, Description)를 표시한다.
4. 선택 시 `onSelect(spec)` 콜백을 호출한다.
5. 로드 실패 시 에러 메시지를 `.scenario-details.error`에 표시한다.

### DOM 구조

```
<div class="scenario-selector">
  <label class="panel-label">Scenario</label>
  <select class="scenario-select">
    <option disabled selected>Select a scenario...</option>
    <option value="{scenario_id}">{scenario_id} (v{version})</option>
  </select>
  <div class="scenario-details">
    <dl>
      <dt>Domain</dt><dd>{domain}</dd>
      <dt>Version</dt><dd>{version}</dd>
      <dt>Steps</dt><dd>{steps.length}</dd>
      <dt>Description</dt><dd>{description}</dd>
    </dl>
  </div>
</div>
```

## 2. Event Log (event-log.ts)

SSE로 수신한 `StoredRecord`를 시간순으로 표시하는 실시간 이벤트 로그.

```typescript
interface EventLog {
  addEvent(record: StoredRecord): void;
  clear(): void;
}

function createEventLog(container: HTMLElement): EventLog;
```

### 동작

1. `addEvent(record)` — 타임스탬프(HH:mm:ss.SSS), event_key, payload 요약을 한 줄로 표시한다.
2. payload는 `JSON.stringify()` 후 120자에서 truncate한다.
3. 새 항목 추가 시 자동으로 하단 스크롤한다.
4. Clear 버튼으로 로그를 초기화한다.

### DOM 구조

```
<div class="event-log">
  <div class="panel-header">
    <span class="panel-label">Event Log</span>
    <button class="btn-clear">Clear</button>
  </div>
  <div class="event-log-list">
    <div class="event-log-entry">
      <span class="event-time">{HH:mm:ss.SSS}</span>
      <span class="event-key">{event_key}</span>
      <span class="event-payload">{truncated_json}</span>
    </div>
  </div>
</div>
```

## 3. Verdict Panel (verdict-panel.ts)

`VerdictReport`를 사람이 읽을 수 있는 형태로 렌더링한다.

```typescript
interface VerdictPanel {
  showVerdict(report: VerdictReport): void;
  clear(): void;
}

function createVerdictPanel(container: HTMLElement): VerdictPanel;
```

### 동작

1. `showVerdict(report)` — 기존 내용을 비우고 새 verdict를 렌더링한다.
2. 4개 섹션을 순서대로 렌더링한다:
   - **Overall**: `overall_verdict` 배지(색상 코드), summary 텍스트, 메타 정보(scenario_id, trace_id, computed_at)
   - **Step Matches**: 각 step의 verdict 배지, matched_node_id, constraint 결과(collapsible `<details>`)
   - **Missing Steps**: missing_steps 목록
   - **Latency Violations**: step_id, expected_ms, actual_ms 목록
3. unexpected_nodes가 있으면 Unexpected Nodes 섹션도 추가한다.

### Verdict 색상 매핑

| Verdict | CSS 클래스 | 색상 |
|---|---|---|
| `"pass"` | `verdict-pass` | 녹색 |
| `"fail"` | `verdict-fail` | 적색 |
| `"warn"` | `verdict-warn` | 황색 |
| `"degraded"` | `verdict-degraded` | 주황색 |
| `"unknown"` | `verdict-unknown` | 회색 |

### Constraint 결과 표시

각 constraint는 `<li>` 요소로 표시되며:
- 형식: `{field} {op} {value} - PASS/FAIL (actual: {actual})`
- pass/fail에 따라 `constraint-pass` / `constraint-fail` 클래스 적용

## 전체 레이아웃 통합 (main.ts)

```
┌──────────────┬─────────────────────┬────────────────────┐
│  Left Panel  │    Graph Canvas     │   Right Panel      │
│              │                     │                    │
│  Scenario    │   SVG SpecGraph     │   Event Log        │
│  Selector    │   (실시간 업데이트)  │   (실시간 스크롤)   │
│              │                     │                    │
│  Verdict     │                     │                    │
│  Panel       │                     │                    │
├──────────────┴─────────────────────┴────────────────────┤
│  Trace ID Input  [Connect]  [Recompute]                 │
├─────────────────────────────────────────────────────────┤
│  Footer: Roleplay iframe (collapsible)                  │
└─────────────────────────────────────────────────────────┘
```

### 오케스트레이션 흐름

1. **시나리오 선택** → `listSessions()` + `createSession()` → `compileSpec(spec)` → `computeLayout(graph)` → `createGraphSvg()` → `render()` → WS 연결(`connectWs(scenarioId)`)
2. **세션 선택** → `getSessionRecords(sessionId)` (서버 이력) + WS 버퍼 병합(`mergeAndSortRecords`) → `renderer.resetState()` → `createUpdater(graph, renderer)` → `replayRecords(merged)`
3. **WS record 수신** → 버퍼에 추가 + 현재 세션이면 `eventLog.addEvent(record)` + `updater.processRecord(record)`
4. **WS 연결 해제** → `loadVerdicts(sessionId)` → `verdictPanel.showVerdict(report)` + `applyVerdictToGraph(report)` → 자동 재연결(exponential backoff)
5. **Recompute 버튼** → 세션 레코드에서 traceId 수집 → `POST /v1/traces/:id/verdicts/recompute` → `loadVerdicts(sessionId)` 재조회
6. **iframe 메시지** → `event:emitted` 수신 시 해당 event_key의 노드를 즉시 `"active"`로 하이라이트 (WS 도착 전 피드백)

## 제약 조건

- 시나리오 목록은 마운트 시 1회 로드하며, 수동 리프레시 기능은 없다.
- 이벤트 로그의 payload는 120자 이상이면 `...`으로 truncate한다.
- verdict 렌더링 시 `showVerdict()`는 이전 내용을 완전히 교체한다 (append 아님).
- main.ts에서 `compileSpec()`은 `@qa-sdk/engine`의 pure function을 직접 호출한다.
