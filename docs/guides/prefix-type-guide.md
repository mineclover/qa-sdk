# Prefix 유형 가이드 — 프로젝트 분석 → prefix 설계

## 1. prefix가 뭔가

prefix는 **N개 축의 조합으로 만든 주소 공간**. 어떤 시스템의 "이 지점에서 이런 일이 일어났다"를 좌표로 표현.

```
endpoint:v1:32 = "prod/asia/shopping-web에서 POST /api v1 호출"
  └── svc_ref(→service) × resource_type × http_method × api_version
```

## 2. 6종 카테고리

프로젝트를 분석할 때, 모든 "좌표화할 것"은 6종 중 하나로 분류된다.

```
┌─────────────┬──────────────────┬─────────┬──────────────────────────────────────────┐
│  카테고리   │       설명       │ 현재 수 │                판정 기준                 │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ entity      │ 정체성을 가진 것 │    5    │ 서비스, 콘텐츠, 리소스. 2-6 dims.        │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ event       │ 발생한 것        │   15    │ action/op/intent 관련 축 필수.           │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ observation │ 관측 포인트      │   11    │ svc_ref(서비스 참조) 포함. 관측 데이터.  │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ policy      │ 권한/규칙        │    2    │ role/action/resource 축 포함.            │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ relation    │ 관계 모델        │    1    │ subject-predicate-object 3+ dims.        │
├─────────────┼──────────────────┼─────────┼──────────────────────────────────────────┤
│ state       │ 상태 스냅샷      │    0    │ status/lifecycle 축 포함.                │
└─────────────┴──────────────────┴─────────┴──────────────────────────────────────────┘
```

> 검증: `category-rules.ts` (`CATEGORY_RULES`) 기준. `dkg report` 또는 `graph.groupPrefixesByCategory()`로 확인 가능.

### entity — "무엇이 있는가" (5개)
**시스템에 존재하는 것의 정의.**

- 서비스, 콘텐츠, 리소스, 패키지, 모듈
- dims: 식별 차원 (env, region, name, namespace 등). 2-6개.
- 규칙: L1 structural — `minDims: 2, maxDims: 6`

현재 prefix:
| prefix | dims | 설명 |
|--------|------|------|
| `service` | env × region × svc_name × namespace | 서비스 식별 |
| `content` | tag × category × status × locale × channel | 콘텐츠 플랫폼 |
| `tracking` | trackAction × page × userType | 사용자 행동 추적 |
| `contract_check` | qa_pkg × api_surface × test_result | 인터페이스 계약 검증 |
| `execution_context` | execution_mode × record_type | 실행 컨텍스트 |

판정: "이것은 다른 것들이 참조하는 대상인가?" → entity

### event — "무엇이 일어났는가" (15개)
**발생한 사건의 기록.**

- 액션, 이벤트, 변경, 트리거
- dims: action/operation 관련 축 필수
- 규칙: L1 — `requiredDimKinds: ["axis"], minDims: 2` + L2 — action 관련 축 존재 검증

현재 prefix:
| prefix | 도메인 | 핵심 dims |
|--------|--------|-----------|
| `event` | shopping | evt_svc × event_name × initiator |
| `cart_event` | shopping | actor(tbl) × action × target(tbl) |
| `auth_event` | shopping | actor(tbl) × action |
| `order_event` | shopping | service_ctx(ref) × actor(tbl) × action × order(tbl) |
| `deploy_event` | infra | svc_ref(ref) × deploy_action × actor(tbl) |
| `health_event` | infra | svc_ref(ref) × health_status |
| `engine_event` | pipeline | svc_ref(ref) × constraint_op × verdict_result |
| `schema_event` | pipeline | svc_ref(ref) × migration_pattern × deploy_action |
| `build_event` | dev | qa_pkg × qa_module × build_result |
| `test_event` | dev | qa_pkg × qa_module × test_result |
| `dkg_event` | dev | dkg_op × dkg_target_kind |
| `dkg_decision_event` | dev | decision_type × dkg_target_kind × node_source |
| `dkg_observation_event` | dev | obs_source × dkg_target_kind × lifecycle_state |
| `cli_event` | dev | cli_intent × cli_domain × cli_subject |
| `observation_event` | dev | observation_intent × dkg_target_kind |

판정: "이것은 시간 순서로 발생하는가? action 축이 있는가?" → event

### observation — "무엇이 관측됐는가" (11개)
**관측 포인트. entity에 대한 측정/추적.**

- 페이지뷰, API 호출, 흐름 진입, 파이프라인 단계
- dims: svc_ref(서비스 참조) + 관측 차원
- 규칙: L1 — `requiredRefs: ["service"]` + L2 — `references` 엣지에 service 포함 검증

현재 prefix:
| prefix | 도메인 | 핵심 dims |
|--------|--------|-----------|
| `page_view` | observation | svc_ref(ref) × page × locale × userType |
| `endpoint` | observation | svc_ref(ref) × resource_type × http_method × api_version |
| `flow_point` | observation | svc_ref(ref) × flow_name × flow_step × flow_variant |
| `pipeline_point` | observation | svc_ref(ref) × pipeline_phase × validation_mode × verdict_result × temporal_strategy |
| `data_policy` | observation | svc_ref(ref) × mask_mode |
| `schema_validation` | observation | svc_ref(ref) × validation_layer × constraint_rule × verdict_result |
| `pattern_match` | observation | svc_ref(ref) × identification_mode × behavior_pattern × pattern_confidence |
| `pattern_anomaly` | observation | svc_ref(ref) × anomaly_kind × behavior_pattern × anomaly_severity |
| `version_point` | observation | svc_ref(ref) × version_lifecycle |
| `gate_point` | observation | svc_ref(ref) × address_state |
| `ingest_record` | observation | svc_ref(ref) × record_type |

판정: "이것은 어떤 서비스의 특정 지점을 관찰하는가?" → observation

### policy — "무엇이 허용되는가" (2개)
**권한, 규칙, 적용 범위.**

- RBAC, ACL, feature flag
- dims: role/action/resource 축 포함
- 규칙: L1 — `requiredDimKinds: ["axis"]` + L2 — role/action/resource 축 존재 검증

현재 prefix:
| prefix | dims |
|--------|------|
| `permission` | perm_svc(ref) × role |
| `rbac` | role × action × resource |

판정: "이것은 허용/거부 판정에 사용되는가?" → policy

### relation — "무엇이 연결되는가" (1개)
**객체 간 관계.**

- subject-predicate-object 패턴
- dims: 3+ (주체, 술어, 객체)
- 규칙: L1 — `minDims: 3`

현재 prefix:
| prefix | dims |
|--------|------|
| `relational` | subjectKind × predicate × objectKind |

판정: "이것은 두 대상 사이의 관계를 표현하는가?" → relation

### state — "현재 상태가 뭔가" (0개)
**상태 스냅샷.**

- 현재 진행 상태, lifecycle 단계
- dims: status/lifecycle 축 포함
- 규칙: L1 — `minDims: 2`

현재 prefix: 없음. `version_point`과 `gate_point`은 구조적으로 state에 가까우나 svc_ref를 포함하여 observation으로 분류됨.

판정: "이것은 현재 시점의 상태를 나타내는가?" → state

## 3. 프로젝트 분석 절차

새 프로젝트에 prefix를 설계할 때:

### Step 1: 시스템의 "명사"를 나열

어떤 것들이 존재하는가?
```
예: 쇼핑몰 → 서비스, 상품, 사용자, 주문, 결제, 배송
예: CI 시스템 → 파이프라인, 빌드, 테스트, 배포, 환경
예: 관측 시스템 → 엔드포인트, 페이지, 흐름, 이벤트
```

→ 각 명사가 **entity** prefix 후보.

### Step 2: 시스템의 "동사"를 나열

어떤 일이 일어나는가?
```
예: 쇼핑몰 → 장바구니 추가, 주문 생성, 결제, 배송 시작
예: CI 시스템 → 빌드 성공/실패, 테스트 통과, 배포 완료
예: 관측 시스템 → 페이지 조회, API 호출, 흐름 진입
```

→ 각 동사가 **event** 또는 **observation** prefix 후보.
- action 축이 자연스럽게 나오면 → event
- 관측 지점에서 발생하면 → observation

### Step 3: 시스템의 "규칙"을 나열

어떤 것이 허용/금지되는가?
```
예: 쇼핑몰 → 역할별 접근 권한, 결제 한도
예: CI 시스템 → 배포 승인 규칙, 환경별 제한
```

→ **policy** prefix 후보.

### Step 4: 시스템의 "관계"를 나열

무엇이 무엇에 연결되는가?
```
예: 쇼핑몰 → 사용자-주문, 상품-카테고리
예: CI 시스템 → 서비스-의존성, 팀-소유권
```

→ **relation** prefix 후보.

### Step 5: 각 후보에 축 설계 (5Q Checklist)

후보마다 어떤 차원이 필요한지 결정. 각 차원에 대해:

```
Q1: 유한한가? → YES → axis 후보
Q2: 의사결정에 사용되는가? → YES
Q3: 여러 prefix에서 공유되는가? → YES
Q4: 안정적인가 (자주 변하지 않는가)? → YES
Q5: capacity를 합리적으로 잡을 수 있는가? → YES

전부 YES → axis로 등록
하나라도 NO → table_ref 또는 payload로 처리
```

### Step 6: prefix 조합으로 DSL 번들 구성

관련 prefix를 DSL로 묶고 불변조건을 선언.

```
dsl-checkout:
  members: [page_view, endpoint, flow_point, order_event, permission]
  invariant: "checkout page_view 없이 flow_point(success)가 관측되면 안 됨"
```

## 4. 예시: qa-sdk 자기참조

qa-sdk 모노레포를 분석한 결과 (34개 prefix):

| Step | 발견 | 카테고리 | prefix 예시 |
|------|------|---------|------------|
| 명사 | 서비스, 콘텐츠, 패키지, 모듈 | entity (5) | service, content, tracking, execution_context |
| 동사 | 빌드, 테스트, CLI, 스킬, DKG, 배포, 인증, 주문 | event (15) | build_event, test_event, cli_event, deploy_event, cart_event |
| 관측 | 페이지뷰, API 호출, 흐름, 파이프라인, 패턴, 상태 | observation (11) | endpoint, flow_point, pipeline_point, pattern_match, version_point |
| 규칙 | RBAC, 권한 체크 | policy (2) | permission, rbac |
| 관계 | subject-predicate-object | relation (1) | relational |
| 상태 | (현재 없음 — observation으로 흡수됨) | state (0) | — |

카테고리 분포 결정은 `category-rules.ts`의 `CATEGORY_RULES`와 각 prefix의 `meta.category`로 제어된다.
`inferCategory()`가 `meta.category` 우선 → 구조 기반 fallback 순으로 판정.

## 5. dim 유형

각 prefix의 dim은 3종 중 하나:

| dim 유형 | 설명 | 인코딩 | 예 |
|----------|------|--------|---|
| **axis** | 유한한 열거형 값 | 정수 position | role, env, action |
| **prefix_ref** | 다른 prefix의 주소 참조 | 참조 prefix의 1D 주소 | svc_ref → service |
| **table_ref** | 외부 DB 테이블 참조 | 런타임 ID (인코딩 안 됨) | actor → members |

선택 기준:
- 5Q 전부 YES → **axis**
- 다른 prefix의 컨텍스트를 공유 → **prefix_ref**
- 무한하거나 런타임에만 존재 → **table_ref**

## 6. capacity 규칙

| entries 수 | 권장 capacity | 예 |
|-----------|-------------|---|
| 2-4 | 8 | build_result(4) |
| 5-8 | 16 | cli_intent(7) |
| 9-16 | 32 | dkg_target_kind(10) |
| 17-32 | 64 | skill_id(27) |

공식: `nextPowerOf2(entries × 2)`
