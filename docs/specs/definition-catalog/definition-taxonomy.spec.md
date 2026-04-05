---
def:
  id: definition-taxonomy
  type: knowledge
  knowledge_kind: concept
  level: module
  address: def_document:v2:342164
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [entry-point]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: definition-level
      type: contains
    - target: definition-addressing
      type: contains
    - target: tag-management-spec
      type: depends_on
---
# Definition Taxonomy — 문서 분류 체계

## 목적 ^purpose

문서를 분류하는 축(scope, aspect, depth, level, layer, link_type)의 정의, 유효 조합, 판단 기준을 기술한다. 이 문서 자체가 분류 체계의 메타 정의이며, 코드 SSOT는 `definition-catalog/src/taxonomy.ts`.

## 정의 ^defines

- scope 7종, aspect 22종, depth 4종, lifecycle 5종, level 3종, layer 4종, link_type 8종
- 문서 태그는 좌표 축이 아니라 보조 taxonomy이며 `tag-management-spec`에서 관리
- VALID_SCOPE_ASPECTS 유효 조합 제약
- v1/v2 주소 공간 개요

## 위임 ^delegates

- **definition-level** → 분해 레벨(3종) 상세
- **definition-addressing** → 주소 체계 상세 (이중 관리, 마이그레이션)

## 구성 ^overview

7개 축이 문서의 정체성을 결정한다:

- **좌표 축** (주소에 인코딩 — 불변): scope(7) × aspect(22) × depth(4) × seq(128)
- **메타데이터** (변할 수 있음): level(3), lifecycle(5), layer(4)
- **관계**: link_type(8)
- **이중 관리**: address(불변 식별자) + id(표시 라벨)
- **하위 문서**: definition-level(분해 레벨), definition-addressing(주소 체계)

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

```
소프트웨어 정의
├── 화면/UI (ui)
│   ├── 레이아웃 (layout)         화면의 공간 배치와 구조
│   ├── 컴포넌트 (component)      재사용 가능한 UI 구성 요소
│   └── 인터랙션 (interaction)    사용자 상호작용 동작과 피드백
│
├── 기능 (feature)
│   ├── 기능정의 (func_def)       기능의 명세와 동작 규칙
│   └── 시나리오 (scenario)       기능의 사용 시나리오와 기대 결과
│
├── 흐름 (flow)
│   ├── 사용자시나리오 (user_scenario)  사용자 관점의 작업 흐름
│   ├── 프로세스흐름 (process_flow)     시스템 내부 처리 순서
│   └── 연관관계 (relation)             엔티티/기능 간 연결과 의존성
│
├── 상태 (state)
│   ├── 앱상태 (app_state)        프론트엔드 애플리케이션 상태
│   ├── 도메인상태 (domain_state)  비즈니스 도메인 상태 모델
│   └── 시스템상태 (system_state)  인프라/런타임 수준 상태
│
├── 제약조건 (constraint)
│   ├── 기술적제약 (tech_constraint)   기술 스택, 성능, 호환성 제약
│   ├── 비즈니스제약 (biz_constraint)  비즈니스 규칙, 정책, 규정 제약
│   └── 인프라제약 (infra_constraint)  인프라, 배포, 운영 환경 제약
│
├── 데이터 (data)
│   ├── 도메인데이터 (domain_data)    비즈니스 도메인 엔티티와 스키마
│   ├── 시스템데이터 (system_data)    설정, 로그, 메트릭 등 시스템 데이터
│   ├── 외부데이터 (external_data)    외부 API, 서드파티 데이터 연동
│   ├── Prefix스키마 (prefix_schema)  좌표 prefix의 차원 구성, 버전, capacity 정의
│   └── Axis카탈로그 (axis_catalog)   좌표 축의 entries, capacity, headroom 정의
│
└── 인터페이스 (interface)
    ├── API계약 (api_contract)       REST/gRPC 엔드포인트, 요청/응답 스키마
    ├── CLI계약 (cli_contract)       커맨드, 플래그, 옵션, 출력 형식
    └── 이벤트계약 (event_contract)  이벤트 스키마, 메시지 포맷, 발행/구독 규약
```

scope-aspect 유효 조합: 22개. `VALID_SCOPE_ASPECTS`가 제약, `validateScopeAspect()`가 검증.

### depth (4종) — "얼마나 상세한가"

| depth | 내용 | 구현 완료 후 |
|-------|------|------------|
| overview | 시스템/그룹 개요 | 유지 |
| specification | 상세 명세 | 타입/API → 소스 참조로 전환 |
| implementation | 구현 세부 | 소스 참조 |
| validation | 테스트/검증 | 테스트 파일 참조 |

## 메타데이터

### level (3종) — "어떤 분해 단위인가"

상세: `definition-level` 문서 참조.

scope보다 상위 개념. 좌표에 인코딩하지 않음 — 분해 시 변할 수 있으므로. module은 재귀 가능.

### layer (4종) — "왜 존재하는가"

참조: `definition-catalog/src/types.ts:DefLayer`

scope(구조)와 직교. "이것을 삭제해도 비즈니스 진실이 바뀌는가?"로 판단.

### lifecycle (5종) — "현재 상태는"

draft → review → approved → deprecated → archived

### link_type (8종) — "어떤 관계인가"

참조: `definition-catalog/src/taxonomy.ts:LINK_TYPE_RULES`

`depends_on`, `implements`, `refines`, `constrains`, `traces_to`, `contains`, `evolves_from`, `supersedes`

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
