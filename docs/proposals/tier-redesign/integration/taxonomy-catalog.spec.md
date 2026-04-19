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

## 1. 상위 지식 구조 (The Meta-Structure)

시스템 지식은 아래 네 가지 계층을 통해 구체화된다.

### 1.1 Ontology Pack (L0)
- **정의**: 특정 비즈니스 도메인(예: 결제, 정산)을 완결적으로 서술하는 **배포 및 거버넌스 단위**.
- **역할**: 해당 도메인에 필요한 모든 스키마, 규칙, 좌표 시스템을 하나로 묶는다.

### 1.2 Taxonomy (L1)
- **정의**: 문서를 식별하고 역할을 규정하는 **다차원 분류 체계 자체**.
- **역할**: "어떻게 분류할 것인가"에 대한 규칙의 집합. 본 프로젝트는 이분법적 분류(`type`)를 기반으로 한 계층형 모델을 채택한다.

### 1.3 Axis (L2)
- **정의**: 텍소노미를 구성하는 **개별 분류 축(차원)**.
- **역할**: 문서의 정체성을 형성하는 독립적인 질문들. (예: "무엇에 대한 것인가?" → `scope`)

### 1.4 Entry (L3)
- **정의**: 축이 가질 수 있는 **구체적인 값 또는 런타임 인스턴스**.
- **역할**: 좌표 공간상의 한 점을 찍기 위한 식별값.

---

## 2. 계층형 텍소노미 모델 (Layered Taxonomy Model)

문서의 정체성은 상위 레이어의 결정이 하위 레이어의 필수 조건을 제어하는 방식으로 형성된다.

### Layer 1: Identity (본질 결정)
- **축**: `type`
- **값**: `design` (또는 `spec`) | `knowledge`
- **역할**: 문서가 시스템 구조에 편입되는 **설계 자산**인지, 맥락을 보존하는 **지식 자산**인지 정의한다.

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

## 3. 문서 분류 텍소노미 상세 (13개 축)

| 그룹 | 축 (Axis) | 설명 | Design 적용 | Knowledge 적용 |
|:---:|:---|:---|:---:|:---:|
| **Identity** | `type` | 문서의 근본 성격 | 필수 | 필수 |
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

## 4. 제약 및 직교성 규칙

1.  **D-19 상호 배제**: `type: design` 문서와 `knowledge_kind` 필드는 공존할 수 없다.
2.  **Tier 독립성**: `tier: system` 문서는 다른 `system` 문서를 `contains`로 소유할 수 없다.
3.  **확장자 정합성**: `type: design` 문서는 반드시 설계용 확장자(`.spec`, `.rule` 등)를 가져야 한다.
4.  **좌표 유일성**: 동일한 `(type, tier, scope, aspect, layer)`를 가진 문서는 유일해야 한다 (중복 감지 대상).
