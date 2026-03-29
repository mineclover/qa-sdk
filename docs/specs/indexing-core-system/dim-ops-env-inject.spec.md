---
def:
  id: dim-ops-env-inject
  address: def_document:v2:68762
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: []
  links:
    - target: perm-service-ref
      type: depends_on
    - target: perm-permission-code
      type: depends_on
---

# 환경 주입

## 목적 ^purpose

런타임 환경(env, region)을 좌표 차원에 자동 주입하는 연산.

앱 초기화 시 환경(env), 리전(region) 등을 한 번 설정하면, 이후 모든 인코딩/디코딩/권한 코드 생성에 자동으로 반영되는 패턴.

## 구성 ^overview

- **ServiceRef**: 서비스를 `(namespace, name)` 식별자와 `(env, build, region)` 배포 컨텍스트로 분리하여 캡슐화
- **ref() vs refFull()**: `ref()`는 환경 정보를 숨겨 코드 간 전달용, `refFull()`은 디버그/로그/트레이스 전용
- **PermCodeFactory**: ServiceContext를 바인딩하여 매 호출마다 service ref 반복 없이 permission code 생성
- **ScopedEngine**: `env:region` 키로 환경별 권한을 격리 관리
- **통합 흐름**: 앱 부트 시 1회 설정 → PermCodeFactory, Binder, ScopedEngine에 자동 전파 → 이후 env/region 반복 불필요
- **관측 prefix의 svc_ref**: page_view, endpoint, flow_point 등 모든 관측 prefix가 `svc_ref` 차원을 공유하여 서비스 단위 필터링 가능
- **인프라 이벤트**: deploy_event, health_event가 동일 svc_ref를 참조하여 배포→성능 저하→비즈니스 영향을 좌표만으로 교차 추적

---

## 1. ServiceRef — 배포 컨텍스트 캡슐화

소스: `packages/permission-engine/src/service-ref.ts`

서비스를 `(namespace, name)` 쌍으로 식별하고, 배포 컨텍스트 `(env, build, region)`를 분리한다.

```ts
import { createServiceContext } from "permission-engine";

// 앱 부트 시 1회
const ctx = createServiceContext({
  namespace: "shop",
  name: "payment",
  env: "prod",       // <- 환경 주입
  region: "asia",    // <- K8s node label 등에서
  build: "v2.3.1",   // <- CI/CD에서
});

// 사용 시점
ctx.ref();     // -> "shop/payment"               (env 제외 — 코드간 전달)
ctx.refFull(); // -> "shop/payment@prod.asia.v2.3.1" (env 포함 — 디버그/로그)
```

설계 원칙:
- `ref()`는 환경 정보를 숨긴다 — permission code, DB 키 등에는 환경이 들어가지 않는다
- `refFull()`은 디버그/로그/트레이스에서만 사용한다
- context는 한 번 설정하면 불변이다 (앱 수명 동안 유지)

---

## 2. PermCodeFactory — 서비스 컨텍스트 자동 주입

소스: `packages/permission-engine/src/permission-code.ts`

ServiceContext를 바인딩한 factory를 만들면, 매 호출마다 service ref를 반복하지 않아도 된다.

```ts
import { createPermCodeFactory } from "permission-engine";

const factory = createPermCodeFactory(ctx);

// 호출부에서는 type, resource, action만 전달
factory("api", "admin/teams", "GET");
// -> "shop/payment.api.admin/teams.GET"

factory("page", "dashboard", "view");
// -> "shop/payment.page.dashboard.view"
```

비교:

| 방식 | 호출 코드 | 반복 정보 |
|---|---|---|
| 직접 조립 | `"shop/payment.api.admin/teams.GET"` | 매번 service ref 반복 |
| factory | `factory("api", "admin/teams", "GET")` | service ref 자동 주입 |

---

## 3. ScopedEngine — 환경별 격리

ServiceRef가 "이 앱은 어디서 돌고 있는가"를 정의한다면, ScopedEngine은 "환경별로 다른 권한을 관리"한다.

```ts
// scope key = 환경 컨텍스트의 canonical 문자열
engine.scope("prod:asia").grant("orders", "admin");
engine.scope("dev:asia").grant("orders", "developer");

// 현재 환경에 맞는 scope 선택
const currentScope = `${ctx.env}:${ctx.region}`;
const perms = engine.scope(currentScope);
perms.has("orders", "admin");  // prod:asia -> true
```

---

## 4. 통합 흐름 — 환경이 전파되는 경로

```
앱 부트
  │
  ├─ createServiceContext({ env: "prod", region: "asia" })
  │     │
  │     ├──→ createPermCodeFactory(ctx)
  │     │     └─ factory("api", "orders", "GET")  -> "shop/payment.api.orders.GET"
  │     │
  │     ├──→ createBinder(codec, "full", { namespace: "shop", name: "payment", env: "prod" })
  │     │     └─ binder.resolveId({ region: "asia", resource: "orders", action: "GET" })
  │     │
  │     └──→ engine.scope("prod:asia")
  │           └─ .grant("orders", "admin")
  │
  └─ 이후 모든 호출에서 env/region을 반복하지 않음
```

---

## 5. 인프라 계측 — 관측 prefix의 서비스 컨텍스트

모든 관측 포인트 prefix는 `svc_ref(->service)` 차원을 통해 "어떤 서비스에서 발생했는가"를 추적한다.

### 5.1 관측 prefix — 서비스 컨텍스트 포함

| 관측 prefix | 차원 | 용도 |
|---|---|---|
| `page_view` | **svc_ref** x page x locale x userType | 어떤 서비스에서 어떤 화면을 보는가 |
| `endpoint` | **svc_ref** x resource_type x http_method x api_version | 어떤 서비스의 어떤 엔드포인트에 접근하는가 |
| `flow_point` | **svc_ref** x flow_name x flow_step x flow_variant | 어떤 서비스에서 흐름의 어디에 있는가 |

모든 관측 prefix가 `svc_ref -> service`를 공유하므로, service 차원으로 필터하면 전 관측 포인트를 서비스 단위로 잘라볼 수 있다.

### 5.2 인프라 이벤트 prefix

| prefix | 차원 | 용도 |
|---|---|---|
| `deploy_event` | **svc_ref** x deploy_action x actor(table_ref) | 누가 어떤 서비스를 배포/롤백했는가 |
| `health_event` | **svc_ref** x health_status | 어떤 서비스가 어떤 상태가 되었는가 |

```ts
// deploy_event: 배포 파이프라인에서 기록
{ event_type: "deploy_event", address: addr, refs: { actor: 42 }, timestamp }
// decode(addr) -> { svc_ref: {env:"prod", svc:"payment"}, deploy_action: "canary_start" }

// health_event: 헬스체크 시스템에서 기록
{ event_type: "health_event", address: addr, timestamp }
// decode(addr) -> { svc_ref: {env:"prod", svc:"payment"}, health_status: "degraded" }
```

인프라 이벤트의 `svc_ref`는 `INFRA_SVC_MEANING`에서 파생되며, dev/stage/prod 전 환경을 포함한다 (배포는 환경 전체에서 발생하므로).

### 5.3 인프라 -> 비즈니스 영향 추적

인프라 이벤트와 비즈니스 관측이 같은 `service` prefix를 참조하므로, 교차 분석이 가능하다:

```
deploy_event(svc_ref:prod/payment, action:deploy)
  ↓ 같은 svc_ref
health_event(svc_ref:prod/payment, status:degraded)
  ↓ 같은 svc_ref
endpoint(svc_ref:prod/payment, type:api, method:POST) — 응답 시간 증가
  ↓ 같은 svc_ref
flow_point(svc_ref:prod/payment, flow:checkout, step:failure) — 결제 실패 증가
```

"배포 후 결제 서비스가 성능 저하되어 결제 흐름 실패가 증가했다"를 좌표만으로 추적할 수 있다.
