---
def:
  tier: component
  id: meta-semantic-philosophy
  type: spec
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [entry-point]
  links:
    - target: meta-semantic-system
      type: traces_to
  sources:
    - packages/core/src/meta-semantic/extraction.ts
    - packages/core/src/meta-semantic/extraction.test.ts
    - packages/core/src/meta-semantic/ir-types.ts
    - packages/core/src/meta-semantic/ir-bridge.ts
    - packages/core/src/pipe/pipe-path.ts
    - packages/core/src/pipe/pipe-segment.ts
---

# Meta-Semantic 설계 철학

## 목적 ^purpose

meta-semantic 시스템의 설계 판단 근거가 되는 핵심 원칙을 정의한다.
구현이 바뀌어도 이 원칙은 유지된다.

---

## 원칙 1 — Folding이 먼저, 좌표는 그 다음

```
소스 코드 → Semantic Folding → 검증 가능한 단위 식별 → 분기 경로 수집 → 좌표 할당
```

좌표를 부여하려면 먼저 **대상**을 정해야 한다.
모든 변수, 모든 함수에 좌표를 부여하면 주소 공간이 폭발한다.
Folding으로 독립 검증 가능한 단위만 선별한 후에야 좌표화한다.

**귀결:**
- Folding이 선행되지 않으면 좌표 체계가 성립하지 않는다
- 좌표화 가치가 있는 코드 = 독립적으로 검증 가능한 코드
- 내부 헬퍼, getter/setter, 타입 가드는 좌표화 대상이 아니다

---

## 원칙 2 — 경로 합산, 전곱 금지

전체 변수의 전곱(N×M)이 아니라, **이벤트별 도달 가능한 경우의 수만 수집**한다.

```
❌ 전곱: 3 × 4 × 2 = 24 (도달 불가능한 조합 포함)
✓ 합산: (3×4) + (3×2) = 18 (도달 가능한 경로만)
```

**귀결:**
- 각 독립 경로를 별도 WeightedIndex로 인코딩하고 주소 범위를 연접
- 주소 공간은 도달 가능한 경로 수에 비례 (전곱의 지수적 증가 방지)
- 경로 추가 시 기존 주소 불변, 새 세그먼트만 연접

### 카탈로그 관리 표준

경로 합산은 "주소를 어떻게 계산하느냐"뿐 아니라
**"prefix를 어떻게 관리하느냐"**까지 표준화해야 한다.

현재 카탈로그의 PrefixDef는 **전곱 전용** 구조다:

```
PrefixDef.dims: { orderType: axis(3), paymentMethod: axis(4), shippingOption: axis(2) }
→ WeightedIndex([3, 4, 2]) = 24 주소 (축 전곱, 단일 인스턴스)
```

경로 합산 모델에서는 **같은 prefix가 여러 세그먼트**를 가진다:

```
PathSegment[]:
  seg[0]: orderType(3) × paymentMethod(4)   = 12 주소  [0..11]
  seg[1]: orderType(3) × shippingOption(2)  = 6 주소   [12..17]
→ 총 18 주소 (경로 합산)
```

**카탈로그가 관리해야 하는 것:**

| 항목 | 전곱 모델 (현재) | 합산 모델 (확장) |
|------|-----------------|-----------------|
| 주소 공간 크기 | `Π(capacities)` | `Σ(segment sizes)` |
| prefix 당 인스턴스 | WeightedIndex 1개 | WeightedIndex N개 |
| 세그먼트 등록 | 불필요 | segment registry 필요 |
| 주소 → 경로 역추적 | 불필요 (축 역연산) | offset 범위로 segment 식별 |
| 세그먼트 추가 | N/A | append-only, 기존 offset 불변 |
| 용량(headroom) | 축별 headroom | 세그먼트별 headroom + 전체 headroom |

**표준화 규칙:**
1. prefix는 `addressModel: "product" | "sum"` 선언 필수
2. `"sum"` prefix는 `segments: PathSegment[]` 보유
3. 세그먼트 추가는 append-only (기존 주소 불변 보장)
4. segment registry가 prefix 라이프사이클과 동기화
5. 전곱 prefix는 segments 길이 1인 합산의 특수 케이스로 통합 가능
6. 세그먼트 재귀 깊이 제한 없음 — 비즈니스 흐름이 깊이를 결정
7. 분기 경로 끝에서 다른 이벤트로 전이(transition) 가능 — 이벤트 간 흐름 토폴로지

**합산 = 이벤트 분기의 명시적 표현:**
경로 합산의 목적은 주소 최적화가 아니라, 이벤트가 어떤 분기점에서
어떤 하위 경로로 갈라지는지를 카탈로그에 기록하는 것이다.
분기 끝에서 다른 이벤트로 넘어가는 전이(transition)는
PipeGraph의 event connection과 동일한 개념의 정적 선언이다.

---

## 원칙 3 — 수집과 해석의 분리

코드 단위 하나만 보고 결정할 수 있는 것(수집)과,
여러 단위를 연결해야 알 수 있는 것(해석)을 분리한다.

| 계층 | 질문 | 입력 |
|------|------|------|
| **레이어 1 (수집)** | "이 단위가 무엇인가" | 코드 한 단위 |
| **레이어 2 (해석)** | "이 단위들이 어떤 관계인가" | 수집된 단위 그래프 |

**레이어 1 → 레이어 2 단방향.** 해석이 수집을 변경하지 않는다.

**귀결:**
- 패싯, 바운더리, 파이프, scope, layer, concern → 레이어 1 (단위 속성)
- lifecycle, link_type, concern 전파, layer 영향 전파 → 레이어 2 (관계)
- 해석 결과가 수집 단위의 정의를 바꾸면 안 됨

---

## 원칙 4 — Module·Data·Pipe 직교

코드의 의도를 3가지 직교 축으로 분해한다.

| IR | 공간 | 시간 | 질문 |
|---|---|---|---|
| Module | 정적 | 불변 | **어디에** 로직이 있는가 (구조) |
| Data | 준정적 | 변경 추적 | **무엇이** 흐르는가 (상태) |
| Pipe | 동적 | 생성자 | **언제** 변하는가 (실행) |

**귀결:**
- 하나의 코드가 세 축 모두에 투영될 수 있음
- Module이 Data를 소유하고, Pipe가 Module을 트리거
- 계약은 **하향 위임** (parent → children), 트랜잭션은 **상향 전달** (pipe → module)

---

## 원칙 5 — 문서 좌표 × 코드 좌표 = 완전한 추적

```
definition-catalog     "문서가 무엇을 정의하는가"     → def_document:v2:N
meta-semantic          "코드가 무엇을 의도하는가"     → intent:v1:M

문서 좌표 × 코드 좌표 = 양방향 추적
```

두 좌표계는 **같은 수학**(WeightedIndex)을 사용하지만 **다른 차원**을 인코딩한다.
문서는 scope×aspect×depth×seq, 코드는 function×path×tx_seq.

**귀결:**
- `@def.doc` 주석으로 코드↔문서 양방향 링크
- ModuleIR ≡ DefinitionEntry (좌표가 부여된 구조 단위)
- DataIR.definition ≡ AxisDef (차원의 스키마 형태)
- PipeIR ≡ EventRecord (좌표가 부여된 실행 이벤트)

---

## 원칙 6 — 검증 가능성이 좌표화 기준

좌표를 부여할 가치가 있는 코드 = **독립적으로 검증 가능한 코드**

```
✓ 좌표화 대상:
  - 명확한 입력/출력 타입을 가진 비즈니스 로직 함수
  - 식별 가능한 부수효과를 가진 서비스 메서드
  - 독립적으로 테스트 가능한 순수 함수

✗ 좌표화 제외:
  - 내부 헬퍼 (외부 계약 없음)
  - getter/setter (로직 없음)
  - 타입 가드/유틸리티 (분기 없음)
```

**귀결:**
- LLM이 "이 함수는 독립 테스트 가능한가?" 판단 (의미적)
- AST 파서가 시그니처/조건식/타입 추출 (구조적)
- 의미적 판단과 구조적 사실은 역할 분리

---

## 원칙 7 — 패싯은 역할 분리이고, 스키마는 좌표에 바인딩된다

데이터의 5가지 역할(생산·소비·정의·관리·저장)은 반드시 분리한다.

이것은 "데이터를 5개로 쪼개라"가 아니라,
**"하나의 데이터가 어떤 역할로 사용되고 있는지 식별하라"**는 설계 규칙이다.

### 역할 분리의 귀결

- 같은 데이터도 역할에 따라 다른 바운더리에서 관리
- 변형은 생산+저장의 조합으로 추적
- 각 역할은 독립적으로 존재할 수 있음
- n개 모듈이 같은 Data를 공유하면 상위 계층에 관리 위임

### 스키마 → prefix → 주소 → 계보

패싯 역할을 식별한 데이터는 **스키마(DataSchema)**로 정의되고,
스키마는 **prefix 주소 공간에 바인딩**되어 고유 식별 가능한 객체가 된다.

```
DataSchema (컬럼 + 패싯 역할 매핑)
  → prefix의 축으로 등록 (table_ref 또는 axis_ref)
    → 데이터 인스턴스에 주소 부여 (prefix:version:address)
      → 필드 단위 계보 추적 (LineageCollector)
        → 스키마 버전 간 호환성 검증 (VersionCollector)
```

**이 체인이 동작해야 하는 이유:**
- 스키마가 prefix에 바인딩되지 않으면 데이터가 좌표계에 진입하지 못한다
- 좌표가 없으면 "이 필드가 어디서 왔는가"(계보)를 추적할 수 없다
- 계보가 없으면 스키마 변경의 영향 범위를 알 수 없다

**귀결:**
- DataSchema의 각 컬럼은 facetRole(produced/consumed/derived/managed/identity)을 선언
- identity 역할 컬럼이 prefix 주소의 저장 식별자
- 파이프 step의 dataContract(consumes/produces/accesses)가 계보의 입력
- 시뮬레이션 결과(SimulationResult)에서 계보를 자동 추출(extractLineageFromSimulation)

### 좌표 모델과 계보의 관계

데이터 계보를 추적하려면 데이터가 **어떤 주소 모델로 좌표화되었는지** 알아야 한다.
전곱과 합산은 계보 해석 방식이 다르다.

| 주소 모델 | 계보 해석 | 참조 |
|----------|----------|------|
| **전곱(product)** | 모든 축이 동등 — 필드 변환 경로가 축 조합으로 결정 | 원칙 2, `prefix-path-summation` |
| **합산(sum)** | 세그먼트별 분기 — 필드가 어떤 분기 경로를 거쳤는지 추적 | `prefix-path-summation`, `meta-semantic-spacetime-uid` |

```
전곱 계보:
  orders.amount → payments.amount (direct)
  → 축 조합으로 "어떤 주문 유형×결제 방법인가" 식별
  → 주소 디코딩만으로 맥락 복원

합산 계보:
  orders.amount → payments.amount (direct)
  → 세그먼트로 "이 변환이 card 경로인가 bank 경로인가" 식별
  → 세그먼트 + route로 분기 맥락까지 복원
  → transition으로 다른 이벤트의 계보와 연결
```

> 좌표 모델 상세: `prefix-path-summation` 참조
> 분기 경로 수집 규칙: `ms-concept-branch-path` 참조
> 시공간 주소 체계: `meta-semantic-spacetime-uid` 참조
> 데이터 계약 + 계보: `meta-semantic-data-contract` 참조

---

## 원칙 간 관계

```
(6) 검증 가능성
  ↓ 기준 제공
(1) Folding이 먼저 → 단위 식별
  ↓ 단위 확정
(7) 패싯 역할 분리 → 데이터 스키마 정의
  └── DataSchema → prefix 바인딩 → 주소 부여 → 계보 추적
(4) Module·Data·Pipe 직교 → IR 분해
  ↓ 좌표 대상 확정
(2) 경로 합산 → 주소 할당
  └── 카탈로그 관리 표준 → segment registry + addressModel
(5) 문서×코드 = 추적 → 양방향 링크
  ↓ 관계 구축
(3) 수집/해석 분리 → 레이어 1 → 레이어 2
```

---

## 이 문서가 아닌 것

- 구현 상세 → `meta-semantic-system` (group)
- 개별 개념 정의 → `concepts/ms-concept-*` (9 leaves)
- IR 타입 상세 → `meta-semantic-ir/` (3 leaves)
- 파이프 구현 → `pipe-impl/` (16 leaves)
