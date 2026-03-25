---
def:
  id: analysis-system-guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: deprecated
  links:
    - target: analysis-convergence
      type: refines
---

# 분석 시스템 상세 가이드

## 목적 ^purpose

Self-Check, Convergence, IntentLink, Co-occurrence, TransitionSpec — 각 구성 요소의 목적, 동작 방식, prefix와의 관계를 설명한다.

---

## 1. Prefix — 의미의 재사용 단위

prefix는 **특정 의미를 가진 유한 차원의 조합**이다. 도메인에 소속되기 전에, 그 자체로 독립적인 의미 단위다.

### 본질

prefix는 "이 개념을 어떤 차원들로 분류하는가"를 정의한다.

```
tracking = trackAction × page × userType
  → "사용자 행동"이라는 개념을 행위종류 × 페이지 × 사용자유형으로 분류

이 prefix는 쇼핑몰에서도, 블로그에서도, 어디서든 사용 가능하다.
"사용자 행동의 분류"라는 의미 자체가 도메인에 종속되지 않는다.
```

### 재사용과 관찰

prefix를 명시적으로 관리하면 **"이 개념이 시스템 전체에서 얼마나 쓰이는가"**를 관찰할 수 있다.

```
endpoint = svc_ref × resource_type × http_method × api_version
  → "API 호출 분류"라는 개념

이 prefix를 참조하는 곳:
  - dsl-checkout (결제 흐름에서 API 호출 추적)
  - dsl-infra (인프라 변경의 API 영향)
  - dsl-pipeline (파이프라인 단계의 API 호출)
  - IL-checkout-flow (결제 흐름 IntentLink)
  - IL-api-event (API↔이벤트 연결)
  - IL-infra-impact (인프라 영향)

→ dkg impact endpoint 실행하면:
  "이 prefix를 변경하면 3개 DSL + 3개 IntentLink + 4개 서비스에 영향"
```

**prefix가 독립적 의미 단위이기 때문에, 참조하는 모든 곳의 영향을 추적할 수 있다.**

### 구조

```
tracking prefix:
  dims: trackAction(8) × page(8) × userType(3)
  주소 공간: 8 × 8 × 3 = 192개 좌표
  인코딩: { trackAction: "click", page: "home", userType: "guest" } → tracking:v2:0
```

### dim 종류

| kind | 의미 | 값 | 예시 |
|------|------|-----|------|
| `axis` | 유한한 분류 차원 | 문자열 (entry) | `trackAction: "click"` |
| `prefix_ref` | 다른 prefix의 주소 | 정수 (주소) | `svc_ref: 65536` |
| `table_ref` | DB 테이블 참조 | (인코딩 안 됨) | `actor → members` |

### prefix_ref — prefix 간 참조

prefix_ref는 **다른 prefix의 주소를 값으로 가지는 차원**이다. 정수 주소 자체가 값이지만, 그 주소를 디코딩하면 참조된 prefix의 차원들이 펼쳐진다.

```
endpoint prefix를 디코딩하면:

  endpoint:v1:32
    svc_ref: service:65536 (prod/asia/shopping-web/shop)   ← prefix_ref
    resource_type: api                                      ← axis (직접 값)
    http_method: POST                                       ← axis
    api_version: v1                                         ← axis

svc_ref는 "65536"이라는 정수를 가지고 있지만,
이것은 service prefix의 주소이므로 펼치면:
  env: prod, region: asia, svc_name: shopping-web, namespace: shop
```

이 구조가 중요한 이유:

**1. 정보를 담는다** — prefix_ref 주소 자체가 식별자. `65536`으로 "어떤 서비스인가"를 즉시 조회할 수 있다.

**2. 조합한다** — endpoint prefix는 "이 서비스(svc_ref)의 이 API(resource_type/http_method)"를 하나의 좌표로 표현한다. service prefix의 4차원을 endpoint의 3차원과 조합하여 7차원 주소 공간을 구성하되, service 부분은 이미 인코딩된 정수 하나로 압축된다.

**3. 인덱스로 작동한다** — service 주소 `65536`을 키로:
- permission prefix에서 "이 서비스의 권한" 조회
- deploy_event prefix에서 "이 서비스의 배포 이력" 조회
- DB에서 `WHERE service_addr = 65536` 질의

**4. 범위 질의가 가능하다** — `calcAddressRanges({ svc_name: "shopping-web" })`로 해당 서비스의 모든 주소 범위를 계산하고, `SQL WHERE addr BETWEEN from AND to`로 조회한다.

```
service prefix 주소가 인덱스 키가 되는 예:

  service:v1:65536 = { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }

  이 주소를 참조하는 곳:
    permission → perm_svc: 65536  → "이 서비스의 권한"
    endpoint   → svc_ref: 65536   → "이 서비스의 API"
    page_view  → svc_ref: 65536   → "이 서비스의 화면 관측"
    deploy_event → svc_ref: 65536 → "이 서비스의 배포"

  → DSL이 service binding으로 이 prefix들을 묶으면,
    같은 svc_ref를 공유하는 prefix들의 이벤트를 함께 추적할 수 있다.
```

### axis와 prefix_ref의 구분

| | axis | prefix_ref |
|---|---|---|
| 값 | 문자열 entry (`"admin"`, `"POST"`) | 정수 주소 (`65536`) |
| 의미 | 직접 읽을 수 있음 | 디코딩해야 의미 파악 |
| 표시 | `role: admin` | `svc_ref: service:65536 (prod/asia/shopping-web/shop)` |
| 펼침 | 없음 (그 자체가 값) | 참조된 prefix의 차원들로 펼쳐짐 |
| 인덱스 | entry 이름으로 필터 | 주소로 DB 질의 (`BETWEEN`) |

### 카테고리 (6종)

prefix의 의미적 성격을 분류한다. prefix 자체의 성격이지 소속이 아니다.

| 카테고리 | 의미 | 예시 |
|---------|------|------|
| entity | 상태/구성 — "무엇이 존재하는가" | service, content, tracking |
| event | 행위 — "무엇이 발생했는가" | cart_event, auth_event, deploy_event |
| observation | 관측 — "무엇이 관측되었는가" | page_view, endpoint, flow_point |
| policy | 접근 제어 — "누가 무엇을 할 수 있는가" | permission, rbac |
| relation | 관계 — "무엇이 어떻게 연결되는가" | relational |

### 조직 레이어

prefix 위에 3가지 조직 구조가 올라간다. prefix 자체는 이것들에 종속되지 않는다.

| 레이어 | 관계 | 역할 |
|--------|------|------|
| Domain | 1 prefix : 1 domain | 관리 편의상 소속 구분 |
| DSL Bundle | 1 prefix : N DSL | 같은 서비스 맥락에서 협력하는 prefix 묶음 |
| IntentLink | 1 prefix : N IL | 함께 관측되어야 하는 의도 선언 |

---

## 1.5. DSL Bundle, IntentLink, Domain — prefix 위의 3개 조직 레이어

prefix 위에 3가지 다른 관점의 조직 구조가 존재한다. 각각의 목적이 다르다.

### DSL Bundle — "같은 서비스에서 함께 쓰이는 prefix 묶음"

```
dsl-checkout:
  members: [page_view, endpoint, flow_point, order_event, permission]
  serviceBindingPrefix: service
  fixedDims: [env, region, svc_name, namespace]
  invariants:
    - "checkout page_view 없이 checkout flow_point(success) 관측 금지"
```

DSL Bundle은:
- 같은 **서비스 바인딩**(env, region, svc_name, namespace)을 공유하는 prefix를 묶는다
- 멤버 prefix 간 **불변조건(invariant)**을 정의한다
- 1 prefix가 **여러 DSL**에 속할 수 있다 (page_view는 dsl-checkout + dsl-observation 모두 소속)

현재 11개 DSL: observation, infra, checkout, auth, commerce, content, access-control, pipeline, dev, internal, ingest

### IntentLink — "왜 함께 관측되어야 하는가"

```
IL-checkout-flow:
  endpoints: [page_view, endpoint, flow_point, order_event, permission]
  invariant: "page_view 없이 flow_point(success) 금지"
```

IntentLink는:
- prefix 간 **의도적 연결**을 명시한다
- invariant가 실 트래픽에서 위반되면 **잘못된 데이터를 감지**한다
- co-occurrence 분석에서 **자동 발견**될 수 있다

현재 6개 IntentLink.

### Domain — "어디에 소속되는가"

```
observation-domain:
  prefixes: [page_view, endpoint, flow_point, ..., event_classification, schema_validation]
  exports: [page_view, endpoint, ...]
  internal: []
```

Domain은:
- prefix의 **소속 경계**를 구분한다
- 1 prefix는 **1개 domain에만** 속한다 (orphan 없음)
- domain health 진단의 단위

현재 6개 도메인: shopping, tracking, event, observation, infra, dev

### 3가지의 관계

```
Domain (소속)     — prefix가 어디에 속하는가     → 1:N (중복 없음)
DSL (협력)        — prefix가 누구와 함께 쓰이는가  → N:M (중복 가능)
IntentLink (의도) — prefix가 왜 함께여야 하는가   → N:M (중복 가능)
```

**Domain**은 행정 구역, **DSL**은 프로젝트 팀, **IntentLink**는 업무 계약.
한 사람(prefix)은 한 구역(domain)에 살지만, 여러 팀(DSL)에서 일하고, 여러 계약(IntentLink)에 참여한다.

---

## 2. Self-Check — "시스템이 건강한가?"

시스템의 빌드/테스트/커버리지/불변조건/흐름 정합성을 한 명령으로 진단한다.

### 작동 방식

```
qa-sdk dkg self-check [--fast] [--apply]
```

```
Phase A: 빌드/테스트 (--fast로 스킵 가능)
  ├── 26 패키지 빌드
  └── 3700+ 테스트 실행

Phase A-aggregate: 좌표 인코딩
  ├── 빌드/테스트 결과 → build_event/test_event AddressContextRecord
  └── generateSyntheticEvents(catalog) → 전체 entry 커버리지 보장

Phase B: convergence 분석
  ├── aggregateUsageData → UsageData
  ├── analyzeEntryCoverage → 커버리지 리포트
  │   observed: 인코딩 성공한 entry
  │   dormant: 카탈로그에 정의됐지만 관측 안 된 entry
  │   phantom: 카탈로그에 없는데 관측된 entry (코드 불일치!)
  └── collectMetrics → metric 이슈 감지

Phase D: DSL 불변조건
  └── dsl-dev: "빌드 실패 후 테스트 금지", "테스트 실패 시 빌드 성공 선행"

Phase E: IntentLink flow-trace
  └── traceFlows(graph, liveRecords) → IntentLink invariant 위반 감지
      합성 이벤트(synthetic)는 제외 — live 레코드만 검증
```

### prefix와의 관계

- Phase A가 생성하는 AddressContextRecord에 `build_event`, `test_event` prefix 주소 포함
- Phase B의 커버리지는 **모든 39 prefix의 모든 axis entry**를 검사
- Phase E는 IntentLink에 연결된 prefix 간 흐름을 검증

### --fast 모드

Phase A를 스킵하고 mock 결과로 대체. Phase B~E만 실행. **0.3초**.

---

## 3. Convergence — "중복이나 낭비는 없는가?"

축/prefix의 구조적 문제를 발견하고, 정리 행위를 제안한다.

### 4가지 행위

```
qa-sdk dkg converge [--persist] [--verbose]
```

#### merge (수렴)

두 축의 entry가 겹치면 병합 후보로 제안.

```
initiator: [web, mobile]
channel:   [web, mobile]
→ Jaccard 유사도 100% → merge 후보
```

단, **DEC-SEP(분리 결정)**이 활성 상태면 자동 억제:
```
DEC-SEP-initiator-channel: "도메인이 다름. 분리 유지."
→ converge chain이 이 쌍의 merge 제안을 건너뜀
```

#### deactivate (분기 정리)

실 트래픽에서 1% 미만으로 사용되는 entry → 비활성화 후보.

#### simplify (선택지 정리)

prefix에서 단일값만 사용되는 차원 → 단순화 제안.

#### observe (관측)

배포 스큐(version 혼재), 인과 관계(co-occurrence) → Observation 자동 생성.

### prefix와의 관계

- **merge**: 축(axis) 단위 비교. 같은 축을 사용하는 prefix들이 영향
- **deactivate**: 특정 prefix 내에서 사용되지 않는 axis entry 감지
- **simplify**: prefix의 차원 구조 분석
- **observe**: prefix 간 배포 version 스큐 감지

### metrics

converge가 수집하는 metric 종류:
- headroom (축 여유 공간)
- skew (version 혼재)
- overlap (축 중복)
- coverage (entry 관측)
- conflict (Decision 충돌)
- health (도메인 건강)

---

## 4. IntentLink — "이 prefix들은 왜 함께 관측되어야 하는가?"

### 정의

**두 개 이상의 prefix가 동일한 맥락에서 함께 관측되어야 한다**는 설계 의도의 명시적 선언.

DSL이 prefix를 **묶는** 것이라면, IntentLink는 **왜 함께 쓰여야 하는지**를 기술한다.

### 구조

```typescript
{
  id: "IL-checkout-flow",
  endpoints: ["page_view", "endpoint", "flow_point", "order_event", "permission"],
  via: "service",            // 이 prefix들이 공유하는 서비스 바인딩
  intent: "결제 흐름: 화면 진입 → API 호출 → 흐름 분기 → 주문 이벤트",
  invariant: "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨",
}
```

### 현재 6개

| ID | endpoints | invariant |
|----|-----------|-----------|
| IL-checkout-flow | page_view, endpoint, flow_point, order_event, permission | page_view 없이 flow_point(success) 금지 |
| IL-api-event | endpoint, event | API 호출과 이벤트가 같은 서비스에서 추적 |
| IL-infra-impact | deploy_event, health_event, endpoint | 배포 후 health(degraded) → 배포 실패 후보 |
| IL-pattern-observation | pattern_match, pattern_anomaly, flow_point | 패턴 이상 시 flow_point 시퀀스가 근거 |
| IL-cart-abandon | cart_event, order_event, tracking | cart(checkout) 없이 order(create) 비정상 |
| IL-pipeline-flow | pipeline_point, engine_event, schema_event | verdict 전 reconstruct 선행 필수 |

### 위반 감지

```
이벤트 레코드:
  address_context: { flow_point: "flow_point:v2:0", order_event: "order_event:v1:0" }
  → page_view 없음!

IL-checkout-flow invariant: "page_view 없이 flow_point(success) 금지"
  → 위반 → OBS-FLOW-IL-checkout-flow observation 자동 생성
```

self-check Phase E의 `traceFlows()`가 이 검사를 수행한다. 합성 이벤트는 제외하고 **live 레코드만** 검증.

### 발견 경로

```
실 트래픽 수집
  → co-occurrence 분석 (prefix 쌍 동시 관측)
  → rate ≥ 95% → IntentLink 후보
  → 인간 검토 → dkg 등록
  → traceFlows가 invariant 검증
  → 위반 시 observation → 잘못된 데이터 식별
```

---

## 5. Co-occurrence — "어떤 prefix가 함께 나타나는가?"

### 정의

하나의 이벤트 레코드에 **여러 prefix의 address_context가 동시에 포함**되는 패턴.

```
이벤트 레코드:
  address_context: {
    tracking: "tracking:v2:0",
    page_view: "page_view:v2:0",
    endpoint: "endpoint:v1:32",
  }

co-occurrence:
  tracking ↔ page_view: count++
  tracking ↔ endpoint: count++
  page_view ↔ endpoint: count++
```

### 측정

`aggregateUsageData()`가 이벤트 레코드를 집계할 때 co-occurrence를 자동 계산.

결과:
```
{ sourcePrefix: "page_view", targetPrefix: "endpoint", count: 26, totalSourceCount: 26 }
→ rate = 26/26 = 100% → 이 쌍은 항상 함께 관측됨
```

### IntentLink 자동 발견

```
qa-sdk dkg discover-links
```

```
상위 co-occurrence 패턴:
  page_view → endpoint: 26건 (rate 100%) [이미 등록: IL-checkout-flow]
  tracking → page_view: 26건 (rate 72%)
  tracking → endpoint: 26건 (rate 72%)
```

기존 IntentLink와 매칭되면 `[이미 등록]` 표시. 새로운 패턴이 임계값을 넘으면 IntentLink 후보로 추천.

### 임계값

| 수준 | rate | count | 추천 |
|------|------|-------|------|
| high | ≥ 95% | ≥ 1000 | IntentLink 후보 |
| medium | ≥ 80% | ≥ 500 | constraint 후보 |
| low | ≥ 50% | ≥ 100 | 추가 관찰 |

### prefix와의 관계

co-occurrence는 **prefix 쌍** 단위로 측정. 한 이벤트에 N개 prefix가 있으면 N×(N-1)/2개의 co-occurrence 쌍이 발생.

---

## 6. TransitionSpec — "이 이벤트로 무엇이 되었는가?"

### 정의

이벤트 시퀀스에 **상태 전이 의미**를 부여하는 해석 규칙.

좌표가 "이 이벤트가 발생했다"를 기록한다면, TransitionSpec은 "이 이벤트로 **상태가 바뀌었다**"를 해석한다.

### 구조

```typescript
// user.login — 로그인 전이
{
  transition: "user.login",
  version: "v1",
  match: {
    mode: "ordered",          // 3개 좌표를 순서대로 매칭
    coordinates: [
      { resource_type: "api", http_method: "POST", api_version: "v1" },  // endpoint
      { auth_action: "login" },                                           // auth_event
      { flow_name: "login", flow_step: "success", flow_variant: "default" }, // flow_point
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",    // 세션 식별
    resource_id: "$.events[0].actor_id",      // 사용자 식별
  },
  input: { all: [] },                         // 전제조건 없음 (open effect)
  output: { set: [{ axis: "lifecycle_state", value: "active" }] },
  effect: { kind: "open" },                   // 새 상태 생성
}
```

### match mode

| mode | 의미 |
|------|------|
| single | 이벤트 1개만 매칭 |
| ordered | 여러 이벤트를 순서대로 매칭 (greedy) |

### effect kind

| effect | 의미 |
|--------|------|
| create | 새 리소스 생성 |
| update | 기존 상태 변경 |
| open | 세션/루프 시작 |
| close | 세션/루프 종료 |
| move | 리소스 위치 변경 |
| consume | 리소스 소비 |

### 동작 흐름 (7단계 파이프라인)

```
이벤트 시퀀스
  │ 1. collect — timestamp 정렬
  │ 2. match — 좌표 패턴 매칭
  │ 3. bind — context_id, resource_id 추출
  │ 4. load — StateStore에서 현재 상태
  │ 5. validate — input 조건 검증
  │ 6. apply — output 상태 적용
  │ 7. emit — TransitionInstance 생성
  ▼
TransitionInstance
  { transition_name, context_id, resource_id,
    input_snapshot, output_snapshot, effect_kind }
```

### prefix와의 관계

TransitionSpec의 `match.coordinates`는 **디코딩된 축 값**을 사용한다.

```
address_context: { endpoint: "endpoint:v1:32" }
  → decodeAddressContext → { resource_type: "api", http_method: "POST", api_version: "v1" }
  → match: { resource_type: "api", http_method: "POST", api_version: "v1" } ✅ 매칭!
```

여러 prefix를 참조하는 TransitionSpec은 **여러 이벤트에 걸쳐 순서대로 매칭**된다. 각 이벤트가 다른 prefix의 address_context를 가지고 있어도 됨.

### 현재 32개 TransitionSpec

결제, 인증, 장바구니, 배포, 파이프라인, DKG 운영, 패턴 분류 등 전 도메인.

### 실 트래픽 검증

```
3 events (ordered):
  endpoint:v1:32    → { resource_type: "api", http_method: "POST" }
  auth_event:v1:0   → { auth_action: "login" }
  flow_point:v2:4192 → { flow_name: "login", flow_step: "success" }

→ user.login spec 매칭 성공 (instances=1, effect=open)
→ lifecycle_state = "active" 상태 설정
```

---

## 구성 요소 간 관계

```
Prefix (39)
  │ 축 조합 → 주소 공간 정의
  ▼
IntentLink (6)
  │ "이 prefix들은 함께 관측되어야 한다"
  │ invariant 정의
  ▼
Co-occurrence
  │ 실 트래픽에서 prefix 동시 관측 비율 분석
  │ IntentLink 자동 발견 경로
  ▼
TransitionSpec (32)
  │ 디코딩된 prefix 좌표로 이벤트 시퀀스 매칭
  │ 상태 전이 해석
  ▼
Self-Check (5 phases)
  │ 커버리지 + invariant + flow-trace 통합 진단
  ▼
Convergence (4 행위)
  │ 축/prefix 중복·낭비 정리
  │ DEC-SEP로 이미 결정된 건 자동 억제
  ▼
관측 루프
  │ observation → decision → resolve
  │ 30일 monitoring 자동 만료
```
