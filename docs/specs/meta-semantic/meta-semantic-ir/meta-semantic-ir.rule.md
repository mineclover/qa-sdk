---
def:
  id: meta-semantic-ir-rule
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-ir
      type: refines
    - target: scope-nesting-system
      type: refs
---

# Meta-Semantic IR — 소비 규칙

## 목적 ^purpose

IR 3종을 소비할 때 확인해야 하는 판별 기준, 좌표 매핑, 체크리스트를 정의한다. spec이 "무엇인가"를 기술한다면, 이 문서는 "사용할 때 무엇을 확인하는가"를 기술한다.

---

## 1. IR 타입 → 좌표 prefix 매핑

각 IR 타입이 어떤 prefix로 관측 가능한지.

```
ModuleIR
  └─ ir_module (def_level × def_layer × ir_certainty)
     group|module|leaf × domain|operation|mediation|experience × strict|flexible

DataIR
  └─ ir_data (ir_certainty × ir_transaction_scope × ir_retention × ir_storage_type)
     strict|flexible × local|distributed × ephemeral|session|persistent × memory|db|event-stream

PipeIR
  └─ ir_pipe (svc_ref × ir_pipe_state × ir_call_kind)
     service prefix_ref × pending|committed|rolledBack × method-call|event-emit|http-request|db-query

Spacetime UID
  └─ ir_intent_path (svc_ref × ir_call_kind × ir_pipe_state, addressModel: sum)
```

### product vs sum 판별

| 조건 | addressModel |
|------|:------------:|
| 모든 차원 조합이 유효 | product |
| 세그먼트별 독립 주소 공간 | sum |

ir_module, ir_data, ir_pipe → product.
ir_intent_path → sum (경로별 세그먼트 합산).

---

## 2. 패싯 체크리스트

IR 그래프를 검토하거나 새 IR 요소를 추가할 때 사용하는 판별 기준.

### ModuleIR

- `relations.parent` → 루트(group)인가, 중간(module)인가, 리프(leaf)인가
- `interface.inputs/outputs` → 모든 DataRef가 그래프에 존재하는가
- `meta.level` → `inferModuleLevel(relations)` 결과와 일치하는가
- `relations.external` 순환 → 의도적 상호 의존인가, 설계 오류인가

### DataIR

- `definition.certainty` → `deriveCertainty(fields)` 결과와 일치하는가
- `definition.schemaHash` → `computeSchemaHash(fields)` 결과와 일치하는가
- `management.managedBy` → 그래프에 존재하고, 공유 데이터면 상위 계층인가
- `lifecycle` → producedBy와 consumedBy 중 최소 하나는 비어있지 않은가
- `storage.uidScheme` → 프로젝트 표준("intent:v1")과 일치하는가

### PipeIR

- `targetModule` → 그래프에 존재하는가
- `payload.dataId` → DataIR의 `definition.type`에 매칭되는가
- `triggers` → 순환이 없는가 (DFS로 검증)
- `state` → pending/committed/rolledBack 이외의 값이면 거부

### Cross-IR (그래프 전체)

- 모든 `Pipe.payload.dataId` ∈ `{Data.definition.type}`
- 모든 `Pipe.targetModule.moduleId` ∈ `{Module.id}`
- 모든 `Data.managedBy.moduleId` ∈ `{Module.id}`
- 모든 `Module.interface.inputs[].dataId` ∈ `{Data.definition.type}`
- schema-collision 없음 (같은 schemaHash, 다른 type → 의도 확인 필요)

---

## 3. Nesting Provider 기반 분할 규칙

ModuleIR의 계층 구조는 scope-nesting의 contract descent 패턴과 동형이다.
모듈을 분할하거나 새 모듈을 추가할 때 이 규칙을 따른다.

### 분할 판별 기준

ModuleIR를 분할해야 하는 신호:

| 신호 | 판별 | 조치 |
|------|------|------|
| interface.inputs > 5개 | 소비 계약이 너무 많음 | 하위 module로 분할, 부분 소비 위임 |
| interface.outputs > 3개 | 생산 계약이 너무 많음 | 패싯별 leaf로 분할 |
| relations.children > 7개 | 직접 자식이 많음 | 중간 module 계층 삽입 |
| DataIR.management 공유 3+개 | 같은 데이터를 3개 이상 모듈이 공유 | 공유 데이터의 managedBy를 상위 계층으로 끌어올림 |
| certainty 혼재 | 같은 모듈에 strict + flexible 데이터 공존 | strict 경로와 flexible 경로 분리 |

### Contract Descent 정합성 (ScopeNesting ↔ ModuleIR)

ModuleIR 계층이 scope-nesting의 provides/consumes와 일치하는지 확인:

```
ScopeNesting                          ModuleIR
──────────                            ────────
scope.provides[contractId]      ↔     module.interface.outputs[dataId]
scope.consumes[contractId]      ↔     module.interface.inputs[dataId]
scope depth 순서                ↔     module.relations (parent → children)
override: true                  ↔     하위 모듈이 상위 계약을 재정의
required: false                 ↔     optional consume (없어도 warning만)
```

### Provider 분할 규칙

nesting에서 provider를 분할할 때 IR 측에서 확인하는 것:

1. **단일 책임**: 하나의 ModuleIR이 하나의 ScopeContract와 1:1 대응하는가
   - 1 module → N contracts면 → 각 contract를 leaf module로 분할 검토
2. **계약 하향**: 상위 module이 provides한 것을 하위가 consumes하는 경로가 존재하는가
   - 경로 없으면 → `missing-provider` (nesting 검증)과 `dangling-ref` (IR 검증) 동시 발생
3. **override 정당성**: 하위가 override한 계약에 대해 상위 provider가 실제로 존재하는가
   - 없으면 → `override-no-parent` (nesting) + orphan-module 가능성 (IR)
4. **guard 통과**: 비활성(gate inactive) 계약이 IR에서 orphan-data로 나타나는가
   - guard-inactive contract → DataIR.lifecycle에서 producedBy/consumedBy가 비어있으면 일관적
   - 비어있지 않으면 → gate와 IR 간 불일치

### 분할 후 검증

분할을 실행한 후 아래 순서로 검증:

1. `validateScopeNesting(nesting)` → nesting 계약 정합성 (missing-provider, duplicate 등)
2. `validateIRGraph(graph)` → IR 참조 무결성 (dangling-ref, circular 등)
3. `auditIRGraph(graph)` → 품질 감사 (정합성 + 분할 신호 재확인)
4. `crossValidate(nesting, graph)` → nesting ↔ IR 교차 정합성 (scope↔module, provides↔outputs, consumes↔inputs)
5. 분할 전후 주소 공간 변화 → Spacetime UID 세그먼트 추가만 허용 (기존 불변)

### 자동화 코드

| 함수 | 파일 | 역할 |
|------|------|------|
| `auditIRGraph(graph)` | `ir-audit.ts` | §2 체크리스트 + §3 분할 신호를 단일 호출로 실행 |
| `crossValidate(nesting, graph)` | `ir-nesting-bridge.ts` | nesting ↔ IR 교차 검증 5종 |
| `nestingToModuleIRs(nesting)` | `ir-nesting-bridge.ts` | ScopeNesting → ModuleIR 자동 변환 |
