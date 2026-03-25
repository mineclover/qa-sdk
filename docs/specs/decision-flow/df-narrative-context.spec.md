---
def:
  id: df-narrative-context
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-narrative-group
      type: member_of
    - target: df-narrative-structure
      type: depends_on
---
# Decision Flow — ContextProvider

## 목적 ^purpose

ContextProvider — 결정 시작 시 이전 맥락을 표면화하여 같은 조사를 반복하지 않게 만드는 기능. 컨텍스트가 쌓일수록 다음 결정이 쉬워진다.

증명 코드: `packages/decision-flow/src/proof.test.ts` (125 tests)

---

## 장 8: 시스템의 역할은 결정을 쉽게 만드는 것이다

### 질문

이 시스템이 결정을 **더 어렵게** 만들고 있지 않은가?
기록, 추적, 모니터링, 알림 — 이 모든 것이 관료주의가 아닌가?

### 증명

`ContextProvider`를 구현했다.
결정을 시작할 때 `provide(schemaId, context)`를 호출하면:

1. **이력 요약**: 이 스키마에서 이전에 몇 번 결정했고, 보통 어떤 경로를 선택했고, 평균 confidence는 얼마였는가
2. **패턴 힌트**: "team=platform일 때, extend → fast 경로를 5회 선택" — 그리고 **현재 컨텍스트와 매치되는지** 표시
3. **정책 힌트**: "이 조건이면 자동으로 extend가 선택된다" — 이미 자동화된 것을 알려줌
4. **인지 모델 힌트**: "이 gate에서는 이 질문을 생각해보라" — bezos-doors: "되돌릴 수 있는가?"
5. **열린 질문**: 이전 결정에서 남긴 미해결 질문

`provideForGate()`를 호출하면 특정 gate의 이전 선택 분포까지 제공:
"scope gate에서 extend 75%, new 25%. 코어 gate임."

### 축적 사이클 검증

- 1회차: 컨텍스트 없음 (처음이니까)
- 1건 결정 후: 이력 1건
- 5건 결정 후: 이력 5건 + 패턴 감지 + 매칭
- **결정할수록 다음 결정의 컨텍스트가 풍부해진다**

강제하지 않는다. 컨텍스트를 무시하고 결정해도 된다. 시스템은 "이런 맥락이 있다"고 보여줄 뿐.

### 결론

**시스템의 핵심 역할은 기록이 아니라 컨텍스트 제공이다.**

기록, 모니터링, 알림은 부산물이다. 진짜 가치는:
- 사람에게: 이전 맥락이 자동으로 표면화되므로 **같은 조사를 반복하지 않아도 된다**
- 시스템에게: 일관된 축으로 축적하므로 **컨텍스트가 흩어지지 않는다**

```
컨텍스트 축적 → 표면화 → 쉬운 결정 → 결과가 다시 축적
```

이것이 단순한 "의사결정 기록 시스템"과 "의사결정 좌표계"의 차이다.
기록 시스템은 과거를 보관한다. 좌표계는 과거가 미래의 결정을 쉽게 만든다.

---

## 장 9: 시스템 구조를 관통하여 맥락을 조합한다

### 질문

decision-flow는 독립 모듈인가, 아니면 시스템 전체의 통합 지점인가?

구조 정보는 8곳에 흩어져 있다:
catalog, DKG, GateEngine, decode, registry, convergence, spec-core, ContextProvider.
이것들이 결정 시점에 하나로 합쳐지는가?

### 증명

`assembleHierarchicalContext("cart_event")`를 호출하면 5개 레벨에서 맥락이 조합된다:

```
Level 1 — Domain: event-domain
  공유 축: [order_status, order_action]
  경계: exports=[order_status, auth_state]

Level 2 — DSL: dsl-checkout, dsl-commerce (2개 번들에 소속)
  불변조건: "checkout page_view 없이 flow_point(success) 관측되면 안 됨"
  불변조건: "주문 금액은 0보다 커야 함"

Level 3 — Prefix: cart_event (category: event)
  dims: order_status(axis), order_action(axis), svc_ref(prefix_ref)

Level 4-5 — Dim/Entry:
  order_status: [pending,confirmed,shipped,delivered,cancelled] capacity:8 headroom:3
  order_action: [add_to_cart,remove,update_quantity,checkout,cancel] capacity:8 headroom:3

조합된 제약: 도메인 경계 + DSL 불변조건 + headroom 경고
조합된 공유 축: [order_action, order_status, svc_ref]
요약: "cart_event | 도메인:event-domain | DSL:[dsl-checkout,dsl-commerce] | 3차원 | 총headroom:6"
```

page_view에서는 다른 맥락이 조합됨:
- observation-domain 소속
- user_type headroom=1 경고 자동 포함
- dsl-checkout 공유 (cart_event와 같은 파이프라인)

복수 prefix를 한 번에 조합하면 교차점(공유 DSL)도 보임.

### 결론

**decision-flow는 독립 모듈이 아니라 시스템 구조의 통합 지점이다.**

구조 정보가 5개 레벨에 흩어져 있어도, `assembleHierarchicalContext()` 한 번으로
도메인 경계, DSL 불변조건, 차원 headroom까지 한 번에 표면화된다.

이것이 "사람에게는 쉬운 의사결정"의 실체다:
- 직접 catalog/DKG/spec-core를 뒤질 필요 없이
- 결정할 prefix의 이름만 넣으면
- 관련된 모든 제약과 여유가 한 번에 보인다
