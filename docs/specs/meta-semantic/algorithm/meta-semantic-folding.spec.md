---
def:
  id: meta-semantic-folding
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural, entry-point]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-ir
      type: depends_on
    - target: meta-semantic-extraction
      type: depends_on
    - target: ms-concept-branch-path
      type: depends_on
---

# Semantic Folding — 검증 단위 식별의 핵심 메커니즘

## 목적 ^purpose

코드 구조를 계층별로 접고(fold) 펼쳐서(unfold) **검증 가능한 실행 단위(함수)를 식별**하는
이 시스템의 핵심 메커니즘. 단순한 시각화 기법이 아니라,
**"무엇을 좌표화할 것인가"를 결정하는 사전 단계**다.

좌표를 부여하려면 먼저 대상을 정해야 한다.
모든 변수, 모든 함수, 모든 줄에 좌표를 부여하면 주소 공간이 폭발한다.
Semantic Folding은 코드를 접어서 **독립적으로 검증 가능한 단위**만 선별하고,
그 단위 내의 **의미 있는 분기점만 추출**하여 좌표화 대상을 한정한다.

## 방법 ^method

**3단계 접기 레벨**(System·Module·Leaf)이 코드 구조를 계층별로 축소하고,
**검증 가능성 판정**이 독립 테스트 가능한 함수만 선별하고,
**분기 경로 한정**이 전곱이 아닌 도달 가능 경로만 수집하고,
**계약 도출**이 접힌 인터페이스에서 테스트 기준점을 추출하고,
**타입 확실성 시각 인코딩**이 strict/flexible을 시각적으로 구분한다.

## 정의 ^defines

- Semantic Folding의 정체성: 시각화가 아닌 검증 단위 식별 메커니즘
- 3단계 접기 레벨 (System · Module · Leaf)
- 검증 가능성 판정 기준
- 분기 경로 한정 원칙 (전곱 방지)
- 접힘 상태에서의 계약 도출
- 타입 확실성 시각적 인코딩

## 소비 ^consumes

- `ModuleIR` (meta-semantic-ir) — 계층 구조, interface
- `DataIR` (meta-semantic-ir) — certainty, management
- `PipeIR` (meta-semantic-ir) — 트랜잭션 흐름
- `DefLevel` (definition-catalog) — group/module/leaf
- `DefLayer` (definition-catalog) — domain/operation/mediation/experience

## 구성 ^overview

Semantic Folding이 수행하는 3가지 핵심 역할:

1. **검증 단위 식별**: 코드를 접어서 독립 검증 가능한 함수 경계를 찾는다
2. **분기 경로 한정**: 전체 변수 전곱이 아닌 도달 가능한 경로만 수집한다
3. **계약 도출**: 접힌 인터페이스에서 테스트 기준점을 추출한다

시각화는 이 메커니즘의 **부산물**이다 — 접기/펼치기가 자연스럽게 시각적 줌 레벨을 생성한다.

---

## 1. 왜 Folding이 먼저인가

### 좌표화의 전제 조건

```
문제: 10만 줄 코드에 좌표를 부여하고 싶다
  → 모든 변수에 좌표? → 주소 공간 폭발 (3^100)
  → 모든 함수에 좌표? → 대부분 헬퍼/유틸 (좌표화 가치 없음)
  → 모든 분기에 좌표? → null 체크, 에러 처리 포함 (노이즈)

해결: Semantic Folding
  → 접어서 독립 검증 가능한 단위만 노출
  → 그 단위의 의미 있는 분기만 추출
  → 도달 가능한 경로만 좌표화
```

Folding이 선행되지 않으면 좌표 체계가 성립하지 않는다.

### 검증 가능성이 좌표화 기준

**좌표를 부여할 가치가 있는 코드 = 독립적으로 검증 가능한 코드**

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

---

## 2. 3단계 접기 레벨

### 레벨 정의

| Level | 코드 구조 | DefLevel | 접었을 때 보이는 것 |
|---|---|---|---|
| **L0 System** | 패키지, 앱 경계 | `group` | 시스템 간 데이터 흐름 (화살표만) |
| **L1 Module** | 클래스, 서비스 | `module` | 모듈 간 계약 (interface만) |
| **L2 Leaf** | 함수, 메서드 | `leaf` | 검증 단위 + 분기 경로 그래프 |

### 접기가 결정하는 것

```
L0 접기: 10만 줄 → 5개 시스템 블록
  "PaymentSystem, OrderSystem, NotificationSystem, AuthSystem, UserSystem"
  → 이 레벨에서는 분기 경로 불필요 (데이터 흐름만)

L1 펼치기: PaymentSystem 내부 → 3개 모듈
  "PaymentValidator, PaymentProcessor, ReceiptGenerator"
  → 이 레벨에서도 분기 경로 불필요 (계약만)

L2 펼치기: PaymentProcessor 내부 → 2개 함수
  "processPayment(), refundPayment()"
  → 이 레벨에서 분기 경로 추출 시작!
  → processPayment: orderType(3) → paymentMethod(4) → 3×4 = 12 경로
```

### 접기/펼치기 규칙

```
L0: [PaymentSystem] ──DataFlow──→ [OrderSystem]
      │
      ▼ unfold
L1: [PaymentValidator] ──→ [PaymentProcessor] ──→ [ReceiptGenerator]
      │                        │
      │                        ├── interface: PaymentInput → PaymentResult
      │                        └── sideEffects: [db, gateway]
      ▼ unfold
L2: processPayment():
    ├── 분기A: orderType (3: normal, express, subscription)
    │     ├── → paymentMethod (4): 3 × 4 = 12 경로
    │     └── → shippingOption (2): 3 × 2 = 6 경로
    └── 총: 18 경로 ← 좌표화 대상
```

---

## 3. 분기 경로 한정 원칙

### 전곱 방지 = Folding의 핵심 가치

Folding 없이 모든 분기를 곱하면:

```
100개 변수 × 평균 3개 분기 = 3^100 ≈ 5 × 10^47 주소
→ 관리 불가능
```

Folding으로 한정하면:

```
L0 접기: 100개 변수 → 5개 시스템으로 축소
L1 접기: 각 시스템 → 3~5개 모듈로 축소
L2 접기: 각 모듈 → 2~5개 검증 가능 함수로 축소
분기 추출: 각 함수의 도달 가능 경로만 수집

결과: 50개 함수 × 평균 18 경로 = 900 좌표
→ 완벽하게 관리 가능
```

### 경로 수집 규칙

```
함수 내 분기점 A, B, C, D가 있을 때:

A(3개 분기)에서 도달 가능한 다음 분기점:
  A → B(4개 분기): 3 × 4 = 12 경로
  A → C(2개 분기): 3 × 2 = 6 경로
  (D는 A에서 도달 불가능 → 별도 진입점)

총 경로: 12 + 6 = 18
  ≠ 3 × 4 × 2 = 24 (전곱)
  ≠ 3 × 4 × 2 × D분기 (전체 전곱)
```

### 의미 없는 분기 제외

LLM이 판단하여 좌표화 가치가 없는 분기를 제외:

| 분기 유형 | 좌표화 포함 여부 | 이유 |
|---|---|---|
| `if (type === 'card')` | ✓ | 비즈니스 로직 분기 |
| `switch (orderStatus)` | ✓ | 상태 기반 분기 |
| `if (input == null)` | ✗ | 방어적 null 체크 |
| `try { } catch { }` | ✗ | 에러 처리 |
| `if (DEBUG)` | ✗ | 개발 도구 |
| `if (featureFlag)` | 상황별 | LLM 판단 |

---

## 4. 접힌 상태에서의 계약 도출

### 원칙

접힌 모듈의 interface는 **Contract Test의 기준점**이다.
Folding은 자연스럽게 각 레벨에서의 계약을 드러낸다.

### L1 계약 (모듈 레벨)

```typescript
interface FoldedModuleContract {
  moduleId: string;

  /** 입출력 계약 — 이것이 바뀌면 상위 레벨에 영향 */
  interface: {
    inputs: DataRef[];
    outputs: DataRef[];
    sideEffects: PipeRef[];
  };

  /** 내부 복잡도 요약 — 접힌 상태에서도 힌트 제공 */
  summary: {
    leafCount: number;          // 검증 가능 함수 수
    totalPaths: number;         // 총 분기 경로 수
    strictRatio: number;        // strict 데이터 비율 (0~1)
    sideEffectCount: number;    // 외부 부수효과 수
  };

  /** 횡단 관심사 */
  concerns: string[];
}
```

### L2 계약 (함수 레벨)

```typescript
interface FoldedFunctionContract {
  functionId: string;

  /** 함수 계약 */
  params: DataRef[];
  returnType: DataRef;
  sideEffects: PipeRef[];

  /** 분기 경로 요약 */
  branchSummary: {
    entryBranches: number;       // 진입 분기 수
    totalPaths: number;          // 총 도달 가능 경로 수
    segments: number;            // 독립 경로 세그먼트 수
  };
}
```

### definition-catalog 연동

```
접힌 ModuleIR ──→ definition-catalog 문서의 ^contract 마커
  ↓ 비교
interface 불일치 → drift warning
분기 수 변경 → 좌표 공간 확장 알림
```

---

## 5. 타입 확실성 시각화

### 시각 인코딩 규칙

Folding의 부산물로 각 레벨에서 타입 확실성이 자연스럽게 드러난다:

| certainty | 시각적 형태 | 경계 | 색상 계열 | 의미 |
|---|---|---|---|---|
| `strict` | 단단한 다각형 | 실선 | 차가운 색 (파랑/초록) | 타입 안전, 계약 명확 |
| `flexible` | 흐릿한 구름 | 점선/그라데이션 | 따뜻한 색 (주황/빨강) | 런타임 취약, 주의 |

### 전파 규칙

```
접힌 모듈의 strictRatio = strict 데이터 수 / 전체 데이터 수
  → 비율이 높으면 단단한 블록으로 시각화
  → 비율이 낮으면 흐릿한 블록으로 시각화
  → 하나라도 flexible이 있으면 시각적 경고
```

### certainty 판정

```typescript
function isFlexibleType(typeStr: string): boolean {
  const flexible = ['any', 'unknown', 'Record<string, any>', 'object'];
  return flexible.some(f => typeStr.includes(f))
    || /\bT\b/.test(typeStr);  // 미해소 제네릭
}
```

---

## 6. 시각화 투영 (Folding의 부산물)

### 2D 캔버스 매핑

```
x축 ── 데이터 흐름 방향 (왼→오)
y축 ── 계층 깊이 (위→아래) / DefLayer별 배치
색상 ── certainty (파랑=strict, 빨강=flexible)
크기 ── 내부 복잡도 (totalPaths)
선 굵기 ── 데이터 흐름량 (참조 빈도)
```

### DefLayer → y축 배치

| layer | y 위치 | 존재 이유 |
|---|---|---|
| `experience` | 최상단 | 사용자 행동 유도 |
| `mediation` | 중상단 | 진실을 소비 가능하게 변환 |
| `operation` | 중하단 | 시스템 인프라 |
| `domain` | 최하단 | 비즈니스 진실 (기반) |

### 상호작용

| 동작 | 효과 |
|------|------|
| 블록 클릭 | unfold (다음 레벨 노출) |
| 블록 더블클릭 | 소스 코드로 이동 |
| DataIR 호버 | 스키마 필드 + certainty 표시 |
| 줌 아웃/인 | fold/unfold 자동 전환 |

---

## 7. 시간 축 시각화

### 분기 경로 궤적 뷰

```
│ path
│
│  ·──·──·──·──·  (normal×card 경로 실행 궤적)
│
│        ·──·     (express×bank 경로)
│
│  ·              (subscription×crypto 경로 — 드문 실행)
│
└──────────────── tx_seq →
```

### 경로별 히트맵

```
              normal  express  subscription
card            ████    ██      ·
bank            ██      ████    ·
crypto          ·       ·       █
point           ██████  ██      ·
```

각 셀 = 해당 경로의 실행 빈도. 빈 셀 = 도달 불가능(좌표 없음).
전곱이었다면 모든 셀이 존재했겠지만, 경로 모델에서는 도달 가능한 셀만 존재한다.

---

## 8. Folding과 Extraction의 관계

Folding과 Extraction은 같은 활동의 다른 측면이다:

- **Folding** = 전략 (strategy): 3단계 레벨에서 **무엇을** 접을 것인가
- **Extraction** = 구현 (implementation): 코드에서 **어떻게** 그것을 찾고 추출할 것인가

Folding이 "L2에서 이 함수가 독립 검증 가능한가?"라는 질문을 정의하면,
Extraction이 "LLM + AST 파서로 그 질문에 답한다."

> Extraction 상세: `meta-semantic-extraction` 참조

---

## 9. 범위와 제약

### 현재 범위

- Semantic Folding 3단계 레벨 (L0 System, L1 Module, L2 Leaf) 정의
- 검증 단위 식별 기준
- 분기 경로 한정 원칙 (전곱 방지)
- 접힌 계약 도출 스키마
- 타입 확실성 시각 인코딩

### 명시적 비범위

- 렌더링 엔진 선택 (구현 단계에서 결정)
- 실시간 업데이트 (후속 과제)
- 3D 시각화 (현재는 2D 투영만 정의)
- 자동 리팩터링 제안 (Folding 결과로부터)
