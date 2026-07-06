---
status: implemented
sources:
  - packages/spec-transition/src/index.ts
  - packages/spec-transition/src/transition.types.ts
  - packages/spec-transition/src/transition.schema.ts
  - packages/spec-transition/src/transition.registry.ts
  - packages/spec-transition/src/catalog-validator.ts
  - packages/spec-transition/src/match-adapter.ts
  - packages/spec-transition/src/bind-extractor.ts
  - packages/spec-transition/src/demo-transition-specs.ts
  - packages/spec-transition/src/transition.test.ts
  - packages/dkg/src/dkg-bridge.ts
  - packages/dkg/src/dkg-bridge.test.ts
  - packages/spec-core/src/dkg/lifecycle-e2e.test.ts
  - docs/specs/analysis-system/analysis-transition.spec.md
---

# Tier 1 — 타입 + 스키마 + Match/Bind

> 순수 선언 계층. 런타임 엔진 없음.

## 타입 (축 기반)

```typescript
interface StateCondition {
  axis: string       // DEMO_CATALOG 축 이름
  eq?: string        // entry 값 일치
  neq?: string       // entry 값 불일치
  in?: string[]      // entry 목록 포함
  exists?: boolean   // 축에 값 설정 여부
}

interface StateAssignment {
  axis: string       // DEMO_CATALOG 축 이름
  value: string | null  // null = 축 값 제거
}
```

값 타입은 `string | null`만 — 축 entry는 항상 문자열.

## 검증 2단계

1. **구조 검증** (`validateTransitionSpec`) — transition 이름 규칙, bind 경로 형식, axis snake_case, effect vocabulary. catalog 불필요.
2. **catalog 검증** (`validateWithCatalog`) — axis 이름 존재, entry 값 유효성, match.coordinates 차원 검증.

## DKG 노드

`TransitionSpecNode` — matchAxes/inputAxes/outputAxes 역할별 분리.

- `consumes` 엣지: TransitionSpecNode → 참조 축
- `depends-on` 엣지: outputAxes ∩ inputAxes → 전이 간 상태 의존성
- `satisfies` 엣지: slotRefs ∩ DSL member axes → invariant 형식 구현

## Demo Specs

대표 spec:

| spec | 좌표 | effect |
|------|------|--------|
| `cart.checkout` | trackAction/page → flow_point → order_action | create |
| `user.login` | endpoint → auth_action → flow_point | open |
| `payment.capture` | flow_point → order_action → flow_point | close |

## Naming Convention

```
transition: <domain>.<entity>.<operation>
```

소문자, `.` 구분. domain은 DSL bundle 이름과 일치 권장.
