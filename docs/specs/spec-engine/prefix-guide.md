---
def:
  id: prefix-guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: convergence-layer-spec
      type: refines
---

# Prefix 실용 가이드 — 페이지, API, 환경, 관측 포인트

## 목적 ^purpose

**Status: DESIGN**

prefix가 실제로 무엇을 표현하는지,
환경 변수로 어떻게 오버라이드하는지,
비즈니스 로직의 관측 포인트를 어떻게 정의하는지.



## 참조

기반: [decision-standard.md](decision-standard.md) · [README.md](README.md)

## 구성 ^overview

- `prefix는 무엇이든 될 수 있다`: 페이지, API, 이벤트, 권한처럼 의사결정이 필요한 교차점을 prefix로 모델링하는 기준을 설명한다.
- `환경 구성 — SDK 오버라이드 패턴`: QA_ENV, QA_REGION, QA_SERVICE, QA_NAMESPACE를 SDK 부트 시 주입하는 패턴을 정리한다.
- `비즈니스 로직 관측 포인트`: 흐름의 분기점을 prefix 주소로 정의하고 권한 및 이벤트와 함께 추적하는 방법을 설명한다.
- `환경별 오버라이드 예시`: dev, test, prod 리전별로 같은 코드가 다른 주소를 생성하는 배포 예시를 보여준다.
- `prefix 단위 정리`: entity, policy, relation, observation, event prefix 묶음과 각 의사결정 역할을 표로 정리한다.

---

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

## 환경 구성 — SDK 오버라이드 패턴

### 문제

env, region, service 같은 인프라 차원은 **코드에 하드코딩하지 않는다.** 배포 환경마다 다르다.

```
dev:  env=dev,  region=asia, service=shopping-web
prod: env=prod, region=usa,  service=shopping-web
test: env=test, region=asia, service=shopping-web
```

### 해법: SDK 부트 시 환경 주입

```typescript
// ── SDK 초기화 (앱 시작 시 1회) ──────────────────────

import { createQaContext } from "@qa-sdk/sdk";

const qa = createQaContext({
  // 환경 변수에서 주입 — 배포 환경마다 다름
  env:       process.env.QA_ENV       ?? "dev",
  region:    process.env.QA_REGION    ?? "asia",
  service:   process.env.QA_SERVICE   ?? "shopping-web",
  namespace: process.env.QA_NAMESPACE ?? "shop",
});

// 이 4개 차원은 고정. 이후 모든 encode에 자동 포함.
```

```typescript
// ── 개발자 코드 (비즈니스 로직만 작성) ────────────────

// 권한 체크: 개발자는 role, action만 지정
const addr = qa.encode("permission", { role: "admin", action: "write" });
// 내부적으로: { env: "prod", region: "asia", service: "shopping-web",
//              namespace: "shop", role: "admin", action: "write" }
// → 하지만 개발자는 { role, action }만 알면 된다

// 이벤트 기록: 개발자는 event_name, initiator만 지정
qa.track("event", { event_name: "order.created", initiator: "web" });
// 내부적으로: service 컨텍스트 자동 포함

// 페이지 추적: 개발자는 page, locale만 지정
qa.track("page", { page: "checkout", locale: "ko", userType: "premium" });
```

### 환경 변수 표준

| 환경 변수 | 차원 | 예시 | 설명 |
|---|---|---|---|
| `QA_ENV` | env | dev, stage, prod, test | 배포 환경 |
| `QA_REGION` | region | asia, usa, eu | 서비스 리전 |
| `QA_SERVICE` | svc_name | shopping-web, auth | 서비스 이름 |
| `QA_NAMESPACE` | namespace | shop, cms | 네임스페이스 |
| `QA_BUILD` | (메타) | 2026.03.20.1 | 빌드 식별자 |

### PartialBinder 연동

```typescript
// SDK 내부 구현:
// 환경 변수 → service prefix 고정 → PartialBinder 생성

const serviceBinder = createBinder(codec, "service", {
  env: config.env,
  region: config.region,
  svc_name: config.service,
  namespace: config.namespace,
});
// → free dimensions: 없음 (service 주소 완전 결정)
// → service address: 40 (예: prod/asia/shopping-web/shop)

const permissionBinder = createBinder(codec, "permission", {
  perm_svc: serviceBinder.resolveId({}),  // service 주소를 고정 차원으로
});
// → free dimensions: [role]
// → qa.encode("permission", { role: "admin" }) 로 충분
```

### 테스트 환경

```typescript
// test에서는 env=test, region=asia로 자동 설정
// 같은 코드가 다른 주소를 생성하지만 같은 좌표 체계

// test
const qa = createQaContext({ env: "test", region: "asia", ... });
qa.encode("permission", { role: "admin", action: "write" });
// → permission:v1:TEST_ADDRESS (env=test이므로 다른 주소)

// prod
const qa = createQaContext({ env: "prod", region: "asia", ... });
qa.encode("permission", { role: "admin", action: "write" });
// → permission:v1:PROD_ADDRESS (env=prod이므로 다른 주소)

// 차원은 같다. 주소만 다르다. 분석 시 env 차원으로 필터.
```

---

## 비즈니스 로직 관측 포인트

### 관측 포인트란

비즈니스 로직에서 **경우의 수가 분기하는 지점**. 이 지점에서 어떤 경로로 갔는지를 기록하면 전체 흐름을 추적할 수 있다.

```
결제 흐름의 관측 포인트:

  1. 장바구니 진입     → cart_event: { action: "add", actor: member:42 }
  2. 결제 시도         → order_event: { action: "create", service_ctx: prod/payment }
  3. 결제 결과 분기     → order_event: { action: "complete" } 또는 { action: "cancel" }
  4. 취소 시 환불 분기  → order_event: { action: "refund" }

각 포인트 = prefix 주소 하나 = 추적 가능한 경우의 수
```

### 관측 포인트 정의 패턴

```typescript
// ── 관측 포인트를 명시적으로 정의한다 ────────────────

const CHECKOUT_FLOW = {
  // 진입점
  entry: qa.address("page", { page: "checkout", locale: "ko" }),

  // 분기점들
  branches: {
    paymentAttempt:  qa.address("order_event", { action: "create" }),
    paymentSuccess:  qa.address("order_event", { action: "complete" }),
    paymentFailure:  qa.address("order_event", { action: "cancel" }),
    refundRequested: qa.address("order_event", { action: "refund" }),
  },

  // 이 흐름에서 기대하는 권한
  requiredPermissions: [
    qa.address("permission", { role: "customer", action: "write" }),
  ],
} as const;

// 이 정의 자체가 "결제 흐름의 경우의 수"를 명시적으로 열거한 것.
// 각 주소는 정수 하나. 런타임에 이 정수가 발생하면 관측된 것.
```

### 관측 포인트 등록

```typescript
// ── prefix로 관측 포인트를 관리한다 ─────────────────

// 각 관측 포인트는 prefix 주소이므로
// DKG에서 IntentLink로 연결:

IntentLink: "checkout-flow"
  endpoints: [page, order_event, permission]
  via: service
  intent: "결제 흐름의 진입→분기→권한을 일관적으로 추적"
  invariant: "결제 시작 없이 결제 완료가 관측되면 안 됨"
```

### 관측 포인트 유형

| 유형 | prefix 예시 | 설명 |
|---|---|---|
| **진입점** | `page` prefix | 사용자가 어떤 화면에 진입했는가 |
| **행위** | `tracking` prefix | 사용자가 어떤 행동을 했는가 |
| **이벤트** | `event`, `*_event` prefix | 시스템에서 어떤 이벤트가 발생했는가 |
| **권한** | `permission` prefix | 어떤 권한으로 접근했는가 |
| **API 호출** | `endpoint` prefix | 어떤 API가 호출되었는가 |
| **상태 전이** | 도메인별 prefix | 어떤 상태에서 어떤 상태로 전이했는가 |

**모든 관측 포인트는 prefix 주소다.** 정수 하나로 표현되고, bitmask로 집합 연산 가능하고, 다른 prefix의 차원이 될 수 있다.

---

## 환경별 오버라이드 예시

### 개발 환경 (dev)

```bash
QA_ENV=dev
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
const qa = createQaContext({
  env: process.env.QA_ENV,       // "dev"
  region: process.env.QA_REGION, // "asia"
  ...
});

// 모든 주소가 dev 컨텍스트:
qa.encode("permission", { role: "admin" })
// → service_ctx = dev/asia/shopping-web/shop (고정)
// → 개발자는 role만 지정
```

### 테스트 (test with fixtures)

```bash
QA_ENV=test
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
// 테스트에서는 같은 코드, 같은 인터페이스
// env=test이므로 prod 데이터와 분리
// 같은 { role: "admin" } → 다른 주소 (env 차원이 다르므로)
// 분석 시 env=test 필터로 테스트 데이터만 조회
```

### 프로덕션 (prod, 다중 리전)

```bash
# US 리전
QA_ENV=prod
QA_REGION=usa
QA_SERVICE=shopping-web
QA_NAMESPACE=shop

# Asia 리전
QA_ENV=prod
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
// 두 리전에서 같은 코드 실행
// region 차원으로 자동 분리
// 분석: region별 비교, 또는 region 무시하고 전체 집계
```

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
