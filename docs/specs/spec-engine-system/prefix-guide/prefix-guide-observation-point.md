---
def:
  tier: component
  id: prefix-guide-observation-point
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [entry-point, runtime, observability]
  links:
    - target: prefix-guide
      type: traces_to
---

# 비즈니스 로직 관측 포인트

## 목적 ^purpose

비즈니스 흐름의 분기점을 prefix 주소로 정의하고, 권한 및 이벤트와 함께 IntentLink로 등록하여 추적하는 방법을 설명한다.

## 관측 포인트란

비즈니스 로직에서 **경우의 수가 분기하는 지점**. 이 지점에서 어떤 경로로 갔는지를 기록하면 전체 흐름을 추적할 수 있다.

```
결제 흐름의 관측 포인트:

  1. 장바구니 진입     → cart_event: { action: "add", actor: member:42 }
  2. 결제 시도         → order_event: { action: "create", service_ctx: prod/payment }
  3. 결제 결과 분기     → order_event: { action: "complete" } 또는 { action: "cancel" }
  4. 취소 시 환불 분기  → order_event: { action: "refund" }

각 포인트 = prefix 주소 하나 = 추적 가능한 경우의 수
```

## 관측 포인트 정의 패턴

```typescript
// ── 관측 포인트를 명시적으로 정의한다 ────────────────

const CHECKOUT_FLOW = {
  // 진입점
  entry: qa.address("page", { page: "checkout", locale: "ko" }),

  // 분기점들
  branches: {
    paymentAttempt:  qa.address("order_event", { action: "create" }),
    paymentSuccess:  qa.address("order_event", { action: "complete" }),
    paymentFailure:  qa.address("order_event", { action: "cancel" }),
    refundRequested: qa.address("order_event", { action: "refund" }),
  },

  // 이 흐름에서 기대하는 권한
  requiredPermissions: [
    qa.address("permission", { role: "customer", action: "write" }),
  ],
} as const;

// 이 정의 자체가 "결제 흐름의 경우의 수"를 명시적으로 열거한 것.
// 각 주소는 정수 하나. 런타임에 이 정수가 발생하면 관측된 것.
```

## 관측 포인트 등록

```typescript
// ── prefix로 관측 포인트를 관리한다 ─────────────────

// 각 관측 포인트는 prefix 주소이므로
// DKG에서 IntentLink로 연결:

IntentLink: "checkout-flow"
  endpoints: [page, order_event, permission]
  via: service
  intent: "결제 흐름의 진입→분기→권한을 일관적으로 추적"
  invariant: "결제 시작 없이 결제 완료가 관측되면 안 됨"
```

## 관측 포인트 유형

| 유형 | prefix 예시 | 설명 |
|---|---|---|
| **진입점** | `page` prefix | 사용자가 어떤 화면에 진입했는가 |
| **행위** | `tracking` prefix | 사용자가 어떤 행동을 했는가 |
| **이벤트** | `event`, `*_event` prefix | 시스템에서 어떤 이벤트가 발생했는가 |
| **권한** | `permission` prefix | 어떤 권한으로 접근했는가 |
| **API 호출** | `endpoint` prefix | 어떤 API가 호출되었는가 |
| **상태 전이** | 도메인별 prefix | 어떤 상태에서 어떤 상태로 전이했는가 |

**모든 관측 포인트는 prefix 주소다.** 정수 하나로 표현되고, bitmask로 집합 연산 가능하고, 다른 prefix의 차원이 될 수 있다.
