---
def:
  tier: component
  id: partial-binder-patterns
  scope: flow
  aspect: user_scenario
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, observability]
  links:
    - target: partial-binder-spec
      type: refines
---

# PartialBinder 연동 및 사용 패턴

## 목적 ^purpose

PrefixCodec/LabelRegistry와의 연동 방식, SDK 컨텍스트 고정, 멀티서비스, prefix별 독립 binder 사용 패턴을 정의한다.

## 구성 ^overview

### PrefixCodec / LabelRegistry 연동

`PartialBinder`는 raw ordinal 좌표를 직접 받지 않는다. 입력은 모두 `EntityId` 기반 라벨 값이다.

```ts
createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});
```

내부 단계:

1. 라벨 이름(`namespace`, `name`, `env` ...)으로 각 차원을 찾는다.
2. `PrefixCodec.encodeFromIds()`가 `LabelRegistry`를 통해 entity ID를 1-based 인덱스로 바꾼다.
3. 그 1-based 좌표들을 weighted-index mixed-radix 공식으로 인코딩한다.

동일성 보장:

```ts
binder.resolve(remaining)
===
codec.encodeFromIds(prefix, { ...bound, ...remaining }, version)
```

### SDK 컨텍스트 고정 패턴

부트 시점에 서비스 컨텍스트를 고정하고, 런타임에는 나머지만 받는다.

```ts
const sdk = createBinder(codec, "full", {
  namespace: "shop", name: "payment", env: "prod", device: "web",
});
const address = sdk.resolveId({
  region: "asia", shard: "s2", resource: "orders", action: "GET",
});
```

### 멀티서비스 패턴

같은 `codec`를 공유하더라도 서로 다른 binder는 독립된 address space view를 만든다.

```ts
const paymentSDK = createBinder(codec, "full", { namespace: "shop", name: "payment", env: "prod", device: "web" });
const authSDK    = createBinder(codec, "full", { namespace: "shop", name: "auth",    env: "prod", device: "web" });
```

같은 `remaining`을 넣더라도 `name`이 다르면 다른 주소가 나온다.

### prefix별 독립 binder

`PartialBinder`는 `full` prefix 전용이 아니다.

```ts
const svcBinder  = createBinder(codec, "svc",  { namespace: "shop" });
const permBinder = createBinder(codec, "perm", { resource: "orders" });
```

각 binder는 자신이 속한 prefix의 라벨 순서와 version에 따라 독립적으로 동작한다.
