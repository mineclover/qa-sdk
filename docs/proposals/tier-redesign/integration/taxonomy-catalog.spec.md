---
status: draft
date: 2026-04-19
part_of: tier-redesign
role: integration-spec
topic: taxonomy-catalog-definition
---

# Taxonomy Catalog — 문서 분류 텍소노미 및 상위 개념 명세

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

---

## 3. Taxonomy의 생성적 원리 (Generative Logic)

텍소노미는 축들의 집합을 통해 유한하고 결정론적인 설계 공간을 구축한다.

### 3.1 유한 좌표 공간 (Finite Coordinate Space)
텍소노미는 무분별한 설계 확산을 방지하기 위해 각 Axis가 가질 수 있는 Entry의 유한한 조합으로 **전체 좌표 공간의 크기**를 제한한다.
- **계산식**: `Total Space Size = Axis_A.Entries × Axis_B.Entries × ...`
- **의미**: 시스템이 가질 수 있는 "정체성의 총량"을 수학적으로 관리할 수 있게 한다.

### 3.2 DSL (Domain Specific Language) 기반 명세
텍소노미 카탈로그는 `qa-sdk`의 Frontmatter 및 도구들이 사용하는 DSL의 **메타-모델**이 된다.
- **문법**: Axis(Key)와 Entry(Value)의 쌍이 DSL의 기본 어휘가 된다.
- **제약**: 텍소노미(System)에 정의된 문법을 벗어난 조합은 "문법 오류(Syntax Error)"로 간주하여 `def validate` 단계에서 차단한다.

---

## 4. 계층형 텍소노미 모델 (Layered Taxonomy Model)

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

## 5. 문서 분류 텍소노미 상세 (14개 축)

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
| **Runtime** | `axis` / `prefix` | 런타임 카탈로그 연결 | 참조 지점 | 참조 지점 |

---

## 6. 제약 및 직교성 규칙

1.  **D-19 상호 배제**: `type: design` 문서와 `knowledge_kind` 필드는 공존할 수 없다.
2.  **Tier 독립성**: `tier: system` 문서는 다른 `system` 문서를 `contains`로 소유할 수 없다.
3.  **확장자 정합성**: `type: design` 문서는 반드시 설계용 확장자(`.spec`, `.rule` 등)를 가져야 한다.
4.  **좌표 유일성**: 동일한 `(type, tier, scope, aspect, layer)`를 가진 문서는 유일해야 한다 (중복 감지 대상).
5.  **소유권 정합성**: 모든 L1.5 및 L2 문서는 유효한 `owner_system`을 가져야 하며, 해당 시스템은 반드시 실재해야 한다.
