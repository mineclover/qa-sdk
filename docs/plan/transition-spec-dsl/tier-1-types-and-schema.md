# Tier 1 — 타입 + 스키마 + Match/Bind [완료]

> 순수 선언 계층. 기존 코드 변경 0. 런타임 엔진 없음.

## 구현 완료

### 타입 (축 기반)

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

### 검증 2단계

1. **구조 검증** (`validateTransitionSpec`) — transition 이름 규칙, bind 경로 형식, axis snake_case, effect vocabulary. catalog 불필요.
2. **catalog 검증** (`validateWithCatalog`) — axis 이름이 catalog에 존재하는지, entry 값이 해당 축에 유효한지. Tier 2에서 추가.

### DKG

`TransitionSpecNode` — 15번째 노드 타입. transition/version/matchMode/coordinateCount/effectKind/slotRefs.

### Demo Specs (DEMO_CATALOG 기반)

| spec | 좌표 | effect |
|------|------|--------|
| `cart.checkout` | trackAction/page → flow_point → order_action | create |
| `user.login` | endpoint → auth_action → flow_point | open |
| `payment.capture` | flow_point → order_action → flow_point | close |

## 완료 기준 ✓

- [x] `transition.types.ts` — 축 기반 StateCondition/StateAssignment
- [x] `transition.schema.ts` — 구조 검증
- [x] `transition.registry.ts` — register/get/list/remove/clear
- [x] `match-adapter.ts` — MatchPattern → ScenarioStep[]
- [x] DKG `TransitionSpecNode` 노드 타입
- [x] DEMO_CATALOG 기반 예시 3종
- [x] 단위 테스트 46개
