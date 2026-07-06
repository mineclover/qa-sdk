---
def:
  tier: component
  id: partial-binder-math
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, performance]
  links:
    - target: partial-binder-spec
      type: refines
    - target: wi-math
      type: depends_on
sources:
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
---

# PartialBinder 차원 규칙과 계산 원리

## 목적 ^purpose

차원 경로의 순서 결정 규칙, free/bound 분리 규칙, mixed-radix 분해에 의한 고정차원 캐시 원리를 정의한다.

## 구성 ^overview

### canonical 예시 경로

`partial-binder.ts`와 `partial-binder.test.ts`가 문서화하는 대표 경로는 다음 `full` prefix다.

```text
namespace > name > env > device > region > shard > resource > action
```

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

### 순서의 출처

- 차원 순서는 하드코딩된 전역 규칙이 아니라 `PrefixCodec`의 prefix 정의에서 온다.
- `createBinder()`는 `codec.getLabels(prefix)`가 반환한 순서를 기준으로 `free` 목록을 만든다.
- 따라서 address space는 "같은 라벨 집합 + 같은 순서"에 의해 결정된다.

### `free` 계산 규칙

- `bound`는 생성 시점 또는 `bind()` 체이닝으로 이미 고정한 라벨 집합이다.
- `free`는 `codec.getLabels(prefix)`에서 `bound`를 뺀 나머지 라벨을 원래 순서대로 유지한 목록이다.
- `resolve()`와 `resolveId()`는 `free`에 포함된 모든 라벨 값을 받아야 한다.

### mixed-radix 분리

weighted-index의 주소 계산 공식:

```text
address = Σ (coord[i] - 1) × stride[i]
```

각 차원의 기여분은 서로 독립적이므로:

```text
address = fixedBase + remainingBase
```

- `fixedBase`: 이미 고정된 차원들의 기여분 (`partialQueryBase(weights, fixedCoords)`)
- `remainingBase`: 런타임에 주어지는 자유 차원들의 기여분

### 체이닝과 누적 바인딩

`bind()` 체이닝은 고정 차원 집합을 점진적으로 늘리는 연산이다.

```ts
const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
const step2 = step1.bind({ env: "prod", device: "web" });
const step3 = step2.bind({ region: "asia", shard: "s2" });
```

partial query의 base를 여러 단계에 걸쳐 점점 더 구체화하는 인터페이스다.
