---
def:
  tier: component
  id: coord-stride-stability
  address: def_document:v2:414854
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, performance, structural]
  links:
    - target: coord-foundation
      type: refines
sources:
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/index-meta/src/invalid-ranges.ts
  - packages/index-meta/src/invalid-ranges.test.ts
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta/src/version-lifecycle.test.ts
  - packages/index-meta/src/migrate-address.ts
  - packages/index-meta/src/migrate-address.test.ts

---

# Stride 공식과 주소 안정성

## 목적 ^purpose

Mixed-radix encoding에서 stride가 주소를 결정하는 원리, 단일/복합 축의 안정성 차이, capacity headroom이 stride를 고정하는 장치임을 정의한다.

## Stride가 주소를 결정한다

Mixed-radix encoding에서 각 차원의 **stride(가중치)**는 후속 차원들의 capacity 곱으로 결정된다.

```
shape    = [N₀, N₁, N₂]
stride   = [N₁×N₂,  N₂,  1]

좌표 [a, b, c]  →  주소 = a×(N₁×N₂) + b×(N₂) + c
```

이 공식에서 핵심은: **stride[i]는 i보다 뒤에 있는 모든 차원의 capacity에 의존한다.**

## 단일 축: 자연스럽게 안정적

차원이 1개뿐인 인덱스는 stride가 항상 `[1]`이다.

```
shape = [5]   →  stride = [1]  →  "admin"=1, "editor"=2, "viewer"=3
shape = [8]   →  stride = [1]  →  "admin"=1, "editor"=2, "viewer"=3, "guest"=4, ...
```

entries를 추가해도 stride가 바뀌지 않으므로 **기존 인덱스가 자동으로 보존된다.** 버전 관리는 사실상 단어 사전의 이력 기록 수준이며, 마이그레이션이 필요한 상황 자체가 발생하지 않는다(capacity 변경이 아닌 한).

## 복합 축: Capacity 변경이 주소를 무효화한다

차원이 여러 개이면 **어떤 한 차원의 capacity 변경이 선행 차원 전체의 stride를 바꾼다.**

```
v1: shape = [3, 4, 5]  →  stride = [20, 5, 1]
    좌표 [2, 3, 4]     →  주소 = 2×20 + 3×5 + 4 = 59

v2: shape = [3, 6, 5]  →  stride = [30, 5, 1]   ← N₁이 4→6으로 변경
    좌표 [2, 3, 4]     →  주소 = 2×30 + 3×5 + 4 = 79   ← 같은 좌표인데 주소가 다름!

v1에서 저장한 59를 v2 기준으로 decode하면?
    59 = 1×30 + 5×5 + 4  →  [1, 5, 4]   ← 완전히 다른 의미!
```

이것이 복합 축에서 **capacity headroom을 미리 선언해야 하는 근본 이유**다. capacity를 충분히 크게 잡아두면 항목을 추가해도 shape이 변하지 않고, shape이 변하지 않으면 stride가 불변이므로 기존 주소가 보존된다.

## Capacity Headroom — Stride를 고정하는 장치

```
capacity = [10, 10, 10]  →  stride = [100, 10, 1]  (고정)

v1 entries: [3, 4, 5]    →  headroom = [7, 6, 5]  ← 추가 여유분
v2 entries: [3, 6, 5]    →  headroom = [7, 4, 5]  ← 항목 추가했지만 stride 불변
```

headroom이 남아있는 한, entries를 추가해도 **버전 변경 없이** 기존 주소가 보존된다. headroom이 소진되면 capacity를 확장해야 하고, 이때 stride가 바뀌므로 **새 버전 생성 + 마이그레이션**이 필요하다.
