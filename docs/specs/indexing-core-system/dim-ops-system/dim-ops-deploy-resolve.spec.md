---
def:
  tier: component
  id: dim-ops-deploy-resolve
  address: def_document:v2:68761
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, structural, observability]
  links:
    - target: partial-binder-spec
      type: depends_on
    - target: table-dimref-types
      type: depends_on
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

# 배포 시점 차원 해석

## 목적 ^purpose

배포 시점에 차원 값을 해석하여 concrete 좌표를 생성하는 연산.

PartialBinder는 차원을 **여러 시점에 걸쳐 점진적으로 고정**하는 curried encoder다. 빌드/배포/런타임 각 단계에서 알게 되는 차원만 바인딩하면, 최종 시점에 나머지만 전달하여 주소를 계산한다.

소스: `packages/weighted-index/src/vocab/partial-binder.ts`
상세 스펙: [weighted-index/partial-binder.spec.md](../../weighted-index-system/partial-binder.spec.md)

## 구성 ^overview

- **수학적 원리**: mixed-radix 주소에서 고정 차원의 fixedBase를 캐시하고, 런타임에는 자유 차원의 delta만 더하여 전체 encode와 동일한 결과 도출
- **3단계 바인딩**: 빌드 시점(코드 고정) → 배포 시점(K8s env var) → 런타임(HTTP 요청)으로 차원을 점진적으로 고정
- **K8s 통합**: Pod 시작 시 DEPLOY_ENV, DEPLOY_REGION 등 환경 변수로 배포 차원을 바인딩하고, 이후 모든 요청에서 binder 재사용
- **체이닝 vs 일괄**: 모든 고정값을 한 시점에 알면 일괄 바인딩, 시점이 다르면 `.bind()` 체이닝 — 결과는 동일
- **멀티서비스**: 하나의 codec을 공유하면서 서비스별로 다른 binder를 생성하여 서로 다른 주소 공간 확보
- **version 핀**: 배포 시점에 prefix version을 고정하여 롤링 배포에서 구버전과 신버전이 공존 가능

---

## 1. 수학적 원리

mixed-radix 주소에서 각 차원의 기여분은 독립적이다:

```
address = Σ (coord[i] - 1) × stride[i]
        = fixedBase + freeBase
          ─────────   ────────
          캐시 가능    런타임 계산
```

이 분리 가능성 덕분에 고정 차원의 base를 미리 계산해 두고, 런타임에는 자유 차원의 delta만 더하면 전체 encode와 동일한 결과를 얻는다.

---

## 2. 3단계 바인딩 — 빌드/배포/런타임

```ts
import { createBinder } from "weighted-index";

// -- Stage 1: 빌드 시점 (코드에 고정) ────────────────────
const step1 = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
});
// step1.free -> ["env", "device", "region", "shard", "resource", "action"]

// -- Stage 2: 배포 시점 (K8s manifest / env var) ─────────
// Pod 시작 시 환경 변수에서 읽어 바인딩
const step2 = step1.bind({
  env: process.env.DEPLOY_ENV!,      // K8s namespace -> "prod"
  region: process.env.DEPLOY_REGION!, // K8s node label -> "asia"
});
// step2.free -> ["device", "shard", "resource", "action"]

// -- Stage 3: 런타임 (HTTP 요청) ─────────────────────────
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

---

## 3. Kubernetes 배포 시나리오

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
// env, region은 Pod 수명 동안 불변 -> 캐시된 fixedBase 재사용
```

---

## 4. 체이닝 vs 일괄 바인딩

| 패턴 | 코드 | 적합한 경우 |
|---|---|---|
| 일괄 | `createBinder(codec, "full", { ns, name, env, region })` | 모든 고정값을 한 시점에 알 때 |
| 체이닝 | `createBinder(...).bind({env}).bind({region})` | 시점이 다를 때 (빌드->배포->런타임) |

두 방식 모두 결과는 동일하다. 체이닝은 각 단계의 `free` 목록이 줄어드는 것을 코드로 표현할 수 있어 가독성이 좋다.

---

## 5. 멀티서비스 — 같은 codec, 다른 binder

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
paymentBinder.resolveId(remaining);  // -> 주소 A
authBinder.resolveId(remaining);     // -> 주소 B (A != B)
```

---

## 6. version 핀

배포 시점에 prefix version도 고정할 수 있다. 롤링 배포에서 구버전과 신버전이 공존할 때 유용하다.

```ts
// v1 고정 — 이 Pod는 v1 주소 공간에서만 동작
const v1Binder = createBinder(codec, "full", { namespace: "shop", name: "payment" }, "v1");

// v2 고정 — 카나리 Pod는 v2 주소 공간
const v2Binder = createBinder(codec, "full", { namespace: "shop", name: "payment" }, "v2");
```
