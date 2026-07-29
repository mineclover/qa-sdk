---
def:
  id: tier-redesign-integration-taxonomy-catalog
  type: spec
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: integration-spec
supersedes: -
superseded_by: -
---

# Taxonomy Catalog — 문서 분류 텍소노미 및 상위 개념 명세

## 목적 ^purpose

이 문서는 Taxonomy Catalog — 문서 분류 텍소노미 및 상위 개념 명세에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

> 근거: [integration/system-linkage-map.md](./system-linkage-map.md) P0-1 과제. 
> 모든 분류 축(Axis)과 값(Entry)을 단일 진입점으로 관리하여 설계의 원자성을 보장한다.

## 1. 지식-구조-패턴 통합 위계 (The Integrated Hierarchy)

시스템의 지식 아키텍처와 소프트웨어 아키텍처를 동일한 철학 위에서 정렬한다. 각 계층은 자신의 정의와 생명주기를 관리하기 위해 **내부적으로 자신의 Pack/Layout/World를 보유**하는 재귀적 자가 관리 구조를 가진다.

| 레벨 | 지식 개념 | STC 티어 | ECS 패턴 | 설명 (Role) |
|:---:|:---:|:---:|:---:|:---|
| **L0** | **Pack** | **Layout** | **World / Scene** | 도메인 자산의 **조직과 배포** 단위 (컨텍스트) |
| **L1** | **System / Logic** | **System** | **System** | 고유 정체성을 가진 추상적 로직 집합. 모든 하위 계약과 데이터의 **최상위 소유주(Owner)** |
| **L1.5**| **DSL / Interface**| **Grammar** | **Functionality** | **DSL로서의 텍소노미**. 데이터(Axis)를 조합하여 기능을 정의하고 시스템의 소비 방식을 결정하는 **계약 평면** |
| **L2** | **Axis / Entry** | **Component** | **Material** | **데이터로서의 텍소노미**. 데이터의 형상과 기준 정의. 유형에 따라 **용량(Capacity)** 또는 **구조적 고유 식별자**를 보유 |
| **L3** | **Entry** | (인스턴스) | **Value / ID** | 축 위에 찍히는 구체적인 **값/식별자** |

### 1.1 Axis의 유형: 용량(Capacity) vs 구조(Structure)
시스템은 다루는 데이터의 성격에 따라 Axis의 역할을 두 가지로 분리하여 정의한다.
- **용량 기반 축 (Finite Axis)**: 상태 리스트, 분류 체계 등 시스템이 수용할 수 있는 엔트리의 총량(Capacity)이 설계 시점에 확정된 닫힌 계. 유한 조합수 계산의 근거가 된다.
- **구조 기반 축 (Structural Axis)**: DB 테이블의 컬럼, 스키마 필드 등 무제한의 데이터(Entry) 유입을 전제로 하는 열린 계. 용량 대신 **고유 식별성**과 **계보 추적**의 앵커 역할을 수행한다.

### 1.2 System과 DSL: 고유 정의와 소비의 매개
시스템은 추상적 고유 개념으로 존재하며, DSL을 통해 자신의 기능을 외부로 노출하고 소비 가능하게 한다.
- **System Anchor (L1)**: 시스템은 변하지 않는 고유한 논리적 집합체이자 최상위 소유권의 주체로 정의된다.
- **DSL Subordination (L1.5)**: DSL은 특정 System에 귀속되어 해당 시스템을 어떻게 다루고 소비할지(Interface)를 정의하는 문법 체계다.
- **1D Projection**: DSL은 시스템 하위에서 Axis 조합을 1차원 주소로 투영하여, 시스템이 인식할 수 있는 선형적 작업 평면을 제공한다.

### 1.3 정의와 소비의 분리 (Separation of Definition and Consumption)
System은 로직의 구현(Definition)에 집중하고, DSL은 해당 로직을 어떻게 소비(Consumption)할지 결정하는 계약을 담당한다.
- **매개체로서의 DSL**: 시스템의 내부 코드를 수정하지 않고도, 시스템 하위의 DSL(Interface 포함) 명세를 변경하는 것만으로 시스템의 소비 방식을 재정의할 수 있다.

### 1.4 재귀적 자가 관리 (Recursive Self-Management)
각 개념 계층은 상위 계층의 질서를 따르는 동시에, 하위 계층을 관리하기 위한 고유의 **배치 평면(L0 - Pack/Layout)**을 가진다.
- **예시**: `Definition Catalog`는 하나의 **Pack**으로서, 문서 분류 **Taxonomy**(System)를 담고 있으며, 이 Taxonomy는 `tier`, `scope`와 같은 **Axis**(Component)들을 통해 동작한다.
- **의미**: "시스템을 정의하는 문서" 역시 "시스템이 정의하는 방식"과 동일한 구조로 관리된다. (Self-defining Architecture)

---

## 2. 수직적 지배구조 및 관찰 체계 (Structural Observability)

기능의 정의(DSL)와 데이터(Axis)를 분리하여 시스템의 계층을 추적하고 독립적으로 관찰하기 위한 구조화 규칙을 정의한다.

### 2.1 소유권 체인 (Vertical Ownership Chain)
모든 지식 자산은 시스템(L1)을 중심으로 수직적으로 계열화된다.
- **Anchor**: 모든 DSL 명세와 Axis 정의는 `owner_system` 필드를 통해 자신이 속한 System ID를 명시해야 한다.
- **Traceability**: `def validate` 도구는 모든 Component(L2)가 DSL(L1.5)을 거쳐 최종적으로 어떤 System(L1)에 바인딩되는지 역방향으로 추적 가능해야 한다.

### 2.2 기능과 데이터의 관찰 분리 (Separation of Observation)
시스템의 정체성을 두 가지 평면으로 분리하여 관찰 효율을 극대화한다.

| 관찰 평면 | 대상 (What to observe) | 문서화 위치 | 핵심 지표 |
|:---:|:---|:---|:---|
| **기능 평면 (Functional)** | Axis 조합을 통한 기능 정의 및 소비 계약 | DSL / Interface 문서 (`.rule`, `.spec` Grammar) | 기능의 외연, 전이 가능 이벤트 수 |
| **데이터 평면 (Data)** | 개별 축의 형상과 수용 가능한 엔트리 목록 | Axis / Component 문서 (`.spec` Schema) | 축의 용량(Capacity), 데이터 타입 |

### 2.3 닫힌 계의 수용량 관리
- **정적 관찰**: DSL(L1.5)은 Axis(L2)들의 용량을 조합하여 시스템 전체의 **최대 수용량(Total Capacity)**을 계산한다.
- **동적 추적**: 실제 유입되는 Entry(L3)가 DSL이 허용한 닫힌 계의 범위를 벗어나는지 실시간으로 관측하고 차단한다.

### 2.4 모듈형 문법 (Modular Grammar)
DSL의 비대화를 방지하기 위해 L1.5 계층은 재귀적 자가 관리 원칙을 따른다.
- **분할 기준**: 특정 시스템의 기능 조합이 과도하게 복잡할 경우, DSL을 관심사별 '문법 조각'으로 분리하고 이를 **Layout 티어**를 통해 조직한다.
- **조립**: 분리된 문법 조각들은 최종적으로 상위 DSL 레이어에서 합성되어 하나의 완결된 시스템 인터페이스를 형성한다.

### 2.5 교차 평면 참조 무결성 (Cross-Plane Integrity)
기능 평면(L1.5)과 데이터 평면(L2) 사이의 엄격한 참조 정합성을 강제한다.
- **Constraint**: DSL 문서에서 사용되는 모든 Axis 식별자는 반드시 동일한 소유권 체인 내의 Axis 문서에 정의되어 있어야 한다.
- **Validation**: `def validate`는 L1.5의 문법 명세와 L2의 데이터 형상 간의 **교차 정합성(Cross-referencing)**을 전수 검사한다.

### 2.6 고유 식별 및 계보 추적 (Lineage Tracking)
구조 기반 축(Structural Axis)은 데이터의 생애 주기를 추적하기 위한 불변의 앵커로 관리된다.
- **불변 식별자 (Stable Anchor)**: DB 컬럼이나 스키마 필드를 나타내는 Axis는 물리적 위치나 이름의 변경과 무관하게 시스템 내에서 유일하고 불변하는 식별자(UID)를 가져야 한다.
- **데이터 계보 (Data Lineage)**: 시스템은 Structural Axis를 최소 단위로 하여, 데이터의 생성원천(Source)부터 가공(Transformation), 최종 소비(Target)까지의 경로를 추적한다.
- **정합성 유지**: 계보 상의 모든 데이터 변환 로직(System)은 바인딩된 DSL(L1.5)을 통해 어떤 Structural Axis들이 서로 연결되어 있는지 명시해야 한다.

### 2.7 필드 레벨 계보 정밀도 (Field-level Precision)
계보 추적의 신뢰성을 보장하기 위해 다음의 원자적 규칙을 적용한다.
- **변환의 원자성 (Transformation Atomicity)**: 시스템(L1)에 의한 모든 데이터 변경 행위는 반드시 하나 이상의 Structural Axis(L2)를 최종 타깃으로 가져야 하며, 이는 DSL(L1.5) 명세에 의해 증명되어야 한다.
- **소스-타깃 바인딩**: 계보 상의 모든 노드는 반드시 등록된 Axis 식별자를 포함해야 하며, 익명 필드나 임시 변수는 계보 체인에 진입할 수 없다.

### 2.8 데이터 통행 프로토콜 (Lineage Protocols)
`lineage_facet`의 각 단계는 목적에 따른 세부 유형을 가지며, 이는 관심사 필터링의 기준이 된다.

| 단계 (Facet) | 유형 (Kind) | 설명 |
|:---:|:---|:---|
| **Ingress** | `interaction` \| `call` | 유저 액션 또는 인터페이스 호출을 통한 진입 |
| | `subscription` \| `load` | 비동기 이벤트 수신 또는 저장소 데이터 로드 |
| **Traversal** | `validation` \| `mapping` | 정합성 검사 또는 데이터 형상 변환 |
| | `enrichment` \| `branching` | 타 데이터 결합 또는 경로 분기 로직 |
| **Egress** | `settlement` | **Structural Axis**에 영구 안착 (DB 저장 등) |
| | `emission` \| `response` | 외부 신호 방출 또는 요청에 대한 최종 응답 |
| | `suspension` | 캐시, 세션 등 임시 상태 보존 |

- **목적 기반 필터링**: 사용자가 정의한 시작(`ingress`)과 끝(`egress`)의 유형에 부합하지 않는 경유 데이터 및 보조 로직은 관찰 평면에서 자동 소거된다.

---

## 3. 구조화와 문서화의 원칙 (Structuring & Documentation)

시스템의 지식은 논리적 구조화와 물리적 문서화의 결합으로 완성된다.

### 3.1 구조화 (Structuring): 좌표로의 투영
- **본질**: 무한한 복잡도를 가진 로직과 데이터를 유한한 좌표 공간(`scope` × `aspect` × `tier`)으로 매핑하는 행위이다.
- **역할**: "이 지식의 위치와 경계는 어디인가?"에 답한다.
- **산출물**: DSL(L1.5), Axis(L2), 좌표(Coordinate).

### 3.2 문서화 (Documentation): 맥락의 보존
- **본질**: 구조화된 좌표 위에 인간과 LLM이 이해할 수 있는 맥락(Context)과 설계 의도(Intent)를 결합하는 행위이다.
- **역할**: "이 지식은 왜 존재하는가? 어떻게 사용되는가?"에 답한다.
- **산출물**: `type: design` 또는 `type: knowledge` 기반의 마크다운 문서.

### 3.3 통합 관리 규칙
- **선 구조, 후 문서**: 모든 문서는 반드시 구조화된 좌표계에 먼저 안착된 후 서술되어야 한다 (좌표 없는 문서는 존재할 수 없음).
- **이중 관찰**: `def query` 도구는 지식의 '구조적 위치'와 '서술적 내용'을 동시에 조회할 수 있는 통합 뷰를 제공해야 한다.

---

## 4. 이중 시스템 투영 (Dual-System Projection)

의도가 설명하는 시스템과 구현이 표현하는 시스템은 그 목적과 주권이 다르므로 독립적인 평면에서 관리한다.

### 4.1 규범적 의도 평면 (Normative Intent Plane)
- **목적**: 시스템이 마땅히 수행해야 할 **비즈니스 가치와 규칙**을 설명한다.
- **주권**: 설계자(Human)에게 있으며, L1.5 DSL 명세를 통해 구조화된다.
- **앵커**: 인터페이스 및 이벤트 발생 지점을 중심으로 "무엇(What)을 해야 하는가"를 기술한다.

### 4.2 실증적 구현 평면 (Empirical Implementation Plane)
- **목적**: 실제 코드에서 벌어지고 있는 **기술적 사실과 실행 흐름**을 표현한다.
* **주권**: 소스 코드(Source)와 추출 파이프라인(LLM+Parser)에게 있으며, IR 그래프를 통해 구조화된다.
- **특징**: 세부 구현 특이사항을 포함하며, "실제로 어떻게(How) 작동하는가"를 실증한다.

---

## 5. 의도의 계층화 (Hierarchy of Intent)

의도 평면 내에서도 시스템의 본질과 이를 보조하는 기능을 구분하여 관리한다.

### 5.1 코어 시스템 의도 (Core Intent)
- **정의**: 시스템의 존재 이유이자 비즈니스 도메인의 본질적 행위이다.
- **관리**: 패싯 흐름(Consume → Manage → Produce → Store)의 무결성을 최우선으로 검증한다.

### 5.2 보조적 의도 (Auxiliary Intent)
- **정의**: 코어 시스템을 안전하고 효율적으로 작동하게 만드는 지원 기능이다. (예: 로깅, 보안, 성능, 트랜잭션 전파)
- **관리**: 코어 로직의 흐름을 방해하지 않으면서 적절한 지점에 바인딩되어 있는지 관찰한다.
- **구분**: 보조적 의도는 코어 시스템의 설명에서 **Sidecar** 또는 **Decorator** 형태로 분리 관찰 가능해야 한다.

---

## 6. 운영 회복력 및 효율 규칙 (Resilience & Efficiency)

고도의 추적 시스템이 초래할 수 있는 인지 부하와 데이터 폭발을 방지하기 위한 운영 원칙을 정의한다.

### 6.1 추론 우선의 법칙 (Inference First)
- **자동 할당**: 모든 추적 축은 지식의 위치(Path)와 맥락(Context)에 의해 시스템이 자동 추론하는 것을 원칙으로 한다. (예: `docs/specs/` → `intent`, `packages/` → `execution`)
- **개입 최소화**: 인간 설계자는 시스템의 자동 추론이 실제 의도와 어긋나는 '괴리(Drift)' 상황에서만 명시적으로 값을 수정한다.

### 6.2 주석 주권의 법칙 (Annotation Sovereignty)
- **SSOT**: 소스 코드 내에 명시된 마커(`@def.*`, `@facet.*`)는 그 어떤 자동 추출 알고리즘이나 LLM의 의미적 판단보다 우선하는 최상위 진실(SSOT)로 간주한다.

### 6.3 목적 지향적 유한 탐색 및 계보 압축 (Goal-Oriented Navigation)
계보 추적은 무한한 그래프 탐색이 아닌, 명확한 시작과 끝이 존재하는 **유한한 흐름**을 추적하는 것을 핵심 목표로 한다.

- **시작과 끝의 정의**: 모든 탐색은 특정 목적(Goal)에 따라 시작점(`ingress`)과 도달점(`egress`)이 분명하게 정의되어야 한다. (예: 유저 인터렉션 발생 시점의 데이터부터 최종 DB 안착 지점까지)
- **관심사 기반 소거 (Contextual Pruning)**: 기획이나 설계 문서를 관찰할 때, 현재 정의된 시스템 바운더리와 관련이 없는 데이터 흐름은 관심사에서 즉시 소거(Exclude)되어야 한다.

---

## 7. 오원적 분석 체계 (Pentadic Analysis Matrix)

시스템의 진실을 다각도로 증명하고 유지보수성을 보장하기 위해 5종의 독립적인 분석 체계를 운영한다.

### 7.1 데이터 계보 분석 (Lineage Analysis)
- **메커니즘**: `Event` → `Facet` → `Event` 체인을 따라 모든 상태가 전파되고 안정화되는 과정을 추적한다.
- **주권**: 데이터의 **혈통과 무결성** 증명.

### 7.2 의도 스펙 분석 (Intent Spec Analysis)
- **메커니즘**: 설계자가 선언한 비즈니스 제약(`Constraint`)과 로직의 논리적 결합 구조를 분석한다.
- **주권**: 설계의 **논리적 정당성 및 약속(Promise)**의 무결성 증명.

### 7.3 구현 스펙 분석 (Implementation Spec Analysis)
- **메커니즘**: 코드에서 추출된 `execution` 평면의 기술적 사실(`Fact`)과 부수효과(`Side-effect`)를 분석한다.
- **주권**: 실제 작동 방식의 **기술적 안전성 및 사실(Fact)**의 무결성 증명.

### 7.4 검증 증거 분석 (Verification Analysis)
- **트리거**: 테스트 케이스 추가 및 검증 로직 리뷰 시.
- **메커니즘**: 테스트가 의도(`intent`)의 어느 범위를 커버하며, 실제 구현(`execution`)의 어느 경로를 검증하는지 분석한다.
- **주권**: 시스템 신뢰의 근거가 되는 **증거의 품질** 증명.

### 7.5 파급 효과 분석 (Blast Radius Analysis)
- **트리거**: 코드 분석 및 변경 설계 시.
- **메커니즘**: 특정 노드의 변화가 계보(`lineage`)와 스펙(`intent/implementation`) 그래프를 타고 전파되는 범위를 분석한다.
- **주권**: 시스템 변경 시 발생하는 **파급 효과의 제어 및 안전성** 증명.

### 7.6 체계 간 교차 검증 (Cross-Verification)
- **Drift 분석**: 의도(7.2)와 구현(7.3)을 대조하여 설계와 코드의 괴리를 감지한다.
- **Evidence 분석**: 스펙(7.2/7.3)에 대응하는 충분한 증거(7.4)가 확보되었는지 확인한다.
- **Impact 분석**: 변경이 예고된 지점의 파급력(7.5)을 계보(7.1) 상에서 정량화한다.

### 7.7 분석 엔진 실행 모델 (Execution Model)
오원적 분석 매트릭스는 다음 4가지 핵심 인자의 조합을 통해 CLI 레벨에서 정교하게 실행된다.

1.  **타깃 앵커 (Target Anchor)**: 분석의 시작점 (`symbol` | `event` | `document`).
2.  **분석 셀렉터 (Analysis Selector)**: 분석의 관점 (`lineage` | `intent` | `implementation` | `verification` | `impact`).
3.  **상태 컨텍스트 (State Context)**: 분석의 목적 시점 (`--state <plan|current>`). **계획(Future)**된 설계와 **현재(Reality)** 작동 중인 스펙 중 무엇을 기준으로 리파이닝할지 결정한다.
4.  **페르소나 컨텍스트 (Persona Context)**: 분석의 대상자 (`--as <strategist|builder|guardian>`). 정보의 정제 수준과 보조 로직(`auxiliary`)의 노출 여부를 결정하는 가시성 필터로 작동한다.

### 7.8 셀렉터 기반 정제 및 소거 로직 (Refining Logic)
시스템은 선택된 셀렉터와 컨텍스트(State, Persona)를 결합하여 최종 통찰을 리파이닝한다.

- **`lineage` 리파이너**: 앵커와 인과관계가 증명된 패싯 전이만 추출하되, `Strategist` 페르소나인 경우 모든 보조 흐름을 100% 소거한다.
- **계획 및 현재 대조 (Alignment)**: `State` 컨텍스트에 따라, 시스템은 "우리가 가고자 하는 지점(Plan)"과 "우리가 서 있는 지점(Current)"을 명확히 구분하여 보여주며, 두 상태 간의 정합성을 보고한다.
- **가시성 가중치 (Visibility Weighting)**:
    - **Strategist**: 비즈니스 가치 중심. `core` 로직 가중치 1.0, `auxiliary` 로직 가중치 0.0.
    - **Builder**: 기술적 실체 중심. `core` 로직 가중치 1.0, `auxiliary` 로직 가중치 1.0.
    - **Guardian**: 안전 및 증거 중심. `verification` 및 `impact` 데이터 가중치 최우선.
- **공통 소거 원칙 (Pruning)**: 선택된 타깃 앵커와 논리적 연관성이 없거나, 페르소나 가중치가 0인 데이터는 관찰 평면에서 즉시 배제한다.

---

## 8. 지식 거버넌스 및 관리 평면 (Knowledge Governance)

지식의 범주에 따라 관리 위치와 텍소노미를 엄격히 분리하여 생애주기를 추적한다.

### 8.1 계획 평면 (Planning Plane)
- **대상**: 미래의 지향점 및 잔여 과제.
- **위치**: `.plan.md`, `.todo.md` 파일.
- **상태**: `lifecycle: draft`를 기본으로 하며, 확정 시 `Intent` 평면으로 전이된다.

### 8.2 의도 평면 (Intent Plane)
- **대상**: 이미 구현된 시스템의 규범적 약속 및 규칙.
- **위치**: `.spec.md` (Design Documents).
- **역할**: "코드가 왜 이렇게 작성되었는가"에 대한 근거를 제공한다.

### 8.3 구현 평면 (Execution/Reality Plane)
- **대상**: 실제 작동하는 기술적 실체.
- **위치**: 
    - **코드베이스**: 함수, 클래스 등 물리적 소스 코드.
    - **이벤트**: 실행 시 발생하는 `EventRecord`.
    - **인터페이스**: 시스템 간의 진입점(`Ingress`) 정의.
- **역할**: 시스템의 실제 동작 사실을 증명한다.

---

## 9. 계층형 텍소노미 모델 (Layered Taxonomy Model)

문서의 정체성은 상위 레이어의 결정이 하위 레이어의 필수 조건을 제어하는 방식으로 형성된다.

### Layer 1: Identity (본질 결정)
- **축**: `type`
- **값**: `design` (또는 `spec`) | `knowledge`
- **역할**: 문서가 시스템 구조에 편입되는 **설계 자산**인지, 맥락을 보존하는 **지식 자산**인지 정의한다.
- **Binding**: 모든 하위 문서는 `owner_system` 필드를 통해 L1 System에 수직적으로 귀속되어야 한다.

### Layer 2: Sovereign Axes (주권 축)
- **Design일 때**: `tier` 필드가 주권을 가짐. (`system`, `layout`, `component`, `entry`)
- **Knowledge일 때**: `knowledge_kind` 필드가 주권을 가짐. (`philosophy`, `adr`, `template` 등)

### Layer 3: Spatial Coordinate (공간 좌표)
- **축**: `scope` × `aspect` × `depth`
- **역할**: 지식 창고 내에서의 물리적/논리적 위치를 결정한다.
- **Design**: 3축 조합을 통한 **정밀 점(Point) 좌표** 필수.
- **Knowledge**: 포괄적 영역 지정을 위한 **유연 좌표** 허용.

### Layer 4: Operational Metadata (운영 및 투영)
- **축**: `layer`, `lifecycle`, `svc`, `tags`, `axis_ref`, `prefix_ref`
- **역할**: 다른 시스템(DKG, Runtime Catalog)과의 연결 및 운영 상태를 관리한다.

---

## 10. 문서 분류 텍소노미 상세 (14개 축)

| 그룹 | 축 (Axis) | 설명 | Design 적용 | Knowledge 적용 |
|:---:|:---|:---|:---:|:---:|
| **Identity** | `type` | 문서의 근본 성격 | 필수 | 필수 |
| | **`owner_system`** | 최상위 소유 시스템 ID | **필수** | 선택 |
| **Structure** | `tier` | STC 구조적 계층 | **필수** | 면제 |
| | `knowledge_kind` | 지식의 성격 | 사용 금지 | **필수** |
| **Coordinate** | `scope` | 관심사 분류 | 필수 | 선택 |
| | `aspect` | 세부 측면 | 필수 | 선택 |
| | `depth` | 상세도 (detail-level) | 필수 | 선택 |
| **Meta** | `layer` | 존재 가치/이유 | 선택 | 선택 |
| | `lifecycle` | 신뢰도/생명주기 | 적용 | 적용 |
| **Linkage** | `doc-type-ext` | 파일 확장자 기반 역할 | 기능적 확장자 | 일반 확장자 |
| | `svc` | 소유 서비스 연결 | 선택 | 선택 |
| **Graph** | `DKG-node` | DKG 투영 노드 타입 | 자동 투영 | 보조 투영 |
| | `DKG-edge` | DKG 투영 관계 타입 | 자동 투영 | 참조 투영 |
| **Tracking** | **`projection_plane`** | 의도(`intent`) vs 실행(`execution`) | **필수** | **필수** |
| | **`intent_hierarchy`** | 코어(`core`) vs 보조(`auxiliary`) | **필수** | 선택 |
| | **`lineage_facet`** | 계보 패싯(`ingress`~`egress`) | **필수** | **필수** |
| **Runtime** | `axis` / `prefix` | 런타임 카탈로그 연결 | 참조 지점 | 참조 지점 |

---

## 11. 제약 및 직교성 규칙

1.  **D-19 상호 배제**: `type: design` 문서와 `knowledge_kind` 필드는 공존할 수 없다.
2.  **Tier 독립성**: `tier: system` 문서는 다른 `system` 문서를 `contains`로 소유할 수 없다.
3.  **확장자 정합성**: `type: design` 문서는 반드시 설계용 확장자(`.spec`, `.rule` 등)를 가져야 한다.
4.  **좌표 유일성**: 동일한 `(type, tier, scope, aspect, layer)`를 가진 문서는 유일해야 한다 (중복 감지 대상).
5.  **소유권 정합성**: 모든 L1.5 및 L2 문서는 유효한 `owner_system`을 가져야 하며, 해당 시스템은 반드시 실재해야 한다.
