---
def:
  id: indexing-architecture
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  tags: [tier-infra]
  links:
    - target: coordinate-states-spec
      type: depends_on
    - target: schema-layer-spec
      type: depends_on
    - target: event-schema-spec
      type: depends_on
---

# 시스템 아키텍처 — 구조 운영 시스템 전체 설계

## 목적 ^purpose

**Status: DRAFT**

**고정 좌표계 기반의 구조 스키마 및 추적 시스템.**
문서 정의, 구조 스키마, 식별자, 런타임 로그를 하나의 canonical coordinate system 위에 정렬하는 구조 운영 시스템.

**이 시스템은 의미를 소유하지 않는다.** 구조를 정의하고, 식별 가능하게 만들고, 기록하고, 추적 가능하게 만든다.

기반: [coordinate-states.md](coordinate-states.md) · [schema-layer.md](schema-layer.md) · [event-schema.md](event-schema.md)

---

## 한 줄 정의

> **구조를 정의하고, 식별하고, 기록하고, 추적한다. 의미 해석은 외부에 맡긴다.**

---

## Layer 구조

의존 방향은 아래→위. 아래 Layer가 위 Layer의 기반.

```
                                    ┌──────────────────────────┐
 (횡단) Identifier Convention       │ 모든 Layer에서 사용하는    │
        naming · versioning · refs  │ 식별자 규약               │
                                    └──────────────────────────┘

 ✅ L0. Vocabulary ─────────────────────────────────────────────
 │  축별 값 사전. 의미를 거의 모른다. 값 테이블.
 │  axis registry · vocabulary registry · version · value code
 │
 ✅ L1. Coordinate ─────────────────────────────────────────────
 │  축 조합 → 정수. 형식적 표현만 담당.
 │  encode/decode · prefix · prefix_ref · stride · shape
 │
 ○ L2. Schema ──────────────────────────────────────────────────
 │  구조 템플릿. 어떤 축 조합이 유효한지 정의.
 │  6 categories · fragments · constraints · validation
 │
 ○ L3. Runtime ─────────────────────────────────────────────────
 │  인스턴스 기록. 실제 발생한 것을 구조화하여 저장.
 │  event instances · state writes · relation writes · traces
 │
 ○ L4. Semantic (외부) ─────────────────────────────────────────
    추론, 정책, 상태 전이 해석. 코어 밖.
    policy engine · rule engine · ontology wrapper

 (투영) Document Spec ──────────────────────────────────────────
    L0~L3을 사람이 읽는 형태로 투영.
    Boundary · Contract · State · Flow
```

### Layer 간 의존 규칙

| 규칙 | 설명 |
|---|---|
| L0 ← L1 | Coordinate는 Vocabulary 위에서 동작 |
| L1 ← L2 | Schema는 Coordinate 구조를 기반으로 제약 정의 |
| L2 ← L3 | Runtime은 Schema에 맞는 인스턴스를 기록 |
| L2 ← L4 | Semantic은 Schema 구조를 입력으로 해석 |
| L3 → L4 | Runtime 데이터를 Semantic이 판정 |
| **역방향 금지** | 하위 Layer가 상위 Layer를 알면 안 됨 |

---

## L0. Vocabulary (✅ 구현 완료)

축별 값 사전. 의미를 거의 모른다.

```typescript
interface VersionedAxis {
  id: string;
  name: string;
  versions: Record<string, AxisVersionSnapshot>;
}
```

축 분류:

| 분류 | 경우의 수 | 관리 | 인코딩 |
|---|---|---|---|
| 정적 축 | 고정 | 코드 | ✓ |
| 동적 enum 축 | 유한, 변동 | DB 카테고리 테이블 | ✓ (axis + flexible + headroom) |
| 무한 인스턴스 | 무한 | DB 엔티티 테이블 | ✗ (ref로 처리) |

구현: `demo-catalog.ts` VersionedAxis, `index-meta` CrossVersionEntrySync, EntryFlagStore

---

## L1. Coordinate (✅ 구현 완료)

축 조합을 좌표로 표현. 형식적 표현만 담당.

```
encode({ env: 2, region: 0, svc_name: 0, namespace: 0 }) → 40
decode(40) → { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }
```

DimRef 2종 (CORE):

| DimRef | 역할 | 인코딩 |
|---|---|---|
| `axis` | vocabulary 직접 참조 | ✓ |
| `prefix_ref` | 다른 좌표 공간 참조 | ✓ |

구현: `demo-catalog.ts` PrefixDef, `demo-accessors.ts` encode/decode/resolve

---

## L2. Schema (○ 다음 단계)

> **Schema validates composition, not truth.**

### 6 기본 스키마 카테고리

도메인 개념이 아니라 **구조 역할** 중심.

| 카테고리 | 정의 | 핵심 슬롯 |
|---|---|---|
| **entity** | 정체성을 가진 것 | entity_kind, identity, state? |
| **event** | 발생한 것 | event_kind, action, actor?, target?, outcome? |
| **relation** | 둘 이상의 연결 | source_ref, relation_kind, target_ref |
| **state** | 상태 스냅샷 | subject_ref, state_kind, state_value |
| **policy** | 판정 구조 | subject, action, resource, effect |
| **observation** | 관측/추적 | observed_ref, observation_kind, trace_id? |

### 슬롯의 value type

| valueType | L0/L1 대응 | 의미 |
|---|---|---|
| `vocabulary` | L0 axis | 고정 enum 값 |
| `coordinate` | L1 prefix_ref | 다른 좌표 전체 참조 |
| `ref` | table_ref | 동적 엔티티 참조 (인코딩 안 됨) |
| `literal` | — (신규) | 문자열/숫자 직접 값 |

### 구조적 제약 (Schema가 가져가는 것)

| 허용 | 금지 (→ L4) |
|---|---|
| 필수/선택 축 | owner면 edit 부여 |
| cardinality (max 1) | 상태 전이 규칙 |
| vocabulary 범위 제한 | subtype 추론 |
| 구조 유효성 | 권한 해석 |

### Fragment: 상속이 아니라 조합

```typescript
fragment("HasActor",  { actor_ref:  { required: false, type: "ref" } });
fragment("HasTarget", { target_ref: { required: false, type: "ref" } });

schema("event.base", {
  category: "event",
  use: ["HasActor", "HasTarget"],
  axes: {
    event_kind: { required: true, type: "vocabulary" },
    action:     { required: true, type: "vocabulary" },
  },
});
```

상세: [schema-layer.md](schema-layer.md)

---

## L3. Runtime (○ 그 다음)

Schema에 맞는 인스턴스를 기록.

### 구조 참조형 로그

로그 = 단순 메시지가 아니라 **구조에 대한 참조**:

```json
{
  "ts": "2026-03-19T22:10:11Z",
  "trace_id": "trc_123",
  "boundary_id": "boundary.cms.team",
  "flow_id": "flow.team.create",
  "schema_id": "schema.event.ui.submit.v1",
  "coord": { "namespace": "cms", "action": "submit" },
  "refs": { "actor": "user_17", "target": "team_temp" },
  "outcome": "success"
}
```

### 저장소 분리

| 저장소 | 대상 | 특성 |
|---|---|---|
| **Registry DB** | axis, vocabulary, schema, boundary, contract, state, flow | versioned, lookup 중심 |
| **Runtime DB** | event, state write, relation, observation, trace | append 중심, 시계열 |
| **Resolver Store** | policy rules, transition rules, ontology | 변경 가능, 도메인별 (L4) |

---

## L4. Semantic (○ 외부)

Schema 구조를 입력으로 받아서 해석. **코어 밖.**

| 컴포넌트 | 역할 |
|---|---|
| Policy Engine | 권한 판정 |
| Rule Engine | 도메인 규칙 평가 |
| State Transition Validator | 상태 전이 유효성 |
| Ontology Wrapper | 외부 온톨로지 매핑 |

---

## Document Spec (투영)

L0~L3을 **사람이 읽는 형태로 투영**한 것. 별도 계산층이 아니라 다른 Layer들의 뷰.

### 4종 문서 스펙

| 문서 | 중심 질문 | 시스템 대응 |
|---|---|---|
| **Boundary Spec** | 누가 무엇을 소유하고 책임지는가? | schema + axis 범위 |
| **Contract Spec** | 입출력 구조는 무엇인가? | schema constraint + validation |
| **State Spec** | 어떤 상태값이 있고 누가 관리하는가? | state schema + vocabulary |
| **Flow Spec** | 어떤 순서로 무엇이 발생하는가? | event/relation schema 경로 |

### Boundary Spec

```yaml
boundary_id: boundary.cms.team
version: v1
owner: team-service
owns:
  - schema:entity.team.v1
  - schema:state.team.lifecycle.v1
exposes:
  - contract:api.team.create.v1
depends_on:
  - boundary.auth.user
```

### Contract Spec

```yaml
contract_id: contract.api.team.create
version: v1
kind: api_command
input_schema: schema:command.team_create.v1
output_schema: schema:result.team_create.v1
errors: [team_name_invalid, member_not_found]
```

### State Spec

```yaml
state_id: state.team.lifecycle
version: v1
subject_schema: schema:entity.team.v1
values: [draft, active, archived]    # vocabulary
authority: team-service
# 전이 규칙은 여기 안 넣음 → L4
```

### Flow Spec

```yaml
flow_id: flow.team.create
version: v1
steps:
  - step: ui.submit
    emits: schema:event.ui.submit.v1
  - step: api.receive
    consumes: contract:api.team.create.v1
  - step: service.create
    emits: schema:event.domain.team_created.v1
  - step: state.activate
    writes: state.team.lifecycle=active
```

---

## 식별자 규약 (횡단)

모든 Layer에서 사용하는 일관된 식별자 체계.

### 정의 식별자 (Registry)

| 종류 | 패턴 | 예시 |
|---|---|---|
| boundary | `boundary.{domain}.{name}` | `boundary.cms.team` |
| contract | `contract.{channel}.{resource}.{verb}` | `contract.api.team.create` |
| state | `state.{subject}.{kind}` | `state.team.lifecycle` |
| flow | `flow.{domain}.{action}` | `flow.team.create` |
| schema | `schema:{category}.{name}.v{n}` | `schema:event.ui.submit.v1` |
| vocabulary | `vocab:{axisId}:v{n}` | `vocab:action:v3` |
| axis | `axis:{axisId}` | `axis:action` |
| coordinate | `{prefixId}:v{n}:{address}` | `service:v1:40` |

### 런타임 식별자

| 종류 | 패턴 | 예시 |
|---|---|---|
| instance | `{type}_{id}` | `team_42`, `evt_999` |
| trace | `trc_{id}` | `trc_abc123` |
| span | `spn_{id}` | `spn_01` |

---

## 검증 파이프라인

데이터 입력 시 Layer 순서대로 검증:

```
L0 검증: 축 이름 유효? vocabulary 값 존재? 타입 맞음?
  ↓
L1 검증: 좌표 canonical form? version 해석 가능?
  ↓
L2 검증: 필수 축 존재? cardinality? 구조 유효?
  ↓
L4 검증 (외부): 도메인 규칙? 상태 전이? 권한?
```

L0~L2 = 이 시스템의 코어. L4 = 외부 플러그인.

---

## 추적성: 문서 → 스키마 → 런타임

이 시스템의 핵심 가치: 모든 레벨이 같은 식별자로 연결된다.

```
Boundary Spec          boundary.cms.team
    ↓ owns
Contract Spec          contract.api.team.create
    ↓ input
Schema                 schema:command.team_create.v1
    ↓ instance
Runtime Event          evt_999 (schema_id, coord, refs)
    ↓ trace
Observation Log        trace_id = trc_123
```

이 연결으로 가능해지는 질문:

- 이 로그는 어떤 기능 정의에서 나왔는가?
- 이 상태 변화는 어떤 계약을 통해 발생했는가?
- 이 이벤트는 어느 경계 책임 아래 있었는가?
- 설계된 흐름과 실제 흐름이 얼마나 달랐는가?

---

## 주의사항

1. **스키마에 도메인 개념을 너무 많이 넣지 말 것**: UserSchema, InvoiceSchema, TeamSchema... → 온톨로지 회귀. 6 카테고리로 수렴.
2. **상태 정의에 전이 규칙까지 넣지 말 것**: 상태값 집합 + authority까지만. 전이 규칙은 L4.
3. **Flow Spec을 실행 엔진으로 만들지 말 것**: 처음에는 추적과 설계 검토용. Workflow engine은 다른 시스템.

---

## 현재 구현 상태

| Layer | 상태 | 구현 위치 |
|---|---|---|
| L0 Vocabulary | ✅ | `demo-catalog.ts` VersionedAxis, `index-meta` EntryFlagStore |
| L1 Coordinate | ✅ | `demo-catalog.ts` PrefixDef, `demo-accessors.ts` encode/decode |
| L2 Schema | ○ 스펙만 | `schema-layer.md` |
| L3 Runtime | ○ 스펙만 | `event-schema.md`, `behavioral-traversal.md` |
| L4 Semantic | ○ 외부 | — |
| Identifier | ○ 부분 | 좌표 식별자만 구현, 나머지 미정의 |
| Document Spec | ○ 스펙만 | 이 문서 |

### 다음 구현 순서

| 순서 | 내용 |
|---|---|
| 1 | 식별자 규약 고정 (naming convention) |
| 2 | Base schema 6종 타입 정의 |
| 3 | Fragment 시스템 |
| 4 | Constraint DSL |
| 5 | 로그 공통 필드 고정 |
| 6 | Registry DB 초안 |
