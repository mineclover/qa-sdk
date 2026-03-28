---
def:
  id: definition-taxonomy
  level: module
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [entry-point, tier-system]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: definition-level
      type: contains
    - target: definition-addressing
      type: contains
---
# Definition Taxonomy — 문서 분류 체계

## 목적 ^purpose

문서를 분류하는 축(scope, aspect, depth, level, layer, link_type)의 정의, 유효 조합, 판단 기준을 기술한다. 이 문서 자체가 분류 체계의 메타 정의이며, 코드 SSOT는 `definition-catalog/src/taxonomy.ts`.

## 구성 ^overview

7개 축이 문서의 정체성을 결정한다:

- **좌표 축** (주소에 인코딩 — 불변): scope × aspect × depth × seq
- **메타데이터** (변할 수 있음): level, lifecycle, layer
- **이중 관리**: address(불변 식별자) + id(표시 라벨)

## 좌표 축

### scope (7종) — "무엇에 대한 정의인가"

참조: `definition-catalog/src/vocabulary.ts:DEF_SCOPE`

| scope | 주 독자 | 핵심 질문 |
|-------|--------|----------|
| ui | 화면을 보는 사용자 | "어떻게 보이는가?" |
| feature | 기능을 이해하려는 개발자 | "무엇을 하는가?" |
| flow | 흐름을 추적하려는 개발자 | "어떤 순서로 진행되는가?" |
| state | 상태를 설계하는 개발자 | "어떤 상태가 있고 어떻게 전이되는가?" |
| constraint | 규칙을 확인하려는 개발자 | "무엇을 제한하는가?" |
| data | 데이터 구조를 파악하려는 개발자 | "어떤 데이터를 다루는가?" |
| interface | API를 호출하는 소비자 | "어떻게 접근하는가?" |

### aspect (22종) — "어떤 측면을 정의하는가"

참조: `definition-catalog/src/vocabulary.ts:DEF_ASPECT`

scope별 유효 조합: `definition-catalog/src/taxonomy.ts:VALID_SCOPE_ASPECTS`

### depth (4종) — "얼마나 상세한가"

| depth | 내용 | 구현 완료 후 |
|-------|------|------------|
| overview | 시스템/그룹 개요 | 유지 |
| specification | 상세 명세 | 타입/API → 소스 참조로 전환 |
| implementation | 구현 세부 | 소스 참조 |
| validation | 테스트/검증 | 테스트 파일 참조 |

## 메타데이터

### level (5종) — "어떤 분해 단위인가"

상세: `definition-level` 문서 참조.

scope보다 상위 개념. 좌표에 인코딩하지 않음 — 분해 시 변할 수 있으므로. module은 재귀 가능.

### layer (4종) — "왜 존재하는가"

참조: `definition-catalog/src/types.ts:DefLayer`

scope(구조)와 직교. "이것을 삭제해도 비즈니스 진실이 바뀌는가?"로 판단.

### lifecycle (5종) — "현재 상태는"

draft → review → approved → deprecated → archived

### link_type (6종) — "어떤 관계인가"

참조: `definition-catalog/src/taxonomy.ts:LINK_TYPE_RULES`

## 주소 체계

상세: `definition-addressing` 문서 참조.

### v1 (분류용 — 현재)

```
def_document:v1:<address> = scope(16) × aspect(64) × depth(8) = 8,192 공간
```

같은 유형의 문서가 같은 주소를 공유. 주소 = 분류, 식별 = id 필드.

### v2 (유일 식별 — 이행 중)

```
def_document:v2:<address> = scope(16) × aspect(64) × depth(8) × seq(128) = 1,048,576 공간
```

모든 문서가 유일한 주소를 가짐. 주소 = 불변 식별자, id = 표시 라벨.

### config 파일

참조: `definition-catalog/src/def-config.ts`

`.qa-sdk/def-config.json`에 주소 버전, 동기화 시각, 문서별 해시를 기록하여 drift를 감지한다.

## 관련 소스

- `definition-catalog/src/types.ts` — DefLevel, DefScope, DefAspect, DefDepth, DefLayer, LinkType
- `definition-catalog/src/vocabulary.ts` — DEF_LEVEL, DEF_SCOPE, DEF_ASPECT, DEF_DEPTH, DOC_SEQ, LINK_TYPE
- `definition-catalog/src/taxonomy.ts` — VALID_SCOPE_ASPECTS, LINK_TYPE_RULES, CLASSIFICATION_CONVENTIONS
- `definition-catalog/src/observe.ts` — encodeDocument(v1), encodeUniqueDocument(v2)
- `definition-catalog/src/address-assign.ts` — assignUniqueAddresses, buildIdToAddressMap
- `definition-catalog/src/def-config.ts` — readDefConfig, writeDefConfig, detectDrift
