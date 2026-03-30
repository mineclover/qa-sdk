---
def:
  id: signal-model-spec
  address: def_document:v2:342196
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, observability, structural]
  links:
    - target: dimension-operations
      type: depends_on
    - target: dsl-bundle-spec
      type: depends_on
    - target: table-system-spec
      type: depends_on
---

# Signal Model — 트래킹의 상위 개념 구조

## 목적 ^purpose

Signal = 시스템에서 발생한 의미있는 순간.
1번의 qaTrack() 호출 = 1개의 Signal.
각 prefix는 Signal의 다른 측면(role)을 설명한다.

"트래킹 포인트"는 코드의 호출 지점이지 좌표계의 개념이 아니다.
좌표계의 상위 개념은 Signal.

기반 문서: [dimension-operations.md](dimension-operations.md) · [dsl-bundle.md](dsl-bundle.md) · [table-system.md](table-system.md)
소스: `packages/viz-3d/src/core/signal-model.ts`

## 구성 ^overview

- **핵심 개념**: Signal은 1번의 qaTrack() 호출로 생성되는 "시스템에서 발생한 의미있는 순간"이며, 각 prefix는 Signal의 다른 측면(role)을 설명한다
- **7가지 역할(Role)**: context(어디서), trigger(뭘 했는가), channel(어떤 경로), state(흐름 어디), guard(어떤 조건), effect(결과), data(데이터 접점)
- **Signal 정의**: id, name, description, members(prefix + role + 고정값), requires(선행 Signal), dsl(소속 DSL)로 구성
- **Signal 체인**: `requires`로 순서 관계를 정의하여 flow-trace skill이 invariant 위반을 감지 (예: 로그인 없이 장바구니 담기 불가)
- **Signal 검증**: 런타임 address_context가 SignalDef에 맞는지 검증하여 누락된 role과 매칭된 member 수를 반환
- **계층 구조**: DSL(prefix 묶음) → Signal(prefix + role + 순서) → address_context(인코딩된 좌표) → prefix(좌표 공간) → 축 값(entry)
- **프리셋 카탈로그**: auth.login, page.view, cart.add, checkout.entry/process, payment.success 등 8개 표준 Signal 정의
- **3D 시각화 연동**: monitor.html에서 Signal 발생 시 L0(UI)/L1(Business)/L3(Data) 레이어별로 role 기반 색상 구분 표시

---

## 1. 왜 Signal인가

현재 시스템에서 혼용되는 용어들:

| 용어 | 실제 의미 | 문제 |
|---|---|---|
| 트래킹 포인트 | 코드에서 qaTrack()을 호출하는 위치 | 좌표계 개념이 아님 |
| prefix | 좌표 공간의 단위 | Signal 내 구성요소일 뿐 |
| 이벤트 | 발생한 것 | prefix 중 일부(event)와 이름 충돌 |
| 관측 포인트 | 분기를 추적하는 지점 | 범위가 모호 |
| address_context | 인코딩된 좌표 집합 | Signal의 직렬화 형태 |

**Signal은 이 모든 것의 상위 개념:**

```
qaTrack("cart.add", {
  page_view: {page: "product_detail", ...},  ← context
  tracking: {trackAction: "add_to_cart"},     ← trigger
  endpoint: {http_method: "POST"},            ← channel
  cart_event: {action: "add"},                ← trigger
})

이 호출 하나가 Signal 1개.
각 prefix는 Signal의 다른 측면(role)을 설명.
```

---

## 2. Signal Role — 7가지 역할

Signal을 구성하는 prefix들은 각각 고유한 역할을 담당한다:

| Role | 의미 | 질문 | 해당 prefix |
|---|---|---|---|
| **context** | 어디서 | 어떤 환경/화면에서? | service, page_view, content |
| **trigger** | 뭘 했는가 | 유저가/시스템이 뭘 했는가? | tracking, cart_event, auth_event, order_event |
| **channel** | 어떤 경로로 | 어떤 API/통신 경로? | endpoint |
| **state** | 흐름 어디 | 비즈니스 흐름의 어느 지점? | flow_point |
| **guard** | 어떤 조건 | 어떤 권한/정책이 적용됐는가? | permission, rbac |
| **effect** | 결과 | 무슨 부수 효과가 발생했는가? | pipeline_point, health_event, deploy_event |
| **data** | 데이터 접점 | 어떤 DB 테이블에 닿았는가? | members, orders, items, carts |

### Role의 중요성

같은 prefix라도 Signal에서의 역할이 다르다:

```
Signal("auth.login"):
  tracking(submit)     ← trigger: 유저가 뭘 했는가
  auth_event(login)    ← trigger: 시스템에 무슨 일이

Signal("checkout.entry"):
  tracking(navigate)   ← trigger: 유저가 뭘 했는가 (다른 action)
  flow_point(entry)    ← state: 흐름 어디에 있는가
  permission(customer) ← guard: 어떤 권한으로

두 Signal 모두 tracking을 사용하지만 역할(trigger)과 값(submit vs navigate)이 다르다.
```

---

## 3. Signal 정의 (설계 시점)

```typescript
interface SignalDef {
  id: string;           // "auth.login", "cart.add"
  name: string;         // "로그인"
  description: string;  // "사용자 인증 → 세션 생성"
  members: SignalMember[];  // prefix + role + 고정값
  requires?: string[];  // 선행 Signal
  dsl?: string;         // 소속 DSL
}

interface SignalMember {
  prefixId: string;     // "tracking"
  role: SignalRole;     // "trigger"
  fixedValues?: Record<string, string>;  // {trackAction: "submit"}
}
```

### 예시: checkout 흐름의 Signal 정의

```typescript
{
  id: "checkout.process",
  name: "주문 생성",
  description: "주문 데이터 생성 + 결제 요청",
  dsl: "dsl-checkout",
  requires: ["checkout.entry"],
  members: [
    { prefixId: "endpoint",       role: "channel", fixedValues: {http_method: "POST"} },
    { prefixId: "flow_point",     role: "state",   fixedValues: {flow_name: "checkout", flow_step: "processing"} },
    { prefixId: "permission",     role: "guard",   fixedValues: {role: "customer"} },
    { prefixId: "order_event",    role: "trigger", fixedValues: {action: "create"} },
    { prefixId: "pipeline_point", role: "effect",  fixedValues: {pipeline_phase: "ingest"} },
  ],
}
```

---

## 4. Signal 체인 (선행 조건)

Signal은 `requires`로 순서 관계를 정의한다:

```
auth.login ──→ cart.add ──→ checkout.entry ──→ checkout.process ──→ payment.success
                                                                        ↓
                                                                   auth.logout
```

`requires`의 의미:
- `cart.add`의 `requires: ["auth.login"]` → 로그인 없이 장바구니 담기 불가
- `checkout.process`의 `requires: ["checkout.entry"]` → 결제 진입 없이 주문 생성 불가
- flow-trace skill이 이 체인을 검증하여 invariant 위반을 감지

---

## 5. Signal 검증

런타임에 발생한 address_context가 SignalDef에 맞는지 검증:

```typescript
validateSignal(authLoginDef, addressContext)

// 완전한 Signal:
{
  valid: true,
  missingRoles: [],
  matchedMembers: 6,
  totalMembers: 6,
  extraPrefixes: [],
}

// 불완전한 Signal (trigger 누락):
{
  valid: false,
  missingRoles: ["trigger"],
  matchedMembers: 4,
  totalMembers: 6,
  extraPrefixes: [],
}
```

---

## 6. Signal과 다른 개념의 관계

```
DSL Bundle (dsl-checkout)          ← prefix 묶음 + 서비스 바인딩
  └── Signal (checkout.entry)      ← 의미있는 순간
        ├── context: page_view     ← prefix + 축 값
        ├── trigger: tracking
        ├── state:   flow_point
        └── guard:   permission
              └── address_context  ← 인코딩된 좌표 집합
                    └── "permission:v4:5"  ← 1D 정수 주소
                          └── role=customer, svc=payment  ← 축 값
```

| 계층 | 개념 | 역할 |
|---|---|---|
| **DSL** | prefix 묶음 | "이 prefix들이 함께 쓰인다" |
| **Signal** | prefix + role + 순서 | "이 순간에 이 역할로 쓰인다" |
| **address_context** | prefix → serialized | "인코딩된 좌표 값" |
| **prefix** | 좌표 공간 | "N차원 축의 교차" |
| **축 값** | entry | "이 축의 이 값" |

---

## 7. 3D 시각화에서의 Signal

monitor.html에서 DEMO/LIVE 모드로 Signal이 활성화되면:

```
Signal("cart.add") 발생 시:

  L0 (UI):
    page_view/product_detail  ← context (어디서)
    tracking/add_to_cart      ← trigger (뭘 했는가)

  L1 (Business):
    endpoint/POST/api         ← channel (어떤 경로)
    cart_event/add            ← trigger (무슨 이벤트)

  L3 (Data):
    carts/id                  ← data (데이터 접점)
    cart_items/item_id        ← data

  빔: L0 → L1 (context → channel)
  빔: L1 → L3 (trigger → data)
```

Data Flow 패널에서 role별로 색상 구분:

```
Data Flow                    ◄ 5/13 ►
──────────
5. Add Cart

  context  화면: 상품상세
  trigger  행동: 장바구니담기
  channel  API: POST
  trigger  이벤트: 추가
  data     DB: 장바구니
  data     DB: 장바구니항목
```

---

## 8. 프리셋 Signal 카탈로그

| Signal ID | name | roles | requires |
|---|---|---|---|
| auth.login | 로그인 | context+trigger+channel+state+guard | — |
| page.view | 화면 조회 | context+trigger | — |
| api.call | API 호출 | channel | — |
| cart.add | 장바구니 담기 | context+trigger+channel | auth.login |
| checkout.entry | 결제 진입 | context+trigger+state+guard | cart.add |
| checkout.process | 주문 생성 | channel+state+guard+trigger+effect | checkout.entry |
| payment.success | 결제 성공 | trigger+state+effect | checkout.process |
| auth.logout | 로그아웃 | trigger+state | — |

## 참조

- [dimension-operations.md](dimension-operations.md) — 축 교차/환경 주입
- [dsl-bundle.md](dsl-bundle.md) — DSL 번들 (Signal의 상위 묶음)
- [table-system.md](table-system.md) — data role의 테이블 연결

## 관련 소스

- `packages/viz-3d/src/core/signal-model.ts` — 구현
