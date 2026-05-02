---
def:
  tier: component
  id: prefix-guide-modeling
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [entry-point, runtime, observability]
  links:
    - target: prefix-guide
      type: traces_to
---

# Prefix 모델링 기준 — 무엇이든 prefix가 될 수 있다

## 목적 ^purpose

의사결정이 필요한 교차점(페이지, API, 이벤트, 권한)을 prefix로 모델링하는 기준을 설명하고, entity/policy/relation/observation/event 카테고리별 prefix 분류표를 제공한다.

## prefix는 무엇이든 될 수 있다

prefix = 의사결정의 결과 단위. **차원이 교차하는 모든 것**이 prefix다.

### 페이지도 prefix다

```
page prefix: page × locale × userType

page:     ["home", "product", "cart", "checkout", "mypage", "admin"]
locale:   ["ko", "en", "ja"]
userType: ["guest", "member", "premium"]

capacity: 32 × 16 × 16 = 8,192 조합
실제 entries: 6 × 3 × 3 = 54 조합

이 prefix는 "어떤 페이지를, 어떤 언어로, 어떤 사용자가 보는가"의 모든 경우의 수.
주소 42 = { page: "checkout", locale: "ko", userType: "premium" }
```

### API(endpoint)도 prefix다

```
endpoint prefix: method × path × version

method:  ["GET", "POST", "PUT", "DELETE", "PATCH"]
path:    ["users", "orders", "products", "auth", "payments"]
version: ["v1", "v2"]

capacity: 32 × 32 × 16 = 16,384 조합
실제 entries: 5 × 5 × 2 = 50 조합

이 prefix는 "어떤 메서드로, 어떤 경로를, 어떤 버전으로 호출하는가"의 모든 경우의 수.
주소 17 = { method: "POST", path: "orders", version: "v2" }
```

### 이벤트도 prefix다

```
event prefix: event_name × initiator

이미 DEMO_CATALOG에 있다.
주소 = "어떤 이벤트가, 어떤 채널에서 발생했는가"
```

### 권한도 prefix다

```
permission prefix: service_ref × role

이미 DEMO_CATALOG에 있다.
주소 = "어떤 서비스에서, 어떤 역할이 가진 권한"
```

**패턴: 의사결정이 필요한 교차점이면 prefix. 페이지든 API든 이벤트든 권한이든.**

---

## prefix 단위 정리

| 카테고리 | prefix | 차원 | 의사결정 |
|---|---|---|---|
| entity | `service` | env × region × svc_name × namespace | "어떤 서비스를 식별하는가" |
| entity | `event` | evt_svc(ref) × event_name × initiator | "어떤 이벤트를 추적하는가" |
| entity | `content` | tag × category × status × locale × channel | "어떤 콘텐츠를 분류하는가" |
| entity | `tracking` | trackAction × page × userType | "어떤 행동을 분석하는가" |
| policy | `permission` | perm_svc(ref) × role | "어떤 권한을 관리하는가" |
| policy | `rbac` | role × action × resource | "어떤 접근 제어를 정의하는가" |
| relation | `relational` | subjectKind × predicate × objectKind | "어떤 관계를 모델링하는가" |
| observation | `page_view` | svc_ref(ref) × page × locale × userType | "어떤 화면을 관측하는가" |
| observation | `endpoint` | svc_ref(ref) × resource_type × http_method × api_version | "어떤 API를 관측하는가" |
| observation | `flow_point` | svc_ref(ref) × flow_name × flow_step × flow_variant | "비즈니스 흐름 어디를 관측하는가" |
| observation | `pipeline_point` | svc_ref(ref) × pipeline_phase × validation_mode × verdict_result × temporal_strategy | "파이프라인 어디를 관측하는가" |
| observation | `data_policy` | svc_ref(ref) × mask_mode | "어떤 마스킹 정책을 관측하는가" |
| event | `engine_event` | svc_ref(ref) × constraint_op × verdict_result | "엔진 평가 이벤트" |
| event | `schema_event` | svc_ref(ref) × migration_pattern × deploy_action | "스키마 마이그레이션 이벤트" |
| event | `deploy_event` | svc_ref(ref) × deploy_action × actor(table) | "배포 이벤트" |
| event | `health_event` | svc_ref(ref) × health_status | "헬스 이벤트" |
| event | `cart_event` | actor(table) × cart_action × target(table) | "장바구니 이벤트" |
| event | `auth_event` | actor(table) × auth_action | "인증 이벤트" |
| event | `order_event` | service_ctx(ref) × actor(table) × order_action × order(table) | "주문 이벤트" |

**각각이 의사결정의 결과. 각각이 DSL. 각각이 경우의 수의 단위.**

환경(env, region)은 SDK가 주입하여 개발자가 직접 다루지 않는다. 개발자는 비즈니스 차원(role, action, page)만 다룬다.
