---
def:
  id: schema-layer-spec
  address: def_document:v2:342193
  scope: data
  aspect: domain_data
  depth: overview
  level: module
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: []
  links:
    - target: coordinate-states-spec
      type: depends_on
    - target: event-schema-spec
      type: depends_on
    - target: schema-layer-architecture-spec
      type: contains
    - target: schema-layer-categories-spec
      type: contains
    - target: schema-layer-fragments-spec
      type: contains
    - target: schema-layer-validation-spec
      type: contains
    - target: schema-layer-implementation-spec
      type: contains
---

# Schema Layer — 구조 정의 시스템

## 목적 ^purpose

**"스키마 시스템은 구조를 정의하고 검증하지만, 그 구조의 의미를 소유하지 않는다."**
**Schema validates composition, not truth.**

이 시스템은 온톨로지 엔진이 아니라 그 앞단의 **스키마 시스템**이다.
"의미를 추론하는 시스템"이 아니라 "의미가 올라탈 구조를 고정하는 시스템".

## 구성 ^overview

- **4-Layer 아키텍처**: Vocabulary(L0, 축별 값 사전) → Coordinate(L1, 좌표 표현) → Schema(L2, 구조 조합 규칙) → Semantic(L3, 외부 플러그인)
- **6 기본 스키마 카테고리**: entity, event, relation, state, policy, observation — 도메인 개념이 아닌 구조 역할 중심 분류
- **SchemaAxis 타입 체계**: valueType 4종(vocabulary, ref, literal, coordinate) + required/multi/defaultValue 속성
- **Fragment 조합**: 상속 없이 공통 구조를 fragment로 추출하고 `use`로 조합 (composition over inheritance)
- **검증 파이프라인 4단계**: Vocabulary 검증(L0) → Coordinate 검증(L1) → Schema 검증(L2) → Semantic 검증(L3, 외부)
- **구조적 제약만 허용**: "actor는 최대 1개" 같은 구조 제약은 Schema, "owner면 edit 권한" 같은 의미 규칙은 L3 외부
- **식별 체계**: schema/instance/vocabulary/axis/coordinate 각각 고유 식별자 형식 분리
- **PrefixDef 분리 계획**: 현재 L1+L2 혼재 → CoordinateDef(L1)와 SchemaDef(L2)로 분리 예정

## 참조

기반: [coordinate-states.md](coordinate-states.md) · [event-schema.md](event-schema.md)
