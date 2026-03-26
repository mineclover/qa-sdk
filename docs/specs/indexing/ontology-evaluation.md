---
def:
  id: ontology-eval
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
    - target: data-design-spec
      type: depends_on
---

# 좌표 시스템의 온톨로지 스키마 표현력 평가

## 목적 ^purpose

좌표 시스템(Coordinate System)이 RDF/OWL 온톨로지의 **스키마 영역**을 어디까지 담을 수 있는지 평가한다.
이 평가는 좌표 시스템의 경계를 확인하고, 그 위에 구축될 데이터 저장 계층의 요구사항을 도출하기 위한 것이다.

기반 문서: [data-design.md](data-design.md) · [foundation.md](foundation.md)

## 구성 ^overview

- **CAN (직접 표현 가능)**: rdfs:Class → VersionedAxis, Named Individuals → entries[position], Versioning → headroom 기반 구조적 진화, N-ary Relations → 다차원 PrefixDef
- **PARTIAL (표현 가능하나 미강제)**: rdf:Property → relational prefix, rdfs:domain/range → dims 선언, Namespace → PrefixDef.id (외부 참조 불가)
- **GAP (표현 불가)**: rdfs:subClassOf(계층), owl:Restriction(카디널리티), TransitiveProperty(추론) — 인코딩 코어 변경 없이 타입 필드 추가로 해결 가능
- **고유 강점**: 산술적 identity(정수), O(1) 주소 연산, headroom 기반 진화, 재귀 주소 해석, 차원 합성·분해 동치
- **경계**: 좌표는 주소를 부여할 뿐, 저장·질의·추론은 데이터 저장 계층의 책임

---

## 전제: 좌표 시스템이란

이 시스템은 **데이터를 저장하지 않는다.** 유한한 개념 조합에 정수 주소를 부여하는 좌표 시스템이다.

| 좌표 시스템이 하는 것 | 좌표 시스템이 하지 않는 것 |
|---|---|
| 차원 정의 (shape, capacity, entries) | 값/사실(fact) 저장 |
| 주소 할당 (encode: 좌표 → 정수) | 데이터 질의 (query) |
| 주소 해석 (decode: 정수 → 좌표) | 추론 (inference) |
| 버전 관리 (headroom, migration mapping) | 트랜잭션, 일관성 보장 |
| 주소 공간 간 참조 (prefix_ref) | 인스턴스 데이터 CRUD |
| 범위 산술 (calcAddressRanges) | 영속성 (persistence) |

GPS가 좌표를 부여하되 그 위치에 무엇이 있는지는 모르는 것과 같다.

---

## RDF/OWL 개념별 대응 평가

### CAN — 좌표 시스템이 직접 표현 가능

| RDF/OWL 개념 | 좌표 시스템 대응 | 설명 |
|---|---|---|
| **rdfs:Class** | `VersionedAxis` | 클래스 = 유한 집합(entries). 버전별 확장/축소 가능. capacity가 슬롯 예산 역할. |
| **Named Individuals** | `entries[position]` | 인스턴스 = entries의 항목. position이 안정 정수 ID. RDF의 URI보다 강한 보장 (정수 = bitmask/BETWEEN 직접 활용). |
| **Versioning** | `VersionedAxis.versions` + headroom | RDF의 `owl:versionIRI`는 관례 수준. 좌표 시스템은 구조적으로 강제 — headroom으로 주소 안정성 보장, stride 변경 시 자동 migration mapping. |
| **N-ary Relations** | 다차원 `PrefixDef` | RDF는 트리플(3-ary)이 기본, N-ary는 reification(보조 노드 + 4 트리플)이 필요. 좌표 시스템은 차원 추가로 네이티브 지원. |

### PARTIAL — 표현 가능하나 강제되지 않음

| RDF/OWL 개념 | 좌표 시스템 대응 | 부족한 점 |
|---|---|---|
| **rdf:Property** | `relational` prefix (subject × predicate × object) | 스키마 수준 트리플 패턴은 표현 가능. 그러나 속성 자체의 메타데이터(domain, range, inverse, transitivity)를 부착하는 표준 방법 없음. |
| **rdfs:domain / rdfs:range** | `PrefixDef.dims` 선언 | prefix 내부에서는 dims가 도메인/레인지 역할. cross-prefix 강제는 불가. |
| **Namespace / URI** | `namespace` axis + `PrefixDef.id` | 단일 카탈로그 내 유일성은 보장. 외부 카탈로그 참조(owl:imports), IRI 해석, 페더레이션은 없음. |

### GAP — 좌표 시스템으로 표현 불가

| RDF/OWL 개념 | 부재 이유 | 확장 방향 |
|---|---|---|
| **rdfs:subClassOf** (클래스 계층) | 축 entries는 평면 열거. 계층 관계 없음. | `VersionedAxis`에 optional `parent` 필드, 또는 entries 내 range 기반 서브셋 규약 |
| **owl:Restriction** (카디널리티, allValuesFrom) | 조건부 제약 메커니즘 없음. capacity는 무조건적 전역 상한. | `PrefixDef`에 `constraints` 필드: 조건부 카디널리티, 값 범위 규칙 |
| **owl:TransitiveProperty / SymmetricProperty / inverseOf** | 추론 규칙 영역. 좌표 시스템은 순수 주소 할당. | 외부 추론 엔진이 결과를 entries로 사전 물질화(materialize) |

---

## 구조적 차이: 그래프 모델 vs 좌표 모델

| | RDF 그래프 모델 | 좌표 시스템 |
|---|---|---|
| **기본 단위** | (subject, predicate, object) 트리플 | [d₁, d₂, …, dₙ] → 1D 정수 |
| **조회** | 그래프 순회 O(edges) | encode/decode O(dims) |
| **세계관** | 오픈 월드 (임의 URI 생성 가능) | 클로즈드 월드 (capacity 예산 내) |
| **인스턴스 ID** | URI (임의 문자열) | 안정 정수 (산술 연산 가능) |
| **스키마 진화** | 관례 (owl:versionIRI) | 구조적 (headroom + migration) |
| **N-ary 관계** | reification (보조 노드) | 네이티브 (차원 추가) |
| **저장** | 트리플 스토어 (스키마와 데이터 동일 모델) | **좌표만 정의, 저장은 별도 계층** |

마지막 행이 핵심 차이다. RDF는 스키마와 데이터가 동일한 트리플 모델에 혼재하지만, 좌표 시스템은 **스키마(주소 체계)만 정의**하고 데이터 저장은 상위 계층에 위임한다.

---

## 좌표 시스템 고유의 강점

RDF가 제공하지 않는, 좌표 시스템의 구조적 이점:

1. **산술적 identity**: 모든 개념 조합 = 유일한 정수. bitmask 집합 연산, BETWEEN 범위 쿼리, JWT claim 직접 탑재.
2. **O(1) 주소 연산**: encode/decode가 곱·나눗셈·모듈러. 그래프 순회 불필요.
3. **headroom 기반 진화**: capacity 선언으로 기존 주소를 보존하면서 인스턴스 추가. 스키마 변경 빈도를 구조적으로 최소화.
4. **재귀 주소 해석**: `resolveAddress`로 1D 정수 → 전체 차원 트리 복원. prefix_ref를 통한 cross-space 의미 추적.
5. **차원 합성·분해 동치**: sub-prefix 합성 결과와 직접 인코딩 결과가 수학적으로 동일함을 보장.

---

## 결론: 좌표 시스템의 경계

좌표 시스템은 온톨로지의 **스키마 확장(extension)**, **관계 유형 정의**, **인스턴스 열거**를 담을 수 있고, 인코딩 효율과 버전 관리에서 RDF를 능가한다.

3개 GAP(계층, 제약, 추론)은 좌표 시스템의 본질적 한계가 아니라 **아직 구현되지 않은 스키마 확장**이다. 인코딩 코어(mixed-radix + prefix_ref)를 변경하지 않고 타입 필드 추가만으로 해결 가능하다.

그러나 좌표 시스템이 하지 않는 것이 분명히 있다:

> **좌표는 주소를 부여한다. 그 주소에 무엇이 저장되어 있는지는 데이터 저장 계층의 책임이다.**

이 경계가 다음 단계 — 좌표 시스템 위에 구축되는 데이터 저장 계층 — 의 출발점이다.
