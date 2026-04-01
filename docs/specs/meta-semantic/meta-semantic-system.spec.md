---
def:
  id: meta-semantic-system
  level: group
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [structural, entry-point]
  links:
    - target: system-concepts
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
    - target: meta-semantic-concepts
      type: contains
    - target: meta-semantic-ir
      type: contains
    - target: meta-semantic-spacetime-uid
      type: contains
    - target: meta-semantic-extraction
      type: contains
    - target: meta-semantic-folding
      type: contains
    - target: meta-semantic-scope
      type: contains
---

# Meta-Semantic Architecture — 시공간 좌표 기반 의도 컴파일러

## 목적 ^purpose

데이터의 흐름을 검증 가능한 단위로 정의하고 추적하는 체계.
2개 레이어로 구성: 수집(단위 자체 속성)과 해석(관계/맥락 기반).

## 방법 ^method

**레이어 1 — 수집:** 코드 한 단위를 수집할 때 동시에 얻을 수 있는 것을 정의한다.
**데이터 패싯**이 역할을 분리하고, **바운더리**가 경계를 짓고,
**파이프**가 실행을 묶고, **scope→aspect**가 검증 방법을 분류하고,
**layer**가 존재 이유를, **concern**이 횡단 관심사를, **code-references**가 문서 연결을,
**분기 경로**가 경우의 수를, **Spacetime UID**가 주소를 부여한다.

**레이어 2 — 해석:** 수집된 단위들을 연결하고 맥락을 부여한다.
**lifecycle**이 시간에 따른 상태를, **link_type**이 관계 성격을,
**concern 전파**가 횡단 관심사 확산을, **layer 영향 전파**가 cascade 방향을,
**tags**가 보조 분류를 부여한다.

코드는 **Module·Data·Pipe** 3종 IR로 분해되어 위 체계의 입력이 된다.

## 정의 ^defines

레이어 1 (수집 — 단위 자체 속성):
- 데이터 패싯 (Data Facets) — 데이터의 독립적 역할을 분리하는 설계 규칙
- 파이프 (Pipe) — 패싯 단위들의 확정적 실행 묶음
- Semantic Folding — 코드 구조의 계층적 접기/펼치기로 검증 단위 식별
- scope → aspect → 검증 전략 (quality gates 포함)
- layer — 존재 이유 식별 (domain/operation/mediation/experience)
- concern 식별 — 횡단 관심사 태깅 (security, performance 등)
- code-references — 코드↔문서 매핑
- 분기 경로 기반 주소 체계 (경로 합산, 전곱 아님)
- Spacetime UID — 분기 경로 + 시간 축 주소
- LLM 기반 실행 단위 식별

레이어 2 (해석 — 관계/맥락 기반):
- lifecycle — 시간에 따른 상태 (draft→active→deprecated)
- link_type — 바운더리 간 관계 성격 (depends_on/implements/refines/constrains)
- concern 전파 — 그래프 순회로 횡단 관심사 확산
- layer 영향 전파 — domain→operation→mediation→experience cascade
- tags — 보조 분류

## 위임 ^delegates

- **meta-semantic-concepts** → 8가지 원자 개념 정의 (패싯, 바운더리, 파이프 등)
- **meta-semantic-folding** → Semantic Folding 핵심 메커니즘, 검증 단위 식별
- **meta-semantic-ir** → 3종 IR 구조 정의 (Module, Data, Pipe)
- **meta-semantic-scope** → scope → aspect → 검증 전략 (경로 모델)
- **meta-semantic-spacetime-uid** → 분기 경로 기반 시공간 UID 인코딩
- **meta-semantic-extraction** → LLM 기반 실행 단위 식별 및 분기점 추출

## 구성 ^overview

2개 레이어, 6개 하위 모듈:

**레이어 1 — 수집 (코드 단위 하나만 보고 결정 가능):**
- **meta-semantic-concepts**: 8가지 원자 개념 (패싯, 바운더리, 파이프, 계약 하향 등)
- **meta-semantic-folding**: 코드를 접어 검증 가능 실행 단위를 식별
- **meta-semantic-ir**: Module·Data·Pipe IR 구조
- **meta-semantic-scope**: scope→aspect 경로 모델 + 검증 전략
- **meta-semantic-spacetime-uid**: 분기 경로 + 시간 축 주소
- **meta-semantic-extraction**: LLM 기반 단위 식별 + 분기점 추출

**레이어 2 — 해석 (수집된 단위 간 관계/맥락):**
- lifecycle, link_type, concern 전파, layer 영향 전파, tags
- 후속 설계 대상

---

## 1. 코어 철학

### "Semantic Folding이 먼저, 좌표는 그 다음"

```
소스 코드 (TypeScript)
  ↓ Semantic Folding (접기/펼치기)
검증 가능한 실행 단위 식별 (함수 경계)
  ↓ LLM 기반 분기점 추출
각 함수의 분기 경로 수집 (이벤트별 경우의 수)
  ↓ 3종 IR 변환 (Module × Data × Pipe)
분기 경로 기반 주소 할당 (WeightedIndex)
  ↓ 시공간 좌표가 부여된 의도 지도
```

이 시스템의 핵심은 **Semantic Folding**이다.
코드를 계층별로 접고 펼쳐서 "이 함수는 독립적으로 검증 가능한가?"를 판단하고,
검증 가능한 단위를 식별한 후에야 각 단위의 분기 경로를 좌표화한다.

좌표화 시 **전체 변수의 전곱(N×M)을 만들지 않는다.**
각 이벤트(분기점)에서 실제 도달 가능한 경로만 수집한다.

### 분기 경로 기반 좌표 모델

전곱 모델과 경로 모델의 차이:

```
전곱 (기존 WeightedIndex 일반 용법):
  변수A(3) × 변수B(4) × 변수C(2) = 24 주소
  → 모든 조합이 존재한다고 가정 (대부분 도달 불가능)

경로 모델 (이 시스템):
  변수A(3개 분기)
    ├── 도달점: 변수B(4개 분기) → 3 × 4 = 12 경로
    ├── 도달점: 변수C(2개 분기) → 3 × 2 = 6 경로
    └── 도달점: 변수D(5개 분기) → 3 × 5 = 15 경로
  총: 12 + 6 + 15 = 33 경로 (≠ 3×4×2×5 = 120)
```

각 분기점에서 **다음에 도달하는 분기점**을 따라가며 곱하고,
독립적인 경로는 **합산**한다. 이것이 "이벤트별 경우의 수 수집"이다.

### definition-catalog와의 관계

```
definition-catalog     "문서가 무엇을 정의하는가"     → def_document:v2:N
meta-semantic          "코드가 무엇을 의도하는가"     → intent:v1:M

문서 좌표 × 코드 좌표 = 완전한 시스템 추적
```

### 좌표 동형

```
Module IR              ≡  DefinitionEntry      (좌표가 부여된 구조 단위)
Data IR.definition     ≡  AxisDef              (차원: 스키마 형태)
Data IR.lifecycle      ≡  DefLifecycle         (상태: 생산/소비/관리/저장)
Pipe IR                ≡  EventRecord          (좌표가 부여된 실행 이벤트)
Spacetime UID          ≡  SemanticAddress       (schema:version:index)
```

---

## 2. 3종 IR 모델 (The Triad)

### 2.1 Module — 바운더리에 의해 정의

모듈은 **바운더리**(패싯 중 일부가 존재하는 검증 가능 기능 단위)에 의해 정의된다.
바운더리 간 관계는 **계약 하향**(상호 무지, 자기 계약 명확) 원칙을 따른다.

> 바운더리 상세: `ms-concept-boundary` 참조
> 계약 하향 상세: `ms-concept-contract-descent` 참조

ModuleIR의 interface는 바운더리의 소비/생산 표면이고,
relations는 계약 전달 경로다. 구조 상세는 `meta-semantic-ir` 참조.

**DefLevel과의 매핑:**

| Module 관계 | DefLevel 대응 |
|---|---|
| parent 없음 (루트) | `group` |
| parent + children 있음 | `module` |
| children 없음 (말단) | `leaf` |

### 2.2 Data — 데이터 패싯 규칙 (State Entity)

데이터의 5가지 역할(생산·소비·정의·관리·저장)은 반드시 분리한다.
각 역할은 독립적으로 존재할 수 있으며, 변형은 생산+저장의 조합으로 추적한다.

> 데이터 패싯 상세: `ms-concept-data-facets` 참조

DataIR의 구조 상세는 `meta-semantic-ir` 참조.

### 2.3 Pipe — 동적인 실행 트랜잭션 (Temporal Flow)

파이프는 정적인 모듈과 데이터를 엮어 **실제 상태 변화**를 일으키는 런타임 트리거다.

```typescript
interface PipeIR {
  /** 트랜잭션 식별자 — 시간 축 좌표의 원천 */
  transactionId: string;

  /** 실행 대상 모듈 */
  targetModule: ModuleRef;

  /** 입력 데이터 */
  payload: DataRef;

  /** 트랜잭션 상태 */
  state: 'pending' | 'committed' | 'rolledBack';

  /** 실행 결과로 파생되는 후속 파이프 */
  triggers: PipeRef[];
}
```

파이프가 실행될 때마다 시스템의 **시간 축(tx_seq)**이 전진한다.
이것이 Spacetime UID의 temporal identity를 생성하는 메커니즘이다.

---

## 3. 분기 경로 기반 주소 체계 (Spacetime UID)

### 핵심 원칙: 이벤트별 경우의 수만 수집

전체 변수의 전곱(N×M)이 아니라, **실행 경로를 따라가며 각 분기점의 경우의 수를 수집**한다.

```
함수 processOrder():
  ├── 분기A: 주문 유형 (3종: normal, express, subscription)
  │     ├── 도달점 분기B: 결제 방법 (4종) → 3 × 4 = 12 경로
  │     └── 도달점 분기C: 배송 옵션 (2종) → 3 × 2 = 6 경로
  └── 총 주소 공간: 12 + 6 = 18
      (전곱이었다면: 3 × 4 × 2 = 24 — 도달 불가능한 6개 주소 낭비)
```

### 경로 그래프 → WeightedIndex 매핑

각 **독립 경로**를 별도 WeightedIndex로 인코딩하고, 주소 범위를 연접(concatenation)한다:

```typescript
// 경로 1: 주문유형 → 결제방법
const path1 = new WeightedIndex([3, 4], ['orderType', 'paymentMethod']);
// 주소 범위: [0, 11] (12개)

// 경로 2: 주문유형 → 배송옵션
const path2 = new WeightedIndex([3, 2], ['orderType', 'shippingOption']);
// 주소 범위: [12, 17] (6개, offset = path1.totalSize)

// 전체: 18개 주소 — 도달 가능한 경로만
```

### 시간 축 결합

구조적 경로 주소에 시간 축(tx_seq)을 결합하여 계보를 추적한다:

```
processOrder 경로1 (normal, card) → path1:encode([1,1]) → addr: 0
  tx:1 → intent:v1:0:1  (첫 번째 실행)
  tx:2 → intent:v1:0:2  (두 번째 실행)

processOrder 경로2 (express, sameDay) → path2:encode([2,1]) → addr: 14
  tx:1 → intent:v1:14:1
```

**기대 효과:**

- **낭비 없는 주소 공간**: 도달 가능한 경로만 좌표화
- **O(1) 경로 판별**: 주소 범위로 "이 실행이 어떤 분기 경로인가" 즉시 식별
- **범위 쿼리**: 같은 경로의 모든 실행 이력을 연속 범위로 추적
- **불변성**: 기존 주소 영원히 불변, 새 경로/실행은 새 좌표

---

## 4. LLM 기반 실행 단위 식별

### "자동 추출"이 아니라 "검증 가능한 분할"

이 시스템은 AST를 기계적으로 파싱하여 모든 구조를 IR로 변환하는 것이 **아니다**.
LLM이 코드를 읽고 **"이 함수는 독립적으로 검증 가능한 실행 단위인가?"**를 판단하여,
검증 가능한 경계에서 코드를 분할하고 각 단위의 분기점을 추출한다.

### LLM의 역할

| 단계 | LLM이 하는 것 | 기계적 파서가 하는 것 |
|------|---|---|
| 함수 경계 식별 | "이 함수는 단독 테스트 가능한가?" 판단 | AST에서 함수 시그니처 추출 |
| 분기점 추출 | "이 if/switch가 의미 있는 분기인가?" 판단 | 조건문 노드 수 세기 |
| 의존 관계 | "이 호출이 핵심 의존인가 부수적인가?" 판단 | import 그래프 구축 |
| 부수효과 판별 | "이 호출이 외부 상태를 변경하는가?" 판단 | 패턴 매칭 |

**핵심: LLM은 "의미적 판단"을, 파서는 "구조적 사실"을 담당한다.**

### 기존 프리미티브 재사용

| 기존 구현 | 이 시스템에서의 역할 |
|---|---|
| `definition-catalog/extract.ts` | 마커 추출 패턴 재사용 (`^purpose` → `^intent`) |
| `definition-catalog/code-references.ts` | `@def.doc` 주석 → Module↔Doc 참조 |
| `weighted-index/vocab/` | LabelRegistry로 분기점 ID 인덱싱 |
| `weighted-index/protocol/` | SemanticAddress로 직렬화 |
| `weighted-index/math/` | WeightedIndex로 경로별 좌표 압축 |

---

## 5. Semantic Folding (핵심 메커니즘)

**Semantic Folding은 이 시스템의 핵심이다.** 단순한 시각화 기법이 아니라,
코드 구조를 계층별로 접고 펼쳐서 **검증 가능한 실행 단위를 식별**하는 메커니즘이다.

### 왜 Folding이 먼저인가

좌표를 부여하려면 먼저 "무엇에 좌표를 부여할 것인가"를 결정해야 한다.
모든 변수, 모든 함수, 모든 줄에 좌표를 부여하면 주소 공간이 폭발한다.
Semantic Folding은 코드를 접어서 **"이 단위는 독립적으로 검증 가능한가?"**를 판단하고,
검증 가능한 단위만 좌표화 대상으로 선정한다.

```
전체 코드 (10만 줄)
  ↓ L0 접기: 시스템 경계 식별
[PaymentSystem] ──→ [OrderSystem] ──→ [NotificationSystem]
  ↓ L1 펼치기: PaymentSystem 내부
[Validator] → [Processor] → [Notifier]
  ↓ L2 펼치기: Processor 내부 — 여기서 검증 단위 결정
processPayment()  ← 이 함수가 독립 검증 가능한 실행 단위
  ├── 분기A: 주문유형(3) → 분기B: 결제방법(4) → 3×4 = 12 경로
  └── 분기A: 주문유형(3) → 분기C: 배송옵션(2) → 3×2 = 6 경로
  총: 18 경로만 좌표화 (전체 변수 전곱 아님)
```

### Folding이 결정하는 것

| 판단 | 결과 | 후속 작업 |
|------|------|----------|
| "이 함수는 독립 검증 가능" | leaf ModuleIR 생성 | 분기점 추출 → 좌표 할당 |
| "이 클래스는 하위를 조율" | module ModuleIR 생성 | 하위 leaf 식별 위임 |
| "이 패키지는 경계" | group ModuleIR 생성 | 하위 module 식별 위임 |
| "이 분기는 의미 없음" | 좌표화 대상에서 제외 | 분기 수에 포함 안 함 |

### 타입 확실성 시각화

접힌 뷰에서 데이터의 타입 안전성을 직관적으로 노출:

```
Strict 스키마 (interface User { name: string; age: number })
  → 단단한 다각형 (Polygon) — 모든 필드가 구체적 타입

Flexible 입력 (any, unknown, Record<string, any>)
  → 흐릿한 구름 (Cloud) — 런타임 취약 지점 직관적 노출
```

### 계약 테스트 도출

접힌 상위 모듈의 interface는 그 자체로:
1. 아키텍처 도식 (시각적 이해)
2. Contract Test 기준점 (검증)
3. definition-catalog 문서와의 일관성 검증 대상

---

## 6. 기존 시스템과의 통합 맵

```
                    ┌─────────────────────────────┐
                    │   meta-semantic-system      │
                    │   (코드 → IR → 좌표)         │
                    └─────────┬───────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              │               │                   │
    ┌─────────▼──────┐ ┌─────▼──────┐  ┌─────────▼────────┐
    │ weighted-index  │ │ definition │  │ code-references   │
    │ (좌표 압축)     │ │ -catalog   │  │ (코드↔문서 참조)   │
    │                │ │ (문서 좌표) │  │                   │
    │ - WeightedIndex│ │            │  │ - @def.doc        │
    │ - LabelRegistry│ │ - scope    │  │ - @def.boundary   │
    │ - PrefixCodec  │ │ - aspect   │  │ - frontmatter src │
    │ - Semantic     │ │ - depth    │  │                   │
    │   Address      │ │ - seq      │  │                   │
    └────────────────┘ └────────────┘  └───────────────────┘
```

### 의존 방향

```
meta-semantic-system
  ├── depends_on → weighted-index          (좌표 수학)
  ├── depends_on → definition-catalog      (문서 좌표계 동형)
  ├── depends_on → system-concepts         (Event, Coordinate, Axis 개념)
  └── uses       → code-references.ts      (기존 코드↔문서 참조)
```

---

## 7. 범위와 경계

### 현재 범위

- Semantic Folding 메커니즘으로 검증 가능한 실행 단위 식별
- 분기 경로 기반 좌표 모델 (이벤트별 경우의 수 합산, 전곱 아님)
- Module·Data·Pipe 3종 IR 모델 정의
- LLM 기반 함수 경계·분기점 식별 전략

### 명시적 비범위

- 런타임 실행 트레이싱 (기존 ingest-server 영역)
- TypeScript 이외 언어 지원
- 전체 변수의 전곱 주소 공간 (도달 가능한 경로만 수집)
- IDE 플러그인 구현 (후속 과제)

### 후속 과제

| 과제 | 설명 |
|------|------|
| LLM 프롬프트 설계 | 함수 경계 판단 + 분기점 추출용 프롬프트 |
| 경로 그래프 엔진 | 분기점 간 도달 관계 → WeightedIndex 경로별 인스턴스 생성 |
| IR → DB 영속 | Drizzle + SQLite에 IR 그래프 저장 |
| definition-catalog 브릿지 | ModuleIR ↔ DefinitionEntry 양방향 동기화 |
| 시각화 프로토타입 | Semantic Folding 웹 UI (D3.js / Three.js) |
| CI 통합 | PR diff → IR diff → 영향 범위 자동 계산 |
