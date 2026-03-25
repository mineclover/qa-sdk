---
def:
  id: dim-ops-patterns
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: dim-ops-cross-select
      type: refines
    - target: dim-ops-env-inject
      type: refines
    - target: dim-ops-deploy-resolve
      type: refines
---

# 차원 조합 패턴

## 목적 ^purpose

PartialBinder, FixedDims, ServiceBinder 등 차원 조합의 실용 패턴.

세 도구(축 교차 선택, 환경 주입, 배포 시점 해석)를 조합하는 실전 패턴.

---

## 1. "이 환경에서 admin이 가진 권한 목록"

```ts
// 1. 환경 선택 (ScopedEngine)
const perms = engine.scope("prod:asia");

// 2. 축 교차 필터 (BitMaskSet)
const view = codec.createView(perms.toBytes());
const adminPerms = view.filter({ role: "admin" });
// -> admin이 prod:asia에서 가진 모든 feature 목록
```

---

## 2. "배포 환경에 맞는 권한 코드 생성"

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

---

## 3. "여러 리전에서 공통으로 가진 권한"

```ts
// ScopedEngine 교집합
const shared = engine.intersectScopes(["prod:asia", "prod:usa", "prod:eu"]);

// 공통 권한 중 api 관련만 필터
const view = codec.createView(shared.toBytes());
const apiPerms = view.filter({ type: "api" });
```
