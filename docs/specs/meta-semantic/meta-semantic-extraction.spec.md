---
def:
  id: meta-semantic-extraction
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-ir
      type: depends_on
    - target: meta-semantic-folding
      type: depends_on
    - target: ms-concept-verification-unit
      type: depends_on
---

# Meta-Semantic Extraction — LLM 기반 검증 단위 식별

## 목적 ^purpose

코드에서 **검증 가능한 실행 단위(함수)**를 LLM이 식별하고,
각 단위 내의 **의미 있는 분기점**을 추출하여 좌표화 대상을 결정한다.
AST를 기계적으로 전수 변환하는 것이 아니라,
LLM의 의미적 판단으로 "이 함수는 독립 테스트 가능한가?",
"이 분기는 의미 있는 경우의 수인가?"를 결정한다.

## 방법 ^method

**LLM↔파서 역할 분리**에서 LLM은 의미적 판단(함수 경계, 분기 의미)을,
AST 파서는 구조적 사실(시그니처, 조건식, 타입)을 담당하고,
**식별 파이프라인**이 Semantic Folding(접기) → 검증 단위 판정 → 분기점 추출 →
경로 수 계산의 4단계로 좌표화 대상을 결정하고,
**스키마 해시**가 DataIR의 구조적 정체성을 결정론적으로 계산하고,
**기존 마커 시스템**(^intent, ^contract, ^branches, @def.doc)이 LLM 판단 힌트를 제공한다.

## 정의 ^defines

- LLM 기반 실행 단위 식별 기준
- 의미 있는 분기점 판별 규칙
- 분기 경로 그래프 구축 방법
- LLM↔AST 파서 역할 분리 원칙
- 기존 마커/주석 시스템과의 통합

## 소비 ^consumes

- LLM (코드 의미 판단 — 함수 경계, 분기 의미, 의존 중요도)
- TypeScript Compiler API (구조적 사실 — AST 노드, 타입 정보)
- `definition-catalog/extract.ts` — `findMarkedSections()` 마커 추출
- `definition-catalog/code-references.ts` — `@def.doc` 주석 파싱
- `ModuleIR`, `DataIR`, `PipeIR` (meta-semantic-ir)

## 구성 ^overview

2가지 핵심 원칙:

1. **역할 분리**: LLM은 의미적 판단, AST 파서는 구조적 사실 추출
2. **분기 경로 수집**: 전체 변수 전곱이 아닌 이벤트별 도달 가능 경로만 좌표화

---

## 1. LLM↔파서 역할 분리

### 원칙: "판단은 LLM, 사실은 파서"

| 작업 | LLM의 역할 (의미적 판단) | 파서의 역할 (구조적 사실) |
|------|---|---|
| 함수 경계 | "이 함수는 단독 테스트 가능한가?" | 함수 시그니처, 파라미터 타입 추출 |
| 분기점 | "이 if/switch가 의미 있는 분기인가?" | 조건문 노드 위치와 조건식 추출 |
| 분기 수 | "이 분기의 실제 경우의 수는?" | enum 멤버 수, union 타입 수 세기 |
| 의존 관계 | "이 호출이 핵심 의존인가?" | import 그래프, 호출 체인 추출 |
| 부수효과 | "이 호출이 외부 상태를 변경하는가?" | 메서드 호출 패턴 추출 |
| 데이터 구조 | "이 타입이 좌표화할 가치가 있는가?" | 인터페이스 필드, 타입 해시 |

### LLM 판단 기준

```
"이 함수는 독립 검증 가능한 실행 단위인가?"
  ✓ 명확한 입력/출력 타입이 있다
  ✓ 부수효과가 식별 가능하다 (또는 없다)
  ✓ 다른 함수와 독립적으로 테스트할 수 있다
  ✗ 내부 헬퍼로만 사용되고 외부 계약이 없다 → 좌표화 제외
  ✗ 단순 getter/setter → 좌표화 제외
```

```
"이 분기는 의미 있는 경우의 수인가?"
  ✓ 비즈니스 로직이 다르게 동작한다 (if paymentType === 'card')
  ✓ 다른 부수효과를 유발한다 (경로에 따라 다른 API 호출)
  ✗ 에러 처리 분기 (try/catch) → 분기 수에 포함 안 함
  ✗ null 체크 → 분기 수에 포함 안 함
  ✗ 로깅 분기 → 분기 수에 포함 안 함
```

---

## 2. 분기 경로 수집

### 전곱 vs 경로 모델

```
❌ 전곱 모델: 변수A(3) × 변수B(4) × 변수C(2) = 24
   → 모든 조합이 존재한다고 가정, 대부분 도달 불가능

✓ 경로 모델: 실행 흐름을 따라가며 수집
   변수A(3개 분기)
     ├── A → B(4개 분기): 3 × 4 = 12
     └── A → C(2개 분기): 3 × 2 = 6
   총: 12 + 6 = 18 (도달 가능한 경로만)
```

### 분기 경로 그래프 구축

```typescript
interface BranchPoint {
  /** 분기점 ID (함수명:줄번호) */
  id: string;
  /** 분기 수 — LLM이 "의미 있는" 것만 카운트 */
  branches: number;
  /** 이 분기점에서 도달 가능한 다음 분기점들 */
  reachable: BranchPointRef[];
  /** 분기 라벨 (각 경우의 이름) */
  labels: string[];
}

interface ExecutionUnit {
  /** 함수/메서드 식별자 */
  functionId: string;
  /** 이 실행 단위의 진입 분기점 */
  entryPoint: BranchPoint;
  /** 분기 경로 그래프 — DAG */
  branchGraph: BranchPoint[];
  /** 총 경로 수 = Σ(경로별 분기 수의 곱) */
  totalPaths: number;
}
```

### 경로 수 계산 예시

```
processOrder():
  entryPoint: orderType (3: normal, express, subscription)
    ├── reachable: paymentMethod (4: card, bank, crypto, point)
    │   └── reachable: (없음) ← 말단
    └── reachable: shippingOption (2: standard, sameDay)
        └── reachable: (없음) ← 말단

경로 수 계산:
  path1: orderType × paymentMethod = 3 × 4 = 12
  path2: orderType × shippingOption = 3 × 2 = 6
  totalPaths = 12 + 6 = 18
```

---

## 3. 식별 파이프라인

```
소스 코드
  │
  ▼
┌───────────────────────────────────────────────────┐
│  1. Semantic Folding (접기)                        │
│  - L0: 패키지/모듈 경계 식별 → group ModuleIR      │
│  - L1: 클래스/서비스 경계 식별 → module ModuleIR    │
│  - L2: 함수 경계 식별 → leaf ModuleIR 후보         │
│  도구: LLM + 파일 구조 + import 그래프              │
└───────────────────┬───────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│  2. 검증 단위 판정                                 │
│  - LLM: "이 함수는 독립 테스트 가능한가?"           │
│  - 기준: 명확한 I/O, 식별 가능한 부수효과            │
│  - 결과: 좌표화 대상 함수 목록                      │
│  도구: LLM 판단                                    │
└───────────────────┬───────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│  3. 분기점 추출                                    │
│  - LLM: "이 분기가 의미 있는 경우의 수인가?"         │
│  - 파서: 조건식 추출, enum 멤버 수, union 수         │
│  - 결과: BranchPoint 그래프                         │
│  도구: LLM 판단 + AST 파서 사실                    │
└───────────────────┬───────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│  4. 경로 수 계산 + 좌표 할당                        │
│  - 분기 그래프 순회 → 경로별 곱, 독립 경로 합산       │
│  - 각 경로를 WeightedIndex로 인코딩                 │
│  - Spacetime UID 부여                              │
│  도구: WeightedIndex + LabelRegistry               │
└───────────────────────────────────────────────────┘
```

---

## 4. 스키마 해시 (DataIR용)

Data IR의 구조적 정체성을 결정하는 해시. 이 부분은 기계적으로 계산 가능하다.

### 정규화 규칙

```typescript
function computeSchemaHash(fields: FieldDescriptor[]): string {
  const sorted = [...fields].sort((a, b) => a.name.localeCompare(b.name));
  const normalized = sorted.map(f =>
    `${f.name}:${normalizeType(f.type)}:${f.optional}`
  );
  return deterministicHash(normalized.join('|'));
}
```

### 타입 정규화

| 원본 | 정규화 | 이유 |
|------|--------|------|
| `string \| undefined` | `string?` | optional 통합 |
| `Array<T>` / `T[]` | `array<T>` | 문법 통일 |
| `Promise<T>` | `T` | 래퍼 제거 |
| `any` / `unknown` | `any` | flexible 표시 |

### 구조적 동등성

```
interface UserA { name: string; age: number; }
interface UserB { age: number; name: string; }
→ 같은 schemaHash (필드 정렬 + 정규화)
```

---

## 5. 기존 마커 시스템 통합

### 코드 내 의도 마커

`definition-catalog`의 `^purpose` 마커를 코드 주석으로 확장.
LLM이 이 마커를 발견하면 검증 단위 판정에 참고한다:

```typescript
/**
 * ^intent 결제 처리의 핵심 비즈니스 로직
 * ^contract 주문 상태가 PENDING일 때만 호출 가능
 * ^branches orderType(3), paymentMethod(4), shippingOption(2)
 */
function processPayment(input: PaymentInput): PaymentResult {
  // ...
}
```

| 마커 | 역할 | LLM 판단에 미치는 영향 |
|------|------|---|
| `^intent` | 이 코드의 존재 이유 | 검증 단위로 식별할 가능성 높임 |
| `^contract` | 실행 전제 조건 | 입력 계약으로 기록 |
| `^branches` | 개발자가 선언한 분기점 | LLM 판단의 힌트 (최종 판단은 LLM) |

### @def.doc 통합

```typescript
// @def.doc payment-api-spec#processPayment
// → ModuleIR.meta.defDocRef = 'payment-api-spec'
// → definition-catalog 문서와 양방향 링크
```

---

## 6. 제약과 한계

| 제약 | 이유 | 대응 |
|------|------|------|
| LLM 판단의 비결정성 | 같은 코드도 다른 판단 가능 | ^branches 마커로 개발자가 힌트 제공 |
| TypeScript만 지원 | AST 파서 의존 | 후속 과제로 확장 |
| 동적 분기 미추적 | 런타임 값에 의존하는 분기 | LLM이 "flexible" 표시 |
| 프레임워크 의존 | NestJS DI 등 | 프레임워크별 LLM 프롬프트 조정 |
| 간접 호출 | 콜백, 이벤트 리스너 | LLM이 의미적으로 판단 |
