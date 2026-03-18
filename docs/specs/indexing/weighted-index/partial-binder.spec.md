# weighted-index partial-binder 스펙

> `PartialBinder`는 `PrefixCodec` 위에서 동작하는 차원 부분 바인딩(curried encoder) 레이어다.
> 전체 경로 중 고정 차원은 부트 시점에 캐시하고, 런타임에는 남은 차원만 받아 같은 1D address space 안에서 최종 주소를 계산한다.

패키지: `weighted-index`
패키지 인덱스: [README.md](README.md)

## 상태

implemented

## 1. 목적

`PartialBinder`의 목적은 전체 차원 경로를 매번 다시 전달하지 않고도 `PrefixCodec.encodeFromIds()`와 같은 결과를 계산하게 만드는 것이다.

대표적인 사용 시나리오는 다음과 같다.

- 앱 부트 시점: 서비스 컨텍스트처럼 변하지 않는 차원을 고정한다.
- 런타임 요청 시점: region, shard, resource, action 같은 나머지 차원만 넣어 주소를 계산한다.

예시 경로:

```text
namespace > name > env > device > region > shard > resource > action
```

이 경로에서 `namespace`, `name`, `env`, `device`를 미리 바인딩해 두면, 런타임에는 `region`, `shard`, `resource`, `action`만 넘겨도 된다.

---

## 2. 차원 경로와 자유 차원 규칙

### 2.1 canonical 예시 경로

`partial-binder.ts`와 `partial-binder.test.ts`가 문서화하는 대표 경로는 다음 `full` prefix다.

```text
namespace > name > env > device > region > shard > resource > action
```

의미:

| 위치 | 차원 |
|---|---|
| 1 | `namespace` |
| 2 | `name` |
| 3 | `env` |
| 4 | `device` |
| 5 | `region` |
| 6 | `shard` |
| 7 | `resource` |
| 8 | `action` |

### 2.2 순서의 출처

- 차원 순서는 하드코딩된 전역 규칙이 아니라 `PrefixCodec`의 prefix 정의에서 온다.
- `createBinder()`는 `codec.getLabels(prefix)`가 반환한 순서를 기준으로 `free` 목록을 만든다.
- 따라서 address space는 "같은 라벨 집합"보다 "같은 라벨 집합 + 같은 순서"에 의해 결정된다.

예:

- `full` prefix: `namespace > name > env > device > region > shard > resource > action`
- `svc` prefix: `namespace > name`
- `perm` prefix: `resource > action`

### 2.3 `free` 계산 규칙

- `bound`는 생성 시점 또는 `bind()` 체이닝으로 이미 고정한 라벨 집합이다.
- `free`는 `codec.getLabels(prefix)`에서 `bound`를 뺀 나머지 라벨을 원래 순서대로 유지한 목록이다.
- `resolve()`와 `resolveId()`는 `free`에 포함된 모든 라벨 값을 받아야 한다.

---

## 3. 공개 export 표면

소스: `packages/weighted-index/src/partial-binder.ts`

이 모듈의 public export는 두 개다.

| export | 형태 | 계약 |
|---|---|---|
| `createBinder` | function | `PrefixCodec`와 prefix에 대해 부분 바인딩된 인코더를 생성한다. |
| `PartialBinder` | interface | 바인딩 상태(`bound`, `free`, `prefix`, `version`)와 계산 API(`resolve`, `resolveId`, `bind`)를 노출한다. |

이 두 export는 `packages/weighted-index/src/index.ts`에서도 패키지 공개 API로 재수출된다.

### 3.1 `createBinder(codec, prefix, fixed, version?)`

```ts
createBinder(
  codec: PrefixCodec,
  prefix: string,
  fixed: Record<string, EntityId>,
  version?: string,
): PartialBinder
```

주의:

- 태스크 메모에서 두 번째 인자를 `mode`라고 부르지만, 실제 구현 시그니처의 이름은 `prefix`다.
- 이 인자는 `"full"`, `"svc"`, `"perm"`처럼 어떤 prefix address space에 바인딩할지 지정한다.

매개변수:

| 이름 | 타입 | 의미 |
|---|---|---|
| `codec` | `PrefixCodec` | label registry와 prefix 정의를 보유한 코덱 |
| `prefix` | `string` | 대상 address space 이름 |
| `fixed` | `Record<string, EntityId>` | 미리 고정할 라벨 값들 |
| `version` | `string \| undefined` | 대상 prefix version. 생략 시 `codec.getCurrentVersion(prefix)` |

동작:

- `fixed`의 key가 해당 prefix에 없는 라벨이면 `RangeError`를 던진다.
- `version`을 생략하면 생성 시점의 current version을 고정한다.
- 반환값은 같은 `prefix`/`version`을 유지하는 `PartialBinder`다.

### 3.2 `PartialBinder`

```ts
interface PartialBinder {
  readonly bound: Readonly<Record<string, EntityId>>;
  readonly free: readonly string[];
  readonly prefix: string;
  readonly version: string;

  resolve(remaining: Record<string, EntityId>): VersionedIndex;
  resolveId(remaining: Record<string, EntityId>): number;
  bind(additional: Record<string, EntityId>): PartialBinder;
}
```

속성:

| 멤버 | 설명 |
|---|---|
| `bound` | 이미 고정된 라벨과 값 |
| `free` | 아직 입력받아야 하는 남은 라벨 목록 |
| `prefix` | 어떤 prefix address space를 대상으로 하는지 |
| `version` | 어떤 prefix version snapshot에 고정되었는지 |

메서드:

| 메서드 | 반환 | 계약 |
|---|---|---|
| `resolve(remaining)` | `VersionedIndex` | 자유 차원을 받아 `{ prefix, v, id }`를 계산한다. |
| `resolveId(remaining)` | `number` | `resolve(remaining).id`의 단축형이다. |
| `bind(additional)` | `PartialBinder` | 추가 차원을 고정한 새 binder를 반환한다. 체이닝 가능하다. |

체이닝 규칙:

- `bind()`는 기존 binder를 mutate하지 않고 새 binder를 반환한다.
- 체이닝 중에도 `prefix`와 `version`은 유지된다.
- `free`는 단계가 진행될수록 줄어들 수 있고, 모두 고정되면 `free`는 빈 배열이 된다.

---

## 4. 계산 원리

### 4.1 mixed-radix 분리 가능성

weighted-index의 주소 계산 공식은 다음과 같다.

```text
address = Σ (coord[i] - 1) × stride[i]
```

여기서 각 차원의 기여분은 서로 독립적이다. 따라서 전체 주소는 다음처럼 분리해서 생각할 수 있다.

```text
address = fixedBase + remainingBase
```

- `fixedBase`: 이미 고정된 차원들의 기여분
- `remainingBase`: 런타임에 주어지는 자유 차원들의 기여분

### 4.2 `partialQueryBase`와의 관계

`calc.ts`의 `partialQueryBase(weights, fixedCoords)`는 바로 이 `fixedBase`를 계산하는 순수 함수다.

```text
fixedBase = Σ (fixedCoord[i] - 1) × stride[i]
```

`PartialBinder` 스펙의 핵심은 이 수학적 분해 가능성이다.

- 고정 차원의 기여분은 한 번 계산한 뒤 재사용할 수 있다.
- 자유 차원의 기여분만 런타임마다 바뀐다.
- 둘을 합치면 전체 `encode` 결과와 동일한 1D 주소가 된다.

현재 구현은 `partialQueryBase()`를 직접 호출하는 대신, `fixed`와 `remaining`을 병합한 뒤 `PrefixCodec.encodeFromIds()`에 위임한다. 하지만 correctness의 근거는 동일한 mixed-radix 분해 원리다.

### 4.3 체이닝과 누적 바인딩

`bind()` 체이닝은 고정 차원 집합을 점진적으로 늘리는 연산이다.

```ts
const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
const step2 = step1.bind({ env: "prod", device: "web" });
const step3 = step2.bind({ region: "asia", shard: "s2" });
```

이 과정은 다음 의미를 가진다.

- `step1`: 앞쪽 차원 일부를 고정
- `step2`: 더 많은 차원을 고정
- `step3`: 거의 모든 차원을 고정

즉, partial query의 base를 여러 단계에 걸쳐 점점 더 구체화하는 인터페이스다.

---

## 5. PrefixCodec / LabelRegistry 연동

`PartialBinder`는 raw ordinal 좌표를 직접 받지 않는다. 입력은 모두 `EntityId` 기반 라벨 값이다.

예:

```ts
createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});
```

이 값들은 내부적으로 다음 단계를 거친다.

1. 라벨 이름(`namespace`, `name`, `env` ...)으로 각 차원을 찾는다.
2. `PrefixCodec.encodeFromIds()`가 `LabelRegistry`를 통해 entity ID를 1-based 인덱스로 바꾼다.
3. 그 1-based 좌표들을 weighted-index mixed-radix 공식으로 인코딩한다.

즉, `PartialBinder`는 다음과 같은 동일한 내부 의미를 갖는다.

```ts
binder.resolve(remaining)
===
codec.encodeFromIds(prefix, { ...bound, ...remaining }, version)
```

이 덕분에 호출자는 직접 다음을 할 필요가 없다.

- 라벨 순서 기억
- entity ID를 1-based 인덱스로 변환
- raw coord 배열 조립

---

## 6. 사용 패턴

### 6.1 SDK 컨텍스트 고정

가장 일반적인 패턴은 부트 시점에 서비스 컨텍스트를 고정하고, 런타임에는 나머지만 받는 것이다.

```ts
const sdk = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});

const address = sdk.resolveId({
  region: "asia",
  shard: "s2",
  resource: "orders",
  action: "GET",
});
```

효과:

- 호출부가 짧아진다.
- 반복되는 고정 차원을 다시 넘기지 않아도 된다.
- 결과 주소는 전체 차원을 모두 넣고 `codec.encodeFromIds("full", ...)`를 호출한 경우와 같다.

### 6.2 멀티서비스 패턴

같은 `codec`를 공유하더라도 서로 다른 binder는 서로 다른 고정 차원을 가지므로 독립된 address space view를 만든다.

```ts
const paymentSDK = createBinder(codec, "full", {
  namespace: "shop",
  name: "payment",
  env: "prod",
  device: "web",
});

const authSDK = createBinder(codec, "full", {
  namespace: "shop",
  name: "auth",
  env: "prod",
  device: "web",
});
```

같은 `remaining`을 넣더라도 `name`이 다르면 다른 주소가 나온다. 즉 "같은 codec + 다른 binder"는 서비스별로 분리된 주소 공간 진입점을 제공한다.

### 6.3 prefix별 독립 binder

`PartialBinder`는 `full` prefix 전용이 아니다.

```ts
const svcBinder = createBinder(codec, "svc", { namespace: "shop" });
const permBinder = createBinder(codec, "perm", { resource: "orders" });
```

각 binder는 자신이 속한 prefix의 라벨 순서와 version에 따라 독립적으로 동작한다.

---

## 7. 에러와 검증

| 상황 | 동작 |
|---|---|
| `fixed`에 prefix에 없는 라벨이 포함됨 | `RangeError("Unknown label ...")` |
| `resolve()`/`resolveId()`에서 `free` 라벨이 빠짐 | `RangeError("Missing label ...")` |
| 라벨은 맞지만 entity ID가 해당 label version에 없음 | `LabelRegistry`/`PrefixCodec` 경로의 lookup 에러 (`EntityNotFoundError`) |

추가 규칙:

- `resolve()`는 자유 차원 누락을 허용하지 않는다.
- `resolveId()`는 `resolve()`와 같은 검증을 수행하고 결과 `id`만 반환한다.
- version은 binder 생성 시 결정되며, 이후 `bind()` 체이닝에서도 그대로 유지된다.

---

## 8. export coverage 매핑

`packages/weighted-index/src/partial-binder.ts`의 공개 표면이 이 문서에 모두 반영되었는지 확인하는 매핑 표다.

| 소스 export / 멤버 | 이 문서의 위치 |
|---|---|
| `createBinder` | §3.1 |
| `PartialBinder` | §3.2 |
| `PartialBinder.bound` | §3.2 속성 표 |
| `PartialBinder.free` | §2.3, §3.2 속성 표 |
| `PartialBinder.prefix` | §3.2 속성 표 |
| `PartialBinder.version` | §3.1, §3.2 속성 표, §7 |
| `PartialBinder.resolve()` | §3.2, §5, §7 |
| `PartialBinder.resolveId()` | §3.2, §6.1, §7 |
| `PartialBinder.bind()` | §3.2, §4.3 |

## 참조

- `packages/weighted-index/src/partial-binder.ts`
- `packages/weighted-index/src/partial-binder.test.ts`
- `packages/weighted-index/src/calc.ts` — `partialQueryBase`
- `packages/weighted-index/src/prefix-registry.ts` — `PrefixCodec.encodeFromIds()`
- `packages/weighted-index/docs/partial-binder.md`
