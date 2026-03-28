---
def:
  id: dkg-skill-version-event
  address: def_document:v2:68768
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [tier-system]
  links:
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# VersionEvent.fromDiff — 버전 이벤트 자동 파생

## 목적 ^purpose

두 버전 간 diff에서 VersionEventNode를 자동 생성하는 skill. entry 추가/제거, capacity 변경, ref 변경을 이벤트로 변환하여 DKG 그래프에 기록한다.

## 구성 ^overview

DiffInput에서 VersionChange 목록을 파생하고, impact를 자동 판정하여 VersionEventNode를 생성한다. 5종 변경 분류와 4종 impact 판정으로 구성된다.

## 입력 타입

소스 위치: `packages/spec-core/src/dkg/skills/version-event-derive.ts`

```typescript
interface DiffInput {
  readonly prefix: string;
  readonly from: string;           // 이전 버전 (예: "v1")
  readonly to: string;             // 새 버전 (예: "v2")
  readonly changedLabels: readonly {
    readonly label: string;
    readonly fromLabelVersion: string;
    readonly fromMax: number;
    readonly toLabelVersion: string;
    readonly toMax: number;
  }[];
}
```

## 변경 분류 규칙

각 changedLabel에 대해 다음 규칙으로 VersionChange의 kind를 결정한다.

| 조건 | kind | 설명 |
|------|------|------|
| `toMax > fromMax` 이고 `toMax - fromMax > 1` | `capacity-changed` | 용량 확장 |
| `toMax > fromMax` 이고 `toMax - fromMax == 1` | `entry-added` | entry 1개 추가 |
| `toMax < fromMax` | `entry-deactivated` | entry 비활성화 |
| `toMax == fromMax` 이고 `labelVersion` 변경 | `entry-added` | entry 내용 변경 (max 동일) |

### detail 형식

- max 변경: `"{label} max {fromMax}→{toMax} ({fromLabelVersion}→{toLabelVersion})"`
- version만 변경: `"{label} version {fromLabelVersion}→{toLabelVersion} (max 동일: {toMax})"`

## Impact 자동 판정

`deriveImpact()` 함수가 변경 내용을 분석하여 impact 문자열을 생성한다.

| 조건 | impact | 의미 |
|------|--------|------|
| changedLabels 없음 | `"no-impact. 변경 없음."` | 실질적 변경 없음 |
| max 변경 없음 | `"state-only. label version 변경, shape 불변."` | entry 내용만 변경 |
| max 감소 있음 | `"stride-break. capacity 감소. 전체 re-encode 필요."` | 주소 공간 축소 |
| max 증가만 있음 | `"size 변경 ({details}). bitmask 재생성 필요."` | 주소 공간 확장 |

## 출력 타입

```typescript
interface VersionEventNode {
  readonly kind: "version-event";
  readonly id: string;                    // "VE-{prefix}-{from}-{to}"
  readonly subjectId: string;             // prefix ID
  readonly subjectKind: "axis" | "prefix";
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly date: string;
  readonly changes: readonly VersionChange[];
  readonly impact: string;
  readonly metadata?: Record<string, unknown>;
}

interface VersionChange {
  readonly kind:
    | "entry-added"
    | "entry-deactivated"
    | "capacity-changed"
    | "dim-added"
    | "ref-changed";
  readonly detail: string;
}
```

## ID 생성 규칙

`VE-{prefix}-{from}-{to}` 형식으로 결정론적 ID를 생성한다.

예: `VE-tracking-v1-v2`, `VE-order_event-v2-v3`

## lifecycle-transition과의 관계

소스 위치: `packages/spec-core/src/dkg/skills/lifecycle-transition.ts`

lifecycle 전이 시에도 VersionEventNode를 생성하여 이력을 기록한다.

```
transitionPrefix(graph, prefixId, "deprecated")
  → VersionEventNode { id: "VE-LC-{prefixId}-deprecated", ... }
  → evolves-from 엣지로 prefix에 연결
```

### lifecycle 전이에서 생성되는 VersionEvent

| 전이 | VersionEvent ID | fromVersion | toVersion |
|------|----------------|-------------|-----------|
| prefix: draft→active | `VE-LC-{id}-active` | "draft" | "active" |
| prefix: active→deprecated | `VE-LC-{id}-deprecated` | "active" | "deprecated" |
| prefix: deprecated→archived | `VE-LC-{id}-archived` | "deprecated" | "archived" |

## DKG 그래프 기록

VersionEventNode는 생성 후 DKG 그래프에 등록되고, `evolves-from` 엣지로 대상 노드에 연결된다.

```
graph.addNode(versionEvent)
graph.addEdge("evolves-from", versionEvent.id, subjectId)
```

이를 통해 노드의 진화 이력을 `transitiveNeighbors(nodeId, "evolves-from", "reverse")`로 추적할 수 있다.

## bootstrapDkg에서의 자동 생성

`bootstrapDkg()`에서 DSL 버전 스큐 분석 결과에 따라 VersionEvent가 간접적으로 관련된 Decision과 Observation이 자동 생성된다. 직접적인 VersionEvent 생성은 diff가 발생하는 시점에 `versionEventFromDiff()`로 수행.

## 설계 원칙

- `versionEventFromDiff()`는 순수 함수 — DiffInput과 meta(date, note)만 받음
- ID는 결정론적 — 같은 diff에서 같은 VersionEvent 생성
- impact 판정은 자동 — 인간 개입 없이 변경 유형에서 파생
- stride-break는 가장 심각한 impact — capacity 감소 시 전체 re-encode 필요
