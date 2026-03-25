---
def:
  id: schema-layer-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---

# Schema Layer — 구조 정의 시스템

## 목적 ^purpose

**Status: DRAFT**

**"스키마 시스템은 구조를 정의하고 검증하지만, 그 구조의 의미를 소유하지 않는다."**
**Schema validates composition, not truth.**

이 시스템은 온톨로지 엔진이 아니라 그 앞단의 **스키마 시스템**이다.
"의미를 추론하는 시스템"이 아니라 "의미가 올라탈 구조를 고정하는 시스템".

기반: [coordinate-states.md](coordinate-states.md) · [event-schema.md](event-schema.md)

---

## 4-Layer 아키텍처

```
Layer 0. Vocabulary    축별 값 사전. 의미를 거의 모른다. 값 테이블.
                       ✅ 구현 완료 (VersionedAxis + entries + capacity)

Layer 1. Coordinate    축 조합을 좌표로 표현. 형식적 표현만 담당.
                       ✅ 구현 완료 (encode/decode + prefix + prefix_ref)

Layer 2. Schema        구조 클래스 정의. 어떤 축 조합이 허용되는지.    ← 이 문서
                       ○ 다음 단계

Layer 3. Semantic      구조의 의미 해석. 규칙, 정책, 추론.
                       ○ 외부 시스템. 플러그인.
```

### Layer 간 경계

| 경계 | 허용 | 금지 |
|---|---|---|
| L0 → L1 | vocabulary 값을 좌표 position으로 사용 | L0이 좌표 구조를 알 필요 없음 |
| L1 → L2 | 좌표 구조를 schema의 기반으로 사용 | L1이 schema 제약을 강제하지 않음 |
| L2 → L3 | schema 구조를 semantic rule의 입력으로 제공 | L2가 의미 추론을 수행하지 않음 |

---

## Layer 0: Vocabulary (✅ 구현 완료)

축별 값 사전. 의미를 거의 모른다. 정해진 값 테이블.

```typescript
// 현재 구현: VersionedAxis
interface AxisVersionSnapshot {
  entries: readonly string[];
  capacity?: number;
  ko?: Record<string, string>;
}

interface VersionedAxis {
  id: string;
  name: string;
  versions: Record<string, AxisVersionSnapshot>;
}
```

축 분류 (coordinate-states.md에서 정의):

| 분류 | 경우의 수 | 관리 | 좌표 인코딩 |
|---|---|---|---|
| 정적 축 | 고정 | 코드 | ✓ |
| 동적 enum 축 | 유한, 변동 | DB 카테고리 테이블 | ✓ |
| 무한 인스턴스 | 무한 | DB 엔티티 테이블 | ✗ (ref로 처리) |

---

## Layer 1: Coordinate (✅ 구현 완료)

축 조합을 좌표로 표현. 형식적 표현만 담당.

```typescript
// 현재 구현: PrefixDef (Layer 1 부분)
// encode({ env: 2, region: 0, svc_name: 0, namespace: 0 }) → 40
// decode(40) → { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }
```

Layer 1의 DimRef는 2종만:

| DimRef | 역할 | 좌표 인코딩 |
|---|---|---|
| `axis` | vocabulary 값 직접 참조 | ✓ |
| `prefix_ref` | 다른 좌표 공간 참조 | ✓ |

`table_ref`는 Layer 1이 아니라 Layer 2의 관심사.

---

## Layer 2: Schema (○ 다음 단계)

### 핵심 포지션

> **고정 좌표계 위에서 구조적 조합 규칙을 명시하는 시스템**

온톨로지보다 훨씬 좁다. 좌표가 이미 고정되어 있으므로 스키마는 "어떤 좌표 조합이 유효한가"만 판단한다.

### 6 기본 스키마 카테고리

도메인 개념(User, Document, Product)이 아니라 **구조 역할(role of structure)** 중심으로 분류한다.

| 카테고리 | 정의 | 슬롯 예시 |
|---|---|---|
| **entity** | 정체성을 가진 것 | entity_kind, identity, state?, attributes? |
| **event** | 발생한 것 | event_kind, actor?, action, target?, outcome? |
| **relation** | 둘 이상의 객체 간 연결 | source_ref, relation_kind, target_ref, qualifiers? |
| **state** | 상태 스냅샷 | subject_ref, state_kind, state_value, scope? |
| **policy** | 권한/적용 범위/판정 구조 | subject, action, resource, effect, scope? |
| **observation** | 관측/로깅/추적 | observed_ref, observation_kind, metric?, trace_id? |

**스키마 종류는 적고, 도메인 변형은 설정으로 푼다.**

```typescript
// 나쁜 방향: 도메인마다 새 스키마 → 온톨로지 회귀
UserSchema, DocumentSchema, TeamSchema, ProductSchema, ...

// 좋은 방향: 구조 역할 6개 + 도메인은 인스턴스 설정
const DocumentEntity = {
  baseSchema: "entity",
  entity_kind: "document",
  allowedStates: ["draft", "published", "archived"],
  allowedRelations: ["owned_by", "contained_in"],
};
```

### 스키마 축 정의

스키마의 각 축(slot)은 다음 속성을 가진다:

```typescript
interface SchemaAxis {
  axisId: string;
  required: boolean;
  multi: boolean;          // 복수 허용 여부
  valueType: "vocabulary" | "ref" | "literal" | "coordinate";
  vocabularyRef?: string;  // vocabulary 축 ID
  defaultValue?: string | number;
}
```

| valueType | 매핑 | 의미 |
|---|---|---|
| `vocabulary` | Layer 0의 axis | 고정 enum 값 |
| `ref` | 현재의 table_ref | 동적 엔티티 참조 |
| `literal` | 없음 (신규) | 문자열/숫자 직접 값 |
| `coordinate` | 현재의 prefix_ref | 다른 좌표 전체 참조 |

### 스키마 정의 예시

```typescript
// EventSchema: "발생한 것"
schema("event.base", {
  version: "v1",
  category: "event",
  axes: {
    namespace:   { required: true,  type: "vocabulary", vocabularyRef: "namespace" },
    event_kind:  { required: true,  type: "vocabulary", vocabularyRef: "event_name" },
    action:      { required: true,  type: "vocabulary", vocabularyRef: "cart_action" },
    actor_ref:   { required: false, type: "ref" },
    target_ref:  { required: false, type: "ref" },
    outcome:     { required: false, type: "vocabulary", vocabularyRef: "outcome" },
  },
  constraints: [
    { rule: "maxCount", axis: "actor_ref", value: 1 },
    { rule: "maxCount", axis: "target_ref", value: 1 },
  ],
});

// RelationSchema: "둘 이상의 객체 간 연결"
schema("relation.base", {
  version: "v1",
  category: "relation",
  axes: {
    namespace:     { required: true,  type: "vocabulary" },
    source_ref:    { required: true,  type: "ref" },
    relation_kind: { required: true,  type: "vocabulary", vocabularyRef: "predicate" },
    target_ref:    { required: true,  type: "ref" },
    qualifier:     { required: false, type: "vocabulary", multi: true },
  },
});
```

### Fragment: 상속이 아니라 조합

공통 구조를 fragment로 추출하고 조합한다.

```typescript
fragment("Identified", {
  identity: { required: true, type: "ref" },
});

fragment("HasActor", {
  actor_ref: { required: false, type: "ref" },
});

fragment("HasTarget", {
  target_ref: { required: false, type: "ref" },
});

fragment("HasOutcome", {
  outcome: { required: false, type: "vocabulary" },
});

// 조합으로 스키마 구성
schema("event.base", {
  category: "event",
  use: ["Identified", "HasActor", "HasTarget", "HasOutcome"],
  axes: {
    event_kind: { required: true, type: "vocabulary" },
    action:     { required: true, type: "vocabulary" },
  },
});
```

**inheritance가 아니라 composition.**

### 구조적 제약 (Schema가 가져가는 것)

| 허용 (구조적 제약) | 금지 (의미적 규칙 → Layer 3) |
|---|---|
| actor는 최대 1개 | owner면 edit 권한 자동 부여 |
| relation은 source/target 필수 | published 이후 archived만 가능 |
| action은 vocabulary에 속해야 함 | employee는 org member의 subtype |
| policy.effect는 allow/deny 중 하나 | manager면 팀 문서를 모두 읽을 수 있음 |

---

## 검증 파이프라인

데이터가 들어오면 Layer 순서대로 검증:

```
1단계. Vocabulary 검증 (Layer 0)
   축 이름 유효한가? vocabulary 값 존재하는가? 타입 맞는가?

2단계. Coordinate 검증 (Layer 1)
   좌표 구조가 canonical form인가? version 해석 가능한가?

3단계. Schema 검증 (Layer 2)
   필수 축 있는가? cardinality 맞는가? 구조 유효한가?

4단계. Semantic 검증 (Layer 3, 외부)
   도메인 규칙에 맞는가? 상태 전이 유효한가? 권한 규칙에 맞는가?
```

1~3은 이 시스템의 코어. 4는 외부 플러그인.

---

## 식별 체계

스키마, 인스턴스, vocabulary, axis의 식별자를 분리한다.

| 종류 | 형태 | 예시 |
|---|---|---|
| 스키마 식별자 | `schema:{category}.{name}:{version}` | `schema:event.base:v1` |
| 인스턴스 식별자 | 도메인별 | `evt_123`, `rel_889`, `doc_204` |
| vocabulary 식별자 | `vocab:{axisId}:{version}` | `vocab:action:v3` |
| axis 식별자 | `axis:{axisId}` | `axis:action`, `axis:resource` |
| coordinate 식별자 | `{prefixId}:{version}:{address}` | `service:v1:40` |

---

## 현재 구현과의 대응

| Layer 2 개념 | 현재 구현 | 상태 |
|---|---|---|
| SchemaDefinition | PrefixDef (부분) | ○ 확장 필요 |
| SchemaAxis | DimRef (부분) | ○ valueType 추가 필요 |
| category (6종) | 없음 | ○ 신규 |
| fragment | 없음 | ○ 신규 |
| constraint | 없음 | ○ 신규 |
| required/optional/multi | 없음 | ○ 신규 |
| validation pipeline | 없음 | ○ 신규 |

### PrefixDef 분리 계획

현재 PrefixDef가 Layer 1과 Layer 2를 동시에 담고 있다:

```
현재:
  PrefixDef = labels + dims(axis/prefix_ref/table_ref) + versions
              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~
              Layer 1 + Layer 2 혼재                     Layer 1

분리 후:
  CoordinateDef: labels + dims(axis/prefix_ref만) + versions   ← Layer 1
  SchemaDef: category + axes(SchemaAxis) + constraints + fragments  ← Layer 2
```

---

## 구현 순서

| 단계 | 내용 | 의존 |
|---|---|---|
| 1 | Vocabulary 정리 (이미 완료) | — |
| 2 | Coordinate canonical form (이미 완료) | Layer 0 |
| 3 | **Base schema 6종 타입 정의** | Layer 0 + 1 |
| 4 | **Fragment 시스템** | Layer 2 타입 |
| 5 | **Constraint DSL** | Layer 2 타입 + Fragment |
| 6 | Semantic plugin interface | Layer 2 완성 후 |

---

## 핵심 설계 원칙

1. **"도메인 개념"이 아니라 "구조 슬롯"을 정의하라**: 스키마 종류는 6개. 도메인 변형은 설정으로 푼다.
2. **상속보다 조합**: fragment composition. 클래스 계층 금지.
3. **Schema validates composition, not truth**: 구조적 제약만. 의미 추론은 외부.
4. **고정 좌표계 위에서 동작**: 축이 이미 고정되어 있으므로 스키마는 "어떤 조합이 유효한가"만 판단.
