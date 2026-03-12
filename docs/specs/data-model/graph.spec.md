# SpecGraph / RuntimeGraph + GraphStore

> 기대 행동 그래프(Spec)와 실제 실행 그래프(Runtime)의 타입 정의 및 저장소 포트.

## 상태

implemented (타입 + 포트), engine reconstruction은 hold

## RuntimeGraph 타입

reconstruction 결과. EventRecord[] → 실행 그래프.

```typescript
interface RuntimeGraph {
  traceId: string;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
}

interface RuntimeNode {
  id: string;              // span_id 또는 log_id
  recordKind: string;
  eventKey: string;
  eventVersion: string;
  timestamp: Date;
  spanName?: string;
  startTime?: Date;
  endTime?: Date;
  statusCode?: string;
  payload?: unknown;
}

type RuntimeEdgeType = "parent_child" | "temporal" | "causal";

interface RuntimeEdge {
  source: string;
  target: string;
  edgeType: RuntimeEdgeType;
}
```

## SpecGraph 타입

ScenarioSpec을 컴파일한 기대 행동 그래프.

```typescript
interface SpecGraph {
  scenarioId: string;
  nodes: SpecNode[];
  edges: SpecEdge[];
}

interface SpecNode {
  stepId: string;
  eventKey: string;
  constraints: StepConstraint[];
}

type SpecEdgeType = "sequence" | "branch" | "optional";

interface SpecEdge {
  source: string;
  target: string;
  edgeType: SpecEdgeType;
}
```

## GraphStore 포트

```typescript
interface GraphStore {
  upsert(traceId: string, graph: RuntimeGraph): Promise<void>;
  findByTraceId(traceId: string): Promise<RuntimeGraph | null>;
}
```

## 동작

### upsert
- traceId 기준으로 RuntimeGraph를 JSON으로 저장
- 동일 traceId 재저장 시 덮어쓰기 (re-reconstruction 지원)
- nodeCount, edgeCount 메타데이터 함께 저장

### findByTraceId
- 저장된 RuntimeGraph JSON을 파싱하여 반환
- 없으면 null

## 제약 조건

- RuntimeGraph는 JSON 직렬화 가능해야 함 (Date → ISO-8601 변환 필요)
- SpecGraph는 현재 store에 저장하지 않음 (engine 내부에서만 사용)
- GraphStore는 RuntimeGraph만 저장 — SpecGraph 저장소는 별도 설계 예정
