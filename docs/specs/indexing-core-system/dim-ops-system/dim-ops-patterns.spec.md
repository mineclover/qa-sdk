---
def:
  tier: component
  id: dim-ops-patterns
  type: spec
  address: def_document:v2:136321
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, observability, structural]
  links:
    - target: dim-ops-cross-select
      type: traces_to
    - target: dim-ops-env-inject
      type: traces_to
    - target: dim-ops-deploy-resolve
      type: traces_to
sources:
  - packages/bit-index/src/index.ts
  - packages/bit-index/src/bit-index.ts
  - packages/bit-index/src/bit-index.test.ts
  - packages/bit-index/src/bit-mask-set.ts
  - packages/bit-index/src/bit-mask-set.test.ts
  - packages/bit-index/src/bridge.ts
  - packages/bit-index/src/bridge.test.ts
  - packages/permission-engine/src/permission-set.ts
  - packages/permission-engine/src/permission-set.test.ts
  - packages/permission-engine/src/scoped-engine.ts
  - packages/permission-engine/src/scoped-engine.test.ts
  - packages/permission-engine/src/service-ref.ts
  - packages/permission-engine/src/permission-code.ts
  - packages/permission-engine/src/permission-codec.ts
  - packages/permission-engine/src/permission-codec.test.ts
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts

---

# 차원 조합 패턴

## 목적 ^purpose

PartialBinder, FixedDims, ServiceBinder 등 차원 조합의 실용 패턴.

세 도구(축 교차 선택, 환경 주입, 배포 시점 해석)를 조합하는 실전 패턴.

## 구성 ^overview

- **환경 권한 조회**: ScopedEngine으로 환경 선택 후 BitMaskSet 축 교차 필터로 특정 역할의 권한 목록 추출
- **배포 권한 코드 생성**: ServiceRef 배포 컨텍스트 + PermCodeFactory + PartialBinder를 조합하여 환경별 권한 코드와 1D 주소를 동시 생성
- **리전 교집합**: ScopedEngine.intersectScopes로 다수 리전 공통 권한을 구한 뒤 축 필터 적용
- **세 도구 조합**: 축 교차 선택(dim-ops-cross-select), 환경 주입(dim-ops-env-inject), 배포 시점 해석(dim-ops-deploy-resolve)의 실전 결합
- **PartialBinder 역할**: 네임스페이스/서비스/환경 차원을 부분 바인딩하여 나머지 차원만으로 주소 해석 가능
- **컨텍스트 공유**: factory(텍스트 식별자)와 binder(정수 주소)가 동일한 환경 컨텍스트를 공유하여 일관성 보장

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
