# SpecGraph 시각화 — 레이아웃, 렌더링, 실시간 업데이트

> `SpecGraph`를 dagre 기반 DAG 레이아웃으로 배치하고, SVG로 렌더링하며, SSE 이벤트 스트림에 따라 그래프 상태를 실시간 갱신하는 시각화 파이프라인.

## 상태

implemented

## 설계 원칙

- 그래프 시각화는 3단계로 분리한다: **레이아웃 계산** → **SVG 렌더링** → **실시간 업데이트**.
- 레이아웃은 dagre에 위임하고, 렌더링은 SVG 직접 조작으로 구현한다 (Canvas, WebGL 미사용).
- graph_hint.role 기반 스타일과 실시간 상태(NodeState) 기반 스타일을 CSS 클래스로 분리 합성한다.
- 외부 의존 라이브러리는 dagre 단독이다.

## 1. 레이아웃 (layout.ts)

dagre를 사용하여 `SpecGraph`를 좌표 기반 `LayoutResult`로 변환한다.

```typescript
interface PositionedNode {
  step_id: string;
  event_key: string;
  kind: string;       // StepKind
  required: boolean;
  role: GraphRole | undefined;  // event-catalog의 graph_hint.role
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PositionedEdge {
  source: string;     // step_id
  target: string;     // step_id
  type: SpecEdgeType; // "sequence" | "branch" | "optional"
  points: Array<{ x: number; y: number }>;
}

interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

function computeLayout(graph: SpecGraph): LayoutResult;
```

### dagre 설정

| 파라미터 | 값 | 설명 |
|---|---|---|
| `rankdir` | `"TB"` | 위 → 아래 방향 |
| `nodesep` | `50` | 같은 rank 내 노드 간격 |
| `ranksep` | `60` | rank 간 간격 |
| `marginx` | `20` | 좌우 여백 |
| `marginy` | `20` | 상하 여백 |

### 노드 크기 계산

- 최소 너비: 100px
- 너비 = `max(100, label.length * 8 + 48)`
- 높이 = 56px (40 + 16 padding)

## 2. 렌더링 (renderer.ts)

`LayoutResult`를 SVG DOM으로 변환한다.

```typescript
interface GraphRenderer {
  render(): void;
  resetState(): void;
  updateNodeState(stepId: string, state: NodeState): void;
  addEventToStack(stepId: string, event: { event_key: string; timestamp: string }): void;
  highlightEdge(source: string, target: string): void;
  destroy(): void;
}

function createGraphSvg(container: HTMLElement, layout: LayoutResult): GraphRenderer;
```

### SVG 구조

```
<svg viewBox="0 0 {width} {height}">
  <defs>
    <marker id="arrowhead">          <!-- 화살표 마커 -->
      <polygon points="0 0, 10 3.5, 0 7" />
    </marker>
  </defs>

  <!-- 엣지 (먼저 렌더링 → 노드 뒤에 위치) -->
  <g class="graph-edge edge-{type}" data-source="{stepId}" data-target="{stepId}">
    <path d="M ... L ..." marker-end="url(#arrowhead)" />
  </g>

  <!-- 노드 -->
  <g class="graph-node state-{state}" data-step-id="{stepId}"
     transform="translate({x-w/2}, {y-h/2})">
    <rect width="{w}" height="{h}" rx="6" ry="6" />
    <text text-anchor="middle" dominant-baseline="central">{event_key}</text>
    <text class="optional-badge">opt</text>              <!-- required=false인 경우 -->
    <g class="event-count-badge">                         <!-- 이벤트 스택 뱃지 -->
      <circle cx="{w-4}" cy="4" r="10" />
      <text>{count}</text>
    </g>
  </g>
</svg>
```

### 동작

1. `render()` — container를 비우고 SVG를 새로 생성. 엣지 → 노드 순서로 렌더링.
2. `resetState()` — 모든 노드를 `"pending"` 상태로 초기화하고, 엣지 하이라이트(`edge-highlighted`) 제거, 이벤트 스택 및 뱃지 초기화. 세션 전환 시 호출된다.
3. `updateNodeState(stepId, state)` — 해당 노드 `<g>`의 CSS 클래스를 `getNodeClass(role, state)` 결과로 교체. role은 `nodeRoles` 맵에 저장되어 있어 state 변경 시에도 자동 재적용된다.
4. `addEventToStack(stepId, event)` — 해당 노드의 이벤트 스택에 추가하고 뱃지 카운트 갱신. 99+이면 "99+" 표시.
5. `highlightEdge(source, target)` — 해당 엣지 `<g>`에 `edge-highlighted` 클래스 추가.
6. `destroy()` — SVG 제거, 내부 Map 초기화.

## 3. 스타일 매핑 (style.ts)

```typescript
type NodeState = "pending" | "active" | "matched" | "failed" | "skipped";

function getNodeClass(role: GraphRole | undefined, state: NodeState): string;
function getEdgeClass(type: SpecEdgeType): string;
```

### Role 클래스

| GraphRole | CSS 클래스 | 시각적 의미 |
|---|---|---|
| `"entry"` | `role-entry` | 진입점 (녹색 테두리) |
| `"transition"` | `role-transition` | 전이 (청색 테두리) |
| `"terminal"` | `role-terminal` | 종료점 (적색 테두리) |
| `"observation"` | `role-observation` | 관찰 (회색 점선 테두리) |
| `undefined` | `role-default` | 기본 |

### State 클래스

| NodeState | CSS 클래스 | 시각적 의미 |
|---|---|---|
| `"pending"` | `state-pending` | 미도달 (회색 배경) |
| `"active"` | `state-active` | 현재 대기 중 (청색 펄스 애니메이션) |
| `"matched"` | `state-matched` | 매칭 성공 (녹색 배경) |
| `"failed"` | `state-failed` | 매칭 실패 (적색 배경) |
| `"skipped"` | `state-skipped` | 스킵됨 (점선 회색) |

### Edge 클래스

| SpecEdgeType | CSS 클래스 |
|---|---|
| `"sequence"` | `graph-edge edge-sequence` |
| `"branch"` | `graph-edge edge-branch` |
| `"optional"` | `graph-edge edge-optional` |

최종 노드 클래스: `"graph-node {role-class} state-{state}"`

## 4. 실시간 업데이터 (updater.ts)

SSE로 수신한 `StoredRecord`를 `SpecGraph`의 노드와 순차 매칭하여 그래프 진행 상태를 갱신한다.

```typescript
interface GraphUpdater {
  processRecord(record: StoredRecord): void;
  getProgress(): Map<string, NodeState>;
  reset(): void;
}

function createUpdater(specGraph: SpecGraph, renderer: GraphRenderer): GraphUpdater;
```

### 매칭 알고리즘

1. `matchIndex`를 0으로 초기화한다. 각 spec 노드를 `"pending"` 상태로 설정한다.
2. `processRecord(record)` 호출 시:
   - `matchIndex`부터 spec 노드를 순회하며 `event_key`가 일치하는 노드를 찾는다.
   - **매칭 성공**: 현재 `matchIndex`부터 매칭된 인덱스까지의 non-required 노드를 `"skipped"`로 표시한다. 매칭 노드를 `"matched"`로 설정하고, 해당 노드로 향하는 엣지를 하이라이트한다. 다음 노드가 있으면 `"active"`로 전환한다. `matchIndex`를 갱신한다.
   - **순방향 매칭 실패**: 전체 spec 노드에서 동일 `event_key`를 찾아, 존재하면 해당 노드의 이벤트 스택에 추가한다 (비진척 이벤트).
3. `reset()` — `matchIndex`를 0으로 재설정하고 모든 노드를 `"pending"`으로 복원한다.

### 상태 전이 다이어그램

```
pending ──(순방향 매칭 성공)──→ matched
pending ──(스킵됨, !required)──→ skipped
pending ──(다음 대기 노드)──→ active
```

## 제약 조건

- dagre의 `rankdir`은 `"TB"` 고정이다. 가로 레이아웃은 지원하지 않는다.
- SVG 네임스페이스(`http://www.w3.org/2000/svg`)를 사용하여 요소를 생성한다. `innerHTML` 기반 SVG 생성은 사용하지 않는다.
- `updateNodeState()`는 `nodeRoles` 맵에 저장된 role을 함께 적용한다. role은 `render()` 시점에 `nodeRoles`에 저장되며, 이후 state가 변경되어도 일관되게 재적용된다.
- 이벤트 스택 뱃지는 노드 `<g>` 내부에 렌더링되며, 최대 표시값은 "99+"이다.
- updater는 순차 매칭만 수행한다. SpecGraph의 edge 구조(branch, optional)를 따르는 고급 매칭은 서버 측 `matchGraphs()`에 위임한다.
