# PartialBinder — 차원 부분 바인딩

## 개요

`createBinder`는 N차원 인코딩에서 **일부 차원을 미리 고정**하고, 나머지만 런타임에 받아 최종 1D 주소를 계산하는 curried encoder이다.

SDK가 앱 부트 시 서비스 컨텍스트(namespace, name, env, device)를 고정하면, API 호출마다 리소스/액션만 전달하면 되므로 호출부 코드가 간결해진다.

## 원리

weighted-index의 mixed-radix 인코딩에서 각 차원의 기여분은 독립적이다:

```
address = Σ (coord[i] - 1) × stride[i]
```

따라서 고정 차원과 자유 차원의 기여분을 **분리 계산 후 합산**하면 전체 `encode`와 동일한 결과를 얻는다.

이것이 `partialQueryBase(weights, fixedCoords)`의 원리이며 (`calc.ts:57`), `PartialBinder`는 이를 라벨 이름 기반 인터페이스로 감싼다.

## 위치

```
packages/weighted-index/src/partial-binder.ts
```

PrefixCodec, LabelRegistry와 동일 패키지에 위치한다. permission-engine에서는 re-export한다.

## API

### `createBinder(codec, prefix, fixed, version?)`

```ts
import { createBinder, PrefixCodec } from "weighted-index";

const binder = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});
// binder.free → ["region", "shard", "resource", "action"]
```

**매개변수:**

| 이름 | 타입 | 설명 |
|------|------|------|
| `codec` | `PrefixCodec` | LabelRegistry + prefix 정의를 담은 코덱 인스턴스 |
| `prefix` | `string` | 대상 prefix 이름 (예: `"full"`, `"svc"`, `"perm"`) |
| `fixed` | `Record<string, EntityId>` | 고정할 라벨 → 엔티티 ID 매핑 |
| `version` | `string?` | prefix 버전. 미지정 시 최신 |

**반환:** `PartialBinder`

### `PartialBinder` 인터페이스

```ts
interface PartialBinder {
  readonly bound: Record<string, EntityId>;  // 고정된 라벨
  readonly free: readonly string[];          // 자유 라벨 목록
  readonly prefix: string;
  readonly version: string;

  resolve(remaining: Record<string, EntityId>): VersionedIndex;
  resolveId(remaining: Record<string, EntityId>): number;
  bind(additional: Record<string, EntityId>): PartialBinder;  // 체이닝
}
```

## 사용 패턴

### 1. SDK 컨텍스트 고정

가장 일반적인 패턴. 앱 부트 시 서비스/환경 정보를 고정하고, 매 요청마다 리소스/액션만 전달한다.

```ts
// ── 앱 부트 (1회) ──
const sdk = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});

// ── 런타임 (매 요청) ──
const addr = sdk.resolveId({
  region: "asia",
  shard: "s2",
  resource: "orders",
  action: "GET",
});
// addr === codec.encodeFromIds("full", { ...고정값, ...런타임값 }).id
```

### 2. 점진적 체이닝

한 번에 모든 고정값을 넣지 않고, 단계별로 바인딩할 수 있다.

```ts
const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
// step1.free → ["env", "device", "region", "shard", "resource", "action"]

const step2 = step1.bind({ env: "prod", device: "web" });
// step2.free → ["region", "shard", "resource", "action"]

const step3 = step2.bind({ region: "asia", shard: "s2" });
// step3.free → ["resource", "action"]

const addr = step3.resolveId({ resource: "config", action: "DELETE" });
```

각 단계에서 `free`가 줄어들고, 최종 `resolve` 시 나머지만 전달하면 된다.

### 3. 멀티서비스 — 같은 codec, 다른 binder

하나의 codec을 공유하면서 서비스별로 다른 binder를 만든다.

```ts
const paymentSDK = createBinder(codec, "full", {
  namespace: "shop", name: "payment", env: "prod", device: "web",
});
const authSDK = createBinder(codec, "full", {
  namespace: "shop", name: "auth", env: "prod", device: "web",
});

const remaining = { region: "asia", shard: "s0", resource: "users", action: "GET" };

paymentSDK.resolveId(remaining);  // → 주소 A
authSDK.resolveId(remaining);     // → 주소 B (A ≠ B, 서비스가 다름)
```

### 4. prefix별 독립 binder

`full` prefix뿐 아니라 하위 prefix(svc, loc, perm)에도 사용 가능하다.

```ts
const svcBinder = createBinder(codec, "svc", { namespace: "shop" });
// svcBinder.free → ["name"]
svcBinder.resolveId({ name: "payment" });

const permBinder = createBinder(codec, "perm", { resource: "orders" });
// permBinder.free → ["action"]
permBinder.resolveId({ action: "POST" });
```

## PrefixCodec과의 관계

| | `PrefixCodec.encodeFromIds` | `createBinder` + `resolve` |
|---|---|---|
| 입력 | 모든 차원을 매번 전달 | 고정 차원은 1회, 나머지만 매번 |
| 내부 동작 | 동일 (LabelRegistry → 1-based index → encode) | 동일 |
| 결과 | `VersionedIndex` | `VersionedIndex` (동일) |
| 적합한 곳 | 일회성 인코딩 | 반복 호출 (미들웨어, SDK) |

## 에러 처리

| 상황 | 에러 |
|------|------|
| 고정 시 존재하지 않는 라벨 | `RangeError: Unknown label "x" for prefix "full"` |
| resolve 시 자유 라벨 누락 | `RangeError: Missing label "region" in resolve()` |
| 엔티티 ID가 LabelRegistry에 없음 | `EntityNotFoundError` (PrefixCodec 내부) |

## 참조

- `calc.ts:partialQueryBase` — 고정 차원 기여분 계산 원리
- `prefix-registry.ts:PrefixCodec` — 라벨 기반 인코딩/디코딩
- `label-registry.ts:LabelRegistry` — 엔티티 ID ↔ 1-based 인덱스 변환
- `permission-engine/src/composite-address.test.ts` — partialQueryBase를 직접 사용한 저수준 검증
