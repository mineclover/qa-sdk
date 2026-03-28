---
def:
  id: dim-ops-system
  level: module
  address: def_document:v2:68626
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, tier-infra]
  links:
    - target: dim-ops-cross-select
      type: contains
    - target: dim-ops-env-inject
      type: contains
    - target: dim-ops-deploy-resolve
      type: contains
    - target: dim-ops-patterns
      type: contains
    - target: table-system-group
      type: depends_on
    - target: wi-system
      type: depends_on
    - target: perm-external-system
      type: depends_on
---

# 차원 연산 시스템

## 목적 ^purpose

축 교차 선택, 환경 주입, 배포 시점 차원 해석, 조합 패턴 — 좌표 차원 연산의 4가지 핵심 패턴.

## 구성 ^overview

- `dim-ops-cross-select`: N개 축에서 특정 차원만 선택하여 부분 좌표를 구성하는 교차 선택 연산.
- `dim-ops-env-inject`: 런타임 환경(env, region)을 좌표 차원에 자동 주입하는 연산.
- `dim-ops-deploy-resolve`: 배포 시점에 차원 값을 해석하여 concrete 좌표를 생성하는 연산.
- `dim-ops-patterns`: PartialBinder, FixedDims, ServiceBinder 등 차원 조합의 실용 패턴.

기반 문서: [foundation.md](../indexing/foundation.md) · [patterns.md](../indexing/patterns.md)
관련 스펙: [permission-engine/core.spec.md](../indexing/permission-engine/core.spec.md) · [permission-engine/resource.spec.md](../indexing/permission-engine/resource.spec.md) · [weighted-index/partial-binder.spec.md](../indexing/weighted-index/partial-binder.spec.md)

## 전체 그림

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

## 구성 문서

| 문서 | 내용 |
|---|---|
| [dim-ops-cross-select.spec.md](dim-ops-cross-select.spec.md) | N개 축에서 특정 차원만 선택하여 부분 좌표를 구성하는 교차 선택 연산 |
| [dim-ops-env-inject.spec.md](dim-ops-env-inject.spec.md) | 런타임 환경(env, region)을 좌표 차원에 자동 주입하는 연산 |
| [dim-ops-deploy-resolve.spec.md](dim-ops-deploy-resolve.spec.md) | 배포 시점에 차원 값을 해석하여 concrete 좌표를 생성하는 연산 |
| [dim-ops-patterns.spec.md](dim-ops-patterns.spec.md) | PartialBinder, FixedDims, ServiceBinder 등 차원 조합의 실용 패턴 |

## 도구별 소스 위치

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

- [permission-engine/core.spec.md](../indexing/permission-engine/core.spec.md) — PermissionSet, TernaryMask, ScopedEngine 상세
- [permission-engine/resource.spec.md](../indexing/permission-engine/resource.spec.md) — ServiceRef, PermCodeFactory, resource 규칙
- [weighted-index/partial-binder.spec.md](../indexing/weighted-index/partial-binder.spec.md) — PartialBinder 상세, PrefixCodec 연동
- [patterns.md](../indexing/patterns.md) — EntityId 기반 이동, cross-index 참조
- [coordinate-query.spec.md](../indexing/coordinate-query.spec.md) — 좌표 질의 (lattice, policy, cross-index)
