---
def:
  tier: component
  id: schema-layer-categories-spec
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: schema-layer-spec
      type: refines
---

# Schema Layer — Layer 2 스키마 카테고리와 축 정의

## 목적 ^purpose

Layer 2(Schema)의 핵심 구조를 정의한다. 6종 기본 스키마 카테고리(구조 역할 중심 분류)와
SchemaAxis 타입 체계를 명시하여, 도메인 개념이 아닌 구조 슬롯 기반의 스키마 설계를 보장한다.

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
