---
def:
  id: dimension-operations
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
---

# 차원 운영 — 축 교차, 환경 주입, 배포 시점 해석

## 목적 ^purpose

여러 축을 교차시켜 특정 값을 선택하고, 환경(env)을 도구 사이에 주입하고, 배포 시점에 결정되는 차원을 지원하는 런타임 차원 운영 도구 가이드.

기반 문서: [foundation.md](foundation.md) · [patterns.md](patterns.md)
관련 스펙: [permission-engine/core.spec.md](permission-engine/core.spec.md) · [permission-engine/resource.spec.md](permission-engine/resource.spec.md) · [weighted-index/partial-binder.spec.md](weighted-index/partial-binder.spec.md)

---

## 1. 전체 그림

세 가지 운영 시나리오가 서로 다른 패키지에 분산되어 있지만, 하나의 좌표 시스템 위에서 조합된다.

```
                   빌드 시점                 배포 시점 (K8s)           런타임 (요청)
                   ─────────                ──────────────           ──────────────
    차원 고정:     namespace, name           env, region              resource, action
    도구:         createBinder()            .bind({env,region})      .resolveId({...})
                      │                         │                         │
                      ▼                         ▼                         ▼
                  PartialBinder ──────────→ PartialBinder ──────────→ 1D address
                  (weighted-index)                                        │
                                                                ┌────────┼────────┐
                                                                ▼        ▼        ▼
                                                          ScopedEngine  BitMaskSet  PermCodeFactory
                                                          (스코프 격리) (축 필터)    (코드 생성)
                                                          (permission-engine)  (bit-index)
```

| 시나리오 | 질문 | 도구 | 패키지 |
|---|---|---|---|
| **축 교차 선택** | "role=admin AND region=asia인 것만 골라줘" | BitMaskSet, ScopedEngine | bit-index, permission-engine |
| **환경 주입** | "모든 도구가 env=prod를 자동으로 알게 해줘" | ServiceRef, PermCodeFactory | permission-engine |
| **배포 시점 해석** | "K8s에서 region이 정해질 때 주소가 결정되게 해줘" | PartialBinder | weighted-index |

---

## 2. 축 교차 선택

여러 축의 값을 동시에 지정하여 해당하는 주소만 골라내는 연산. 3개 레이어가 추상화 수준별로 제공된다.

### 2.1 BitIndex — O(1) 단일 축 추출

소스: `packages/bit-index/src/bit-index.ts`

패킹된 정수에서 특정 차원의 값을 shift+mask로 즉시 추출한다.

```ts
import { BitIndex } from "bit-index";

const bi = BitIndex.fromShape([32, 32, 32, 32]); // env × region × svc × ns

const packed = bi.pack([2, 0, 3, 1]);
bi.extractDim(packed, 0);              // → 2 (env)
bi.extractDimByLabel(packed, "region"); // → 0
bi.extractDims(packed, [0, 2]);        // → [2, 3] (env, svc)
```

특징:
- WeightedIndex의 `decode`가 O(d) 나눗셈인 반면, BitIndex는 O(1) shift+mask
- 단일 차원만 필요할 때 전체 decode 없이 추출 가능

### 2.2 BitMaskSet — 다축 AND 필터

소스: `packages/bit-index/src/bit-mask-set.ts`

grant된 주소 집합에서 여러 축 조건을 동시에 만족하는 것만 필터링한다.

```ts
import { BitMaskSet } from "bit-index";

// PermissionSet이나 PermissionView에서 변환된 BitMaskSet
const perms: BitMaskSet = codec.toBitMaskSet(mask);

// 단일 축 필터
perms.filterByLabel("role", 2);          // role=2인 모든 권한

// 다축 AND 필터 — "role=admin AND action=read"
perms.filterByLabels({ role: 0, action: 0 });

// 특정 축의 고유값 목록
perms.distinctByLabel("region");         // → [0, 1] (asia, usa)
```

핵심 API:

| API | 설명 |
|---|---|
| `filterByDim(dimIndex, value)` | 단일 축 = 값 필터 |
| `filterByLabel(label, value)` | 라벨 이름 기반 단일 축 필터 |
| `filterByLabels(conditions)` | 여러 축 동시 AND 필터 |
| `distinctDim(dimIndex)` | grant된 주소에서 해당 축의 고유값 목록 |
| `distinctByLabel(label)` | 라벨 이름 기반 고유값 |

### 2.3 ScopedEngine — 스코프 교차/합집합

소스: `packages/permission-engine/src/scoped-engine.ts`

외부 차원(env, region, device 등)별로 독립 PermissionSet을 유지하고, 여러 스코프를 교차하거나 합친다.

```ts
import { ScopedEngine } from "permission-engine";

const engine = new ScopedEngine(features, roles);

// 스코프별 독립 권한 부여
engine.scope("prod:asia").grant("orders", "admin");
engine.scope("prod:usa").grant("orders", "admin");
engine.scope("dev:asia").grant("orders", "developer");

// 교집합 — "prod:asia AND prod:usa 양쪽 다 있는 권한은?"
const shared = engine.intersectScopes(["prod:asia", "prod:usa"]);
shared.has("orders", "admin");   // → true

// 합집합 — "prod의 어느 리전이든 가진 권한은?"
const any = engine.unionScopes(["prod:asia", "prod:usa"]);
```

교집합/합집합 규칙:

| API | 없는 scope 처리 | 빈 입력 |
|---|---|---|
| `unionScopes(keys)` | 무시 | 전체 deny |
| `intersectScopes(keys)` | 결과 = 전체 deny (보수적) | 전체 deny |

### 2.4 PermissionSet.queryGranted — 좌표 제약 기반 질의

소스: `packages/permission-engine/src/permission-set.ts`

weighted-index의 `CoordConstraint` 문법으로 범위 조건을 걸고, grant된 주소만 반환한다.

```ts
const ps = new PermissionSet({ features, roles });
ps.grant("orders", "admin");
ps.grant("orders", "developer");

// feature=orders, role=전체 → grant된 주소만
ps.queryGranted(["2", null]);  // "2"는 orders의 ordinal

// 범위 조합: feature 1~3, role 1 또는 3
ps.queryGranted(["1-3", "1,3"]);
```

### 2.5 선택 기준

| 상황 | 도구 |
|---|---|
| 패킹된 값에서 특정 축 하나만 빠르게 추출 | `BitIndex.extractDim()` |
| grant 집합에서 여러 축 AND 조건으로 필터 | `BitMaskSet.filterByLabels()` |
| env/region 같은 외부 차원별로 독립 관리 후 교차 | `ScopedEngine.intersectScopes()` |
| 좌표 범위 패턴("role 1~3")으로 grant 조회 | `PermissionSet.queryGranted()` |
| 반복 필터 (같은 mask, 다른 조건 여러 번) | `PermissionView.filter()` (4~6x 빠름) |

---

## 3. 환경 주입

앱 초기화 시 환경(env), 리전(region) 등을 한 번 설정하면, 이후 모든 인코딩/디코딩/권한 코드 생성에 자동으로 반영되는 패턴.

### 3.1 ServiceRef — 배포 컨텍스트 캡슐화

소스: `packages/permission-engine/src/service-ref.ts`

서비스를 `(namespace, name)` 쌍으로 식별하고, 배포 컨텍스트 `(env, build, region)`를 분리한다.

```ts
import { createServiceContext } from "permission-engine";

// 앱 부트 시 1회
const ctx = createServiceContext({
  namespace: "shop",
  name: "payment",
  env: "prod",       // ← 환경 주입
  region: "asia",    // ← K8s node label 등에서
  build: "v2.3.1",   // ← CI/CD에서
});

// 사용 시점
ctx.ref();     // → "shop/payment"               (env 제외 — 코드간 전달)
ctx.refFull(); // → "shop/payment@prod.asia.v2.3.1" (env 포함 — 디버그/로그)
```

설계 원칙:
- `ref()`는 환경 정보를 숨긴다 — permission code, DB 키 등에는 환경이 들어가지 않는다
- `refFull()`은 디버그/로그/트레이스에서만 사용한다
- context는 한 번 설정하면 불변이다 (앱 수명 동안 유지)

### 3.2 PermCodeFactory — 서비스 컨텍스트 자동 주입

소스: `packages/permission-engine/src/permission-code.ts`

ServiceContext를 바인딩한 factory를 만들면, 매 호출마다 service ref를 반복하지 않아도 된다.

```ts
import { createPermCodeFactory } from "permission-engine";

const factory = createPermCodeFactory(ctx);

// 호출부에서는 type, resource, action만 전달
factory("api", "admin/teams", "GET");
// → "shop/payment.api.admin/teams.GET"

factory("page", "dashboard", "view");
// → "shop/payment.page.dashboard.view"
```

비교:

| 방식 | 호출 코드 | 반복 정보 |
|---|---|---|
| 직접 조립 | `"shop/payment.api.admin/teams.GET"` | 매번 service ref 반복 |
| factory | `factory("api", "admin/teams", "GET")` | service ref 자동 주입 |

### 3.3 ScopedEngine — 환경별 격리

ServiceRef가 "이 앱은 어디서 돌고 있는가"를 정의한다면, ScopedEngine은 "환경별로 다른 권한을 관리"한다.

```ts
// scope key = 환경 컨텍스트의 canonical 문자열
engine.scope("prod:asia").grant("orders", "admin");
engine.scope("dev:asia").grant("orders", "developer");

// 현재 환경에 맞는 scope 선택
const currentScope = `${ctx.env}:${ctx.region}`;
const perms = engine.scope(currentScope);
perms.has("orders", "admin");  // prod:asia → true
```

### 3.4 통합 흐름 — 환경이 전파되는 경로

```
앱 부트
  │
  ├─ createServiceContext({ env: "prod", region: "asia" })
  │     │
  │     ├─→ createPermCodeFactory(ctx)
  │     │     └─ factory("api", "orders", "GET")  → "shop/payment.api.orders.GET"
  │     │
  │     ├─→ createBinder(codec, "full", { namespace: "shop", name: "payment", env: "prod" })
  │     │     └─ binder.resolveId({ region: "asia", resource: "orders", action: "GET" })
  │     │
  │     └─→ engine.scope("prod:asia")
  │           └─ .grant("orders", "admin")
  │
  └─ 이후 모든 호출에서 env/region을 반복하지 않음
```

---

## 4. 배포 시점 차원 해석

PartialBinder는 차원을 **여러 시점에 걸쳐 점진적으로 고정**하는 curried encoder다. 빌드/배포/런타임 각 단계에서 알게 되는 차원만 바인딩하면, 최종 시점에 나머지만 전달하여 주소를 계산한다.

소스: `packages/weighted-index/src/vocab/partial-binder.ts`
상세 스펙: [weighted-index/partial-binder.spec.md](weighted-index/partial-binder.spec.md)

### 4.1 수학적 원리

mixed-radix 주소에서 각 차원의 기여분은 독립적이다:

```
address = Σ (coord[i] - 1) × stride[i]
        = fixedBase + freeBase
          ─────────   ────────
          캐시 가능    런타임 계산
```

이 분리 가능성 덕분에 고정 차원의 base를 미리 계산해 두고, 런타임에는 자유 차원의 delta만 더하면 전체 encode와 동일한 결과를 얻는다.

### 4.2 3단계 바인딩 — 빌드/배포/런타임

```ts
import { createBinder } from "weighted-index";

// ── Stage 1: 빌드 시점 (코드에 고정) ────────────────────
const step1 = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
});
// step1.free → ["env", "device", "region", "shard", "resource", "action"]

// ── Stage 2: 배포 시점 (K8s manifest / env var) ─────────
// Pod 시작 시 환경 변수에서 읽어 바인딩
const step2 = step1.bind({
  env: process.env.DEPLOY_ENV!,      // K8s namespace → "prod"
  region: process.env.DEPLOY_REGION!, // K8s node label → "asia"
});
// step2.free → ["device", "shard", "resource", "action"]

// ── Stage 3: 런타임 (HTTP 요청) ─────────────────────────
// 요청 헤더/경로에서 나머지 차원 결정
app.use((req, res) => {
  const addr = step2.resolveId({
    device: req.headers["x-device-type"],
    shard: req.headers["x-shard-id"],
    resource: req.path.split("/")[1],
    action: req.method,
  });
  // addr: 전체 차원이 모두 반영된 1D 정수 주소
});
```

### 4.3 Kubernetes 배포 시나리오

```yaml
# K8s Deployment manifest
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: payment-service
          env:
            - name: DEPLOY_ENV
              value: "prod"
            - name: DEPLOY_REGION
              valueFrom:
                fieldRef:
                  fieldPath: metadata.labels['topology.kubernetes.io/region']
```

```ts
// app bootstrap (Pod 시작 시 1회)
const binder = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
}).bind({
  env: process.env.DEPLOY_ENV!,
  region: process.env.DEPLOY_REGION!,
});

// 이후 모든 요청에서 binder 재사용
// env, region은 Pod 수명 동안 불변 → 캐시된 fixedBase 재사용
```

### 4.4 체이닝 vs 일괄 바인딩

| 패턴 | 코드 | 적합한 경우 |
|---|---|---|
| 일괄 | `createBinder(codec, "full", { ns, name, env, region })` | 모든 고정값을 한 시점에 알 때 |
| 체이닝 | `createBinder(...).bind({env}).bind({region})` | 시점이 다를 때 (빌드→배포→런타임) |

두 방식 모두 결과는 동일하다. 체이닝은 각 단계의 `free` 목록이 줄어드는 것을 코드로 표현할 수 있어 가독성이 좋다.

### 4.5 멀티서비스 — 같은 codec, 다른 binder

하나의 codec을 공유하면서 서비스별로 다른 binder를 만든다.

```ts
const paymentBinder = createBinder(codec, "full", {
  namespace: "shop", name: "payment", env: "prod", region: "asia",
});

const authBinder = createBinder(codec, "full", {
  namespace: "shop", name: "auth", env: "prod", region: "asia",
});

// 같은 remaining이라도 서비스가 다르면 다른 주소
const remaining = { device: "web", shard: "s0", resource: "users", action: "GET" };
paymentBinder.resolveId(remaining);  // → 주소 A
authBinder.resolveId(remaining);     // → 주소 B (A ≠ B)
```

### 4.6 version 핀

배포 시점에 prefix version도 고정할 수 있다. 롤링 배포에서 구버전과 신버전이 공존할 때 유용하다.

```ts
// v1 고정 — 이 Pod는 v1 주소 공간에서만 동작
const v1Binder = createBinder(codec, "full", { namespace: "shop", name: "payment" }, "v1");

// v2 고정 — 카나리 Pod는 v2 주소 공간
const v2Binder = createBinder(codec, "full", { namespace: "shop", name: "payment" }, "v2");
```

---

## 5. 조합 패턴

세 도구를 조합하는 실전 패턴.

### 5.1 "이 환경에서 admin이 가진 권한 목록"

```ts
// 1. 환경 선택 (ScopedEngine)
const perms = engine.scope("prod:asia");

// 2. 축 교차 필터 (BitMaskSet)
const view = codec.createView(perms.toBytes());
const adminPerms = view.filter({ role: "admin" });
// → admin이 prod:asia에서 가진 모든 feature 목록
```

### 5.2 "배포 환경에 맞는 권한 코드 생성"

```ts
// 1. 배포 컨텍스트 설정 (ServiceRef)
const ctx = createServiceContext({
  namespace: "shop", name: "payment", env: "prod", region: "asia",
});

// 2. 권한 코드 factory (PermCodeFactory)
const factory = createPermCodeFactory(ctx);

// 3. 주소 인코딩 (PartialBinder)
const binder = createBinder(codec, "full", {
  namespace: "shop", name: "payment", env: "prod",
}).bind({ region: "asia" });

// factory와 binder가 같은 환경 컨텍스트를 공유
const code = factory("api", "orders", "GET");        // text 식별자
const addr = binder.resolveId({ resource: "orders", action: "GET", ... }); // 1D 주소
```

### 5.3 "여러 리전에서 공통으로 가진 권한"

```ts
// ScopedEngine 교집합
const shared = engine.intersectScopes(["prod:asia", "prod:usa", "prod:eu"]);

// 공통 권한 중 api 관련만 필터
const view = codec.createView(shared.toBytes());
const apiPerms = view.filter({ type: "api" });
```

---

## 6. 도구별 소스 위치

| 도구 | 소스 | 패키지 |
|---|---|---|
| `BitIndex.extractDim()` | `packages/bit-index/src/bit-index.ts` | bit-index |
| `BitMaskSet.filterByLabels()` | `packages/bit-index/src/bit-mask-set.ts` | bit-index |
| `IndexBridge` | `packages/bit-index/src/bridge.ts` | bit-index |
| `PermissionSet` | `packages/permission-engine/src/permission-set.ts` | permission-engine |
| `ScopedEngine` | `packages/permission-engine/src/scoped-engine.ts` | permission-engine |
| `ServiceRef` / `createServiceContext()` | `packages/permission-engine/src/service-ref.ts` | permission-engine |
| `createPermCodeFactory()` | `packages/permission-engine/src/permission-code.ts` | permission-engine |
| `PermissionCodec` / `PermissionView` | `packages/permission-engine/src/permission-codec.ts` | permission-engine |
| `createBinder()` / `PartialBinder` | `packages/weighted-index/src/vocab/partial-binder.ts` | weighted-index |

---

## 6. 인프라 계측 — 관측 prefix의 서비스 컨텍스트

모든 관측 포인트 prefix는 `svc_ref(→service)` 차원을 통해 "어떤 서비스에서 발생했는가"를 추적한다.

### 6.1 관측 prefix — 서비스 컨텍스트 포함

| 관측 prefix | 차원 | 용도 |
|---|---|---|
| `page_view` | **svc_ref** × page × locale × userType | 어떤 서비스에서 어떤 화면을 보는가 |
| `endpoint` | **svc_ref** × resource_type × http_method × api_version | 어떤 서비스의 어떤 엔드포인트에 접근하는가 |
| `flow_point` | **svc_ref** × flow_name × flow_step × flow_variant | 어떤 서비스에서 흐름의 어디에 있는가 |

모든 관측 prefix가 `svc_ref → service`를 공유하므로, service 차원으로 필터하면 전 관측 포인트를 서비스 단위로 잘라볼 수 있다.

### 6.2 인프라 이벤트 prefix

| prefix | 차원 | 용도 |
|---|---|---|
| `deploy_event` | **svc_ref** × deploy_action × actor(table_ref) | 누가 어떤 서비스를 배포/롤백했는가 |
| `health_event` | **svc_ref** × health_status | 어떤 서비스가 어떤 상태가 되었는가 |

```ts
// deploy_event: 배포 파이프라인에서 기록
{ event_type: "deploy_event", address: addr, refs: { actor: 42 }, timestamp }
// decode(addr) → { svc_ref: {env:"prod", svc:"payment"}, deploy_action: "canary_start" }

// health_event: 헬스체크 시스템에서 기록
{ event_type: "health_event", address: addr, timestamp }
// decode(addr) → { svc_ref: {env:"prod", svc:"payment"}, health_status: "degraded" }
```

인프라 이벤트의 `svc_ref`는 `INFRA_SVC_MEANING`에서 파생되며, dev/stage/prod 전 환경을 포함한다 (배포는 환경 전체에서 발생하므로).

### 6.3 인프라 → 비즈니스 영향 추적

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

## 7. 도구별 소스 위치

| 도구 | 소스 | 패키지 |
|---|---|---|
| `BitIndex.extractDim()` | `packages/bit-index/src/bit-index.ts` | bit-index |
| `BitMaskSet.filterByLabels()` | `packages/bit-index/src/bit-mask-set.ts` | bit-index |
| `IndexBridge` | `packages/bit-index/src/bridge.ts` | bit-index |
| `PermissionSet` | `packages/permission-engine/src/permission-set.ts` | permission-engine |
| `ScopedEngine` | `packages/permission-engine/src/scoped-engine.ts` | permission-engine |
| `ServiceRef` / `createServiceContext()` | `packages/permission-engine/src/service-ref.ts` | permission-engine |
| `createPermCodeFactory()` | `packages/permission-engine/src/permission-code.ts` | permission-engine |
| `PermissionCodec` / `PermissionView` | `packages/permission-engine/src/permission-codec.ts` | permission-engine |
| `createBinder()` / `PartialBinder` | `packages/weighted-index/src/vocab/partial-binder.ts` | weighted-index |

## 참조

- [permission-engine/core.spec.md](permission-engine/core.spec.md) — PermissionSet, TernaryMask, ScopedEngine 상세
- [permission-engine/resource.spec.md](permission-engine/resource.spec.md) — ServiceRef, PermCodeFactory, resource 규칙
- [weighted-index/partial-binder.spec.md](weighted-index/partial-binder.spec.md) — PartialBinder 상세, PrefixCodec 연동
- [patterns.md](patterns.md) — EntityId 기반 이동, cross-index 참조
- [coordinate-query.spec.md](coordinate-query.spec.md) — 좌표 질의 (lattice, policy, cross-index)
