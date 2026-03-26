---
def:
  id: graph-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: system-concepts
      type: depends_on
---

# SpecGraph / RuntimeGraph + GraphStore

## 목적 ^purpose

기대 행동 그래프(`SpecGraph`)와 실행 그래프(`RuntimeGraph`)의 canonical 구조.

## 구성 ^overview

- **RuntimeGraph**: trace_id 기반 실행 그래프 — RuntimeNode(log/span, 타임스탬프, payload 마스킹 정보)와 RuntimeEdge(temporal/parent_child/causal)
- **SpecGraph**: ScenarioSpec을 판정용 경량 그래프로 컴파일 — SpecNode(step_id, event_key, required, timeout_ms)와 SpecEdge(sequence/branch/optional)
- **GraphStore**: RuntimeGraph만 trace_id 기준 upsert 저장, SpecGraph는 engine 내부 투영 구조
- **edge 규칙**: source/target이 canonical endpoint (from/to 미사용), causal 타입 고정 (derived 미사용)
- **SpecNode 설계**: ScenarioStep 전체 참조 없이 판정 필수 필드만 보유, 네비게이션은 SpecEdge로만 표현

## 상태

implemented

## RuntimeGraph 타입

reconstruction 결과. 모든 필드명은 `snake_case`를 사용한다.

```typescript
interface RuntimeGraph {
  trace_id: string;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
}

interface RuntimeNode {
  id: string;
  log_id: string;
  timestamp: string; // ISO-8601 UTC
  record_kind: "log" | "span";
  event_key: string;
  event_version: string;
  service_name?: string;
  span_name?: string;
  start_time?: string;
  end_time?: string;
  status_code?: "ok" | "error" | "unset";
  payload?: unknown;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
}

type RuntimeEdgeType = "temporal" | "parent_child" | "causal";

interface RuntimeEdge {
  source: string;
  target: string;
  type: RuntimeEdgeType;
}
```

## RuntimeGraph 설계 노트

- `service_name`은 optional이다.
- `service_name`은 개별 `EventRecord`에 중복 저장하지 않고, 이후 reconstruction 단계에서 trace-level 메타데이터로부터 주입할 예정이다.
- 따라서 trace-level 주입 스토리가 반영되기 전까지 일부 `RuntimeNode.service_name` 값은 `undefined`일 수 있다.
- `payload_masking_applied`와 `payload_masked_fields`는 원본 레코드의 masking 결과를 그대로 전파한다.

## SpecGraph 타입

ScenarioSpec을 판정에 필요한 필드만 남긴 경량 그래프로 컴파일한다.

```typescript
interface SpecGraph {
  scenario_id: string;
  version: string;
  nodes: SpecNode[];
  edges: SpecEdge[];
}

interface SpecNode {
  step_id: string;
  event_key: string;
  event_version?: string;
  source?: string;
  record_kind?: "log" | "span";
  required: boolean;
  kind: StepKind;
  constraints?: StepConstraint[];
  timeout_ms?: number;
}

type SpecEdgeType = "sequence" | "branch" | "optional";

interface SpecEdge {
  source: string;
  target: string;
  type: SpecEdgeType;
  condition?: StepConstraint;
}
```

## GraphStore 동작

- `RuntimeGraph`는 `trace_id` 기준으로 upsert된다.
- 동일 `trace_id`에 대한 재구성 결과는 이전 그래프를 대체한다.
- 저장 대상은 `RuntimeGraph`만이며, `SpecGraph`는 engine 내부 계산용 투영 구조로 유지한다.

## 제약 조건

- `source` / `target`이 edge의 canonical endpoint 필드다. `from` / `to`는 사용하지 않는다.
- runtime causal relation의 edge 타입은 `causal`로 고정한다. `derived`는 사용하지 않는다.
- `SpecNode`는 전체 `ScenarioStep` 참조를 들고 있지 않는다.
- `ScenarioStep.next` / `ScenarioStep.branches` 같은 네비게이션 정보는 `SpecEdge`로만 표현한다.
- `timeout_ms`는 latency verdict 계산을 위해 `SpecNode`에 유지한다.
