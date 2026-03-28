---
def:
  id: data-design-spec
  address: def_document:v2:342156
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
---
# 좌표 시스템 설계 구조

## 목적 ^purpose

유한한 개념 조합에 정수 주소를 부여하는 **좌표 시스템(Coordinate System)**의 설계 구조.
닫힌 공간 압축, 차원 편입, 범위 기반 주소 연산, 캐싱 전략이 하나의 좌표 체계로 결합된다.

**이 시스템은 데이터를 저장하지 않는다.** 주소를 부여하고 해석할 뿐이다. 데이터 저장은 별도 계층의 책임이다.

기반 원리: [`foundation.md`](foundation.md) · 파이프라인: [`pipeline.md`](pipeline.md) · 사용 패턴: [`patterns.md`](patterns.md) · 벤치마크: [`benchmarks.md`](benchmarks.md) · 온톨로지 대응: [`ontology-evaluation.md`](ontology-evaluation.md)

---

## 좌표 시스템이란

GPS가 지표면의 모든 지점에 (위도, 경도) 좌표를 부여하되 그 지점에 무엇이 있는지는 모르듯, 이 시스템은 도메인의 모든 유한한 조합에 정수 좌표(주소)를 부여하되 그 주소에 저장된 데이터는 관여하지 않는다.

| 좌표 시스템이 하는 것 | 좌표 시스템이 하지 않는 것 |
|---|---|
| 차원 정의 (shape, capacity, entries) | 값/사실(fact) 저장 |
| 주소 할당 (encode: 좌표 → 정수) | 데이터 질의 (query) |
| 주소 해석 (decode: 정수 → 좌표) | 추론 (inference) |
| 버전 관리 (headroom, migration mapping) | 트랜잭션, 일관성 보장 |
| 주소 공간 간 참조 (prefix_ref) | 인스턴스 데이터 CRUD |
| 범위 산술 (calcAddressRanges) | 영속성 (persistence) |

**핵심 공리**: 모든 유한한 조합은 하나의 정수가 된다. 이 정수가 주소(address)다.

```
                     ┌─────────────────────────────────────────┐
                     │           좌표 시스템 설계 구조           │
                     │                                         │
  ┌──────────┐       │  ① 차원 압축     닫힌 공간 → 정수       │
  │ 비즈니스  │       │  ② 차원 편입     정수 → 상위 차원의 값   │
  │ 모델     │──────▶│  ③ 의미 부여     정수 ↔ entity 이름     │
  │          │       │  ④ 범위 연산     주소 구간으로 집합 표현  │
  │          │       │  ⑤ 캐싱 전략     사전 계산 + 런타임 판정  │
  │          │       │  ⑥ 통합 카탈로그  전체 주소 체계 SSOT     │
  └──────────┘       └─────────────────────────────────────────┘
                                        │
                                        ▼
                     ┌─────────────────────────────────────────┐
                     │      데이터 저장 계층 (다음 단계)          │
                     │  좌표 시스템이 부여한 주소에 값을 저장     │
                     └─────────────────────────────────────────┘
```

---

## ① 차원 압축 — 닫힌 공간을 정수로

비즈니스 도메인의 유한한 선택지 조합을 하나의 정수로 압축한다.

```
role(10) × action(20) × resource(50) = 10,000가지 조합
                                        ↓
                              WeightedIndex([10, 20, 50])
                                        ↓
                              0 ~ 9,999 범위의 정수 (주소)
```

하나의 정수가 곧 주소이며, 주소에서 원래 조합을 완전히 복원할 수 있다 (전단사).

**성능**: encode 8ns, decode 27ns (3D 기준). 차원이 늘어도 차원당 ~수ns 추가.

---

## ② 차원 편입 — 압축 결과를 상위 차원에 포함

하위 인덱스의 압축 결과(정수)가 상위 인덱스의 **하나의 차원 값**이 된다. 이를 통해 인덱스 간 계층이 형성된다.

```
L0: format(3) × lang(4) = 12                    ← 문서 메타 조합
L1: doc_meta(→L0, 12) × priority(5) = 60         ← 문서 메타를 차원으로 편입
L2: article(→L1, 60) × region(8) = 480           ← 다시 편입
```

### 종단 탐사 (end-to-end traversal)

최상위 주소 하나로 전체 계층을 탐사할 수 있다:

```
encode: format=2, lang=3 → L0=9 → doc_meta=9, priority=4 → L1=48 → L2 encode
decode: L2 index → article → L1 decode → doc_meta → L0 decode → format, lang
```

각 레벨에서 수행하는 연산은 동일한 encode/decode이므로, 종단 비용은 레벨 수에 선형이다.

**성능**: 4레벨 500만 공간에서 종단 decode 86ns, zero-alloc 63ns.

### 편입의 의미

편입된 차원은 상위에서 보면 "하나의 값"이지만, 하위로 내려가면 다시 다차원으로 펼쳐진다. 이것이 **차원 압축**의 핵심이다 — 복잡한 하위 구조를 단일 차원으로 추상화하되, 필요할 때 언제든 원래 구조를 복원할 수 있다.

```
상위에서 본 모습:    article(60) × region(8)     ← 2차원처럼 보임
실제 내부 구조:      (format(3) × lang(4)) × priority(5) × region(8)  ← 4차원
```

---

## ③ 의미 부여 — 주소와 entity 이름의 양방향 매핑

주소(정수)는 그 자체로는 의미가 없다. 의미를 부여하는 것은 **각 차원의 entity 목록**이다. 이것은 좌표에 라벨을 붙이는 것이지, 데이터를 저장하는 것이 아니다.

```
차원 "role" entries: ["admin", "editor", "viewer", ...]
                      pos 1    pos 2     pos 3

주소 14 → 좌표 [2, 2, 3] → { role: "editor", action: "write", resource: "doc" }
```

### 파이프라인 레이어

정보 저장/해석은 레이어별로 관심사가 분리된다:

```
MetaCodec.decode(vv)                      ← 정보 해석 (193ns)
  └─ PrefixCodec.decodeToIds()
       ├─ WeightedIndex.decode(value)     ← 좌표 복원 (27ns)
       └─ LabelRegistry.get(position)     ← entity 이름 (Map O(1))
```

| 레이어 | 하는 일 | 비용 |
|---|---|---|
| WeightedIndex | 정수 → 좌표 (수학) | 27ns |
| LabelRegistry | 좌표 → entity 이름 (Map lookup) | +130ns |
| MetaCodec | 위 둘을 결합 + 검증 | = 193ns |

**핵심**: entity 수가 5개든 500개든 Map O(1) lookup이므로 정보 해석 비용은 거의 불변 (185ns → 211ns).

### 양방향성

같은 구조로 encode와 decode가 모두 가능하다:

```
encode: { role: "editor", action: "write" } → Map lookup → coords → 정수
decode: 정수 → coords → Map lookup → { role: "editor", action: "write" }
```

DB에 정수(또는 UUID)만 저장하면, 언제든 원래 entity 조합을 복원할 수 있다.

---

## ④ 범위 제어 — 주소 구간으로 집합을 표현

주소 공간에서 특정 차원을 고정하면, 나머지 차원의 모든 조합이 **연속된 주소 구간**으로 나타난다. 이것이 `calcAddressRanges`다.

```
shape: [10, 20, 50]   (role × action × resource = 10,000)

"role=admin인 모든 주소":
  calcAddressRanges([10,20,50], ["1", null, null])
  → [[0, 999]]    ← 연속 1,000개 주소가 하나의 구간
```

### 활성/비활성 제어

범위를 사용하면 특정 주소 집합을 **비활성화**할 수 있다. entries에서 항목을 삭제하면 좌표가 깨지므로, 대신 범위로 "이 주소들은 사용하지 않는다"고 선언한다.

```
"action=delete 비활성화":
  matchRanges({ action: "delete" })
  → 비활성 범위 획득

런타임 검사:
  containsAddress(address, inactiveRanges)
  → true면 비활성 주소 → 거부
```

비활성 주소로 이전에 인코딩된 값은 여전히 decode 가능하다 — 주소 자체를 삭제하는 것이 아니라 **사용 여부만 제어**하는 것이다.

### 범위 연산

범위는 집합 연산이 가능하다:

| 연산 | 함수 | 용도 |
|---|---|---|
| 합집합 | `mergeRanges(a, b)` | 두 조건의 OR |
| 교집합 | `intersectRanges(a, b)` | 두 조건의 AND |
| 차집합 | `subtractRanges(base, exclude)` | 특정 범위 제외 |
| 여집합 | `complementRanges(capacity, excluded)` | 허용 범위 계산 |
| 판정 | `containsAddress(addr, ranges)` | O(log n) binary search |

이 연산들로 복잡한 권한 로직을 주소 구간의 집합 연산으로 표현할 수 있다.

---

## ⑤ 캐싱 전략 — 사전 계산과 런타임 분리

### 문제: 비연속 OR 제약의 조합 폭발

대부분의 범위 계산은 빠르지만 (연속 제약 = 수백만 ops/s), 비연속 OR 제약이 여러 차원에 동시에 걸리면 범위 수가 곱으로 폭발한다.

```
shape=[8,8,8,8,8,8]
constraints=["1-3", null, "2,5,7", null, null, "1-4"]
→ 4,608개 범위, ~1ms
```

### 해법: 빌드 타임 분리

비용이 큰 범위 계산은 **1회 사전 계산**하고, 런타임에는 결과만 참조한다.

```
┌─────────────────────────────────────────────────────────┐
│  빌드 타임 (서버 기동 / 스키마 변경 시, 1회)              │
│                                                         │
│  ① calcAddressRanges(shape, constraints)                │
│     → ranges: [number, number][]                        │
│     → 복잡한 OR도 ~1ms (허용 가능)                       │
│                                                         │
│  ② 범위를 단면 매트릭스(lookup table)로 캐시              │
│     - 비활성 범위: inactiveRanges                        │
│     - 권한별 허용 범위: permissionRanges[roleId]         │
│     - 필터별 주소 집합: filterRanges[filterKey]          │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  런타임 (매 요청)                                        │
│                                                         │
│  containsAddress(address, cachedRanges)                  │
│    → O(log n) binary search                              │
│    → 수십ns                                              │
└─────────────────────────────────────────────────────────┘
```

### 캐시 무효화

캐시는 스키마가 변경될 때만 재계산하면 된다:

| 이벤트 | 캐시 영향 |
|---|---|
| 엔트리 추가 (capacity 내) | 범위 불변 — 신규 엔트리의 범위만 추가 계산 |
| 엔트리 비활성화 | 비활성 범위 재계산 (또는 incremental 추가) |
| 버전 변경 (shape 변경) | 전체 재계산 (새 shape 기준) |

shape이 바뀌면 모든 주소의 의미가 바뀌므로 전체 재계산이 필요하지만, capacity headroom 설계 덕분에 shape 변경은 드물다.

---

## 좌표 시스템 구축 흐름

```
비즈니스 모델 정의
  │
  │  "역할 × 액션 × 리소스로 권한을 관리하겠다"
  ▼
① 차원 압축
  │  shape = [10, 20, 50]
  │  WeightedIndex → 10,000가지 조합을 정수 0~9,999로
  ▼
② 차원 편입 (필요 시)
  │  하위 인덱스 압축값을 상위 차원에 포함
  │  permission(10,000) × tenant(100) = 1,000,000
  ▼
③ 의미 부여
  │  MetaCodec: { role: "admin", action: "read", resource: "doc" } ↔ 정수
  │  좌표에 라벨을 붙임 (저장이 아님)
  ▼
④ 범위 연산
  │  matchRanges({ role: "admin" }) → [[0, 999]]
  │  "admin의 모든 권한" = 주소 0~999
  ▼
⑤ 캐싱
  │  복잡한 범위를 사전 계산하여 단면 매트릭스로 보관
  │  런타임: containsAddress(addr, cached) → O(log n)
  ▼
⑥ 통합 카탈로그
  │  전체 축과 prefix를 DEMO_CATALOG 하나로 관리
  │  prefix_ref로 주소 공간 간 참조
  ▼
좌표 시스템 완성
  │  encode/decode: ~200ns, 범위 판정: ~수십ns, cross-index 종단: ~400ns
  │  ↑ 여기까지가 좌표 시스템의 경계
  │
  ▼
데이터 저장 계층 (다음 단계)
  │  좌표에 값/사실을 저장, 질의, 영속성 제공
```

---

## 좌표 시스템 설계 원칙

### 주소가 identity다

좌표 시스템의 모든 조합은 정수 하나로 귀결된다. 이 정수는 단순 인코딩 결과가 아니라 **데이터의 정체성(identity)**이다:
- **복원**할 수 있다 (decode → 원래 entity 조합)
- **비교**할 수 있다 (범위 쿼리, BETWEEN)
- **압축**할 수 있다 (하위 인덱스를 상위 차원으로)
- **합성·분해**할 수 있다 (prefix_ref를 통한 cross-space 참조)

주소는 저장 계층이 사용할 키이지만, 좌표 시스템 자체는 그 키에 무엇이 저장되는지 모른다.

### 구축 시점과 사용 시점의 비대칭

| | 구축 시점 (좌표 체계 정의) | 사용 시점 (런타임) |
|---|---|---|
| 범위 계산 | `calcAddressRanges` (ms) | `containsAddress` (ns) |
| 코덱 생성 | `new MetaCodec(decodeMap)` (1회) | `codec.decode(vv)` (193ns) |
| 스키마 등록 | `MetaRegistry` 구성 (ms) | `codec.encode(ids)` (167ns) |

좌표 체계를 정의하는 비용은 1회. 이후 주소 할당/해석은 서브 마이크로초.

### 불변성이 좌표 시스템의 핵심이다

- shape이 확정되면 WeightedIndex의 weights는 불변 `Float64Array`
- entries가 확정되면 LabelRegistry의 `indexToId`는 불변 `Map`
- 범위가 계산되면 `[number, number][]`은 불변 배열

좌표 시스템이 한 번 확정되면 변하지 않는다. 변경이 필요하면 새 버전을 만든다. 이 불변성이 동시 접근 안전성과 캐시 일관성을 보장한다.

---

## ⑥ 통합 카탈로그 — Prefix 기반 버전 관리 모델

차원 압축(①), 편입(②), 정보 저장(③)이 개별 인덱스 수준이었다면, **카탈로그**는 전체 주소 체계를 하나의 구조체로 통합 관리한다.

### 3-Layer 구조

```
DemoCatalog
├── axes: Record<axisId, VersionedAxis>     ← Layer 0: 1D 축 (버전별 entries/capacity/ko)
└── prefixes: Record<prefixId, PrefixDef>   ← Layer 2: N-D 주소 공간 (축 조합)
                    │
                    └── dims[label] → DimRef  ← Layer 1: 차원 참조
                         ├── { kind: "axis", axisId }
                         └── { kind: "prefix_ref", prefixId }  ← 핵심: 평행 주소 참조
```

### 차원 참조 (DimRef)

모든 차원은 고유한 의미값을 가진다:

| DimRef 종류 | value | 의미 해석 |
|---|---|---|
| `axis` | entries[position] (문자열) | 축의 엔트리 이름 + ko |
| `prefix_ref` | 참조 prefix의 1D 주소 (정수) | 재귀 decode → 참조 prefix의 차원 좌표 |

`prefix_ref`가 핵심이다 — **트리 계층이 아니라 평행한 prefix 간 주소 참조**로 복잡한 관계를 표현한다.

```
permission prefix:  [perm_svc, role]
                        │
                        └── prefix_ref → service prefix → [env, region, svc_name, namespace]

permission addr=3 → decode → { perm_svc: pos=0, role: pos=3 }
                              │              │
                              │              └── axis → "viewer" (ko: "뷰어")
                              └── prefix_ref → value=40 → service decode
                                              → { env: "prod", region: "asia", svc: "shopping-web", ns: "shop" }
```

### 차원 합성·분해 동치성

mixed-radix 인코딩의 차원 독립성에 의해, 다음이 보장된다:

```
encode(decode(addr)) === addr                    ← 모든 유효 주소에 대해 전단사
encodePrefixByValue(values) → resolveAddress     ← 의미값 왕복 일관성
service_addr → permission encode → decompose     ← prefix_ref 합성·분해 동치
```

이것이 의미하는 것:

```
"관리자가 제어함" + "A 리소스"  ≡  "관리자가 A 리소스 제어"
  └── encode(perm_svc, role)     └── encode(perm_svc, role, res)
      = sub-prefix 주소              = 상위 prefix 주소 (차원 합성)
```

sub-prefix 주소를 합성하면 상위 prefix 주소가 되고, 상위 주소를 분해하면 동일한 sub-prefix 주소를 복원한다. **prefix 구성이 같으면 결과가 동치**이므로, 어떤 경로로 인코딩해도 동일한 정수에 도달한다.

### 온톨로지 스키마 표현력

좌표 시스템은 RDF/OWL 온톨로지의 스키마 영역(클래스, 인스턴스, N-ary 관계, 버전)을 담을 수 있다. 3개 GAP(계층, 제약, 추론)은 좌표 코어를 변경하지 않는 타입 확장으로 해결 가능.

> 상세: [`ontology-evaluation.md`](ontology-evaluation.md)

---

### 정수 좌표계가 곧 가속 인터페이스다

> 상세: [`acceleration.md`](acceleration.md)

모든 도메인 데이터가 정수 좌표로 수렴하는 구조는 하드웨어 가속의 전제 조건을 자연스럽게 충족한다:

- **분기 없는 산술**: encode/decode가 순수 곱/나눗셈/모듈러 — FPGA single-cycle 가능
- **고정 크기 입출력**: shape이 정적이면 axis 수와 bit width가 고정 — 고정 폭 DMA 전송 가능
- **결정론적 key**: 동일 입력 = 동일 출력 — 하드웨어 lookup table과 캐시의 안정성 보장
- **불변 configuration**: schema가 바뀌지 않으면 FPGA bitstream 재로드 불필요

이 특성은 FPGA 가속을 위해 설계된 것이 아니라, 닫힌 공간 + 전단사 + 레이어 분리에서 자연스럽게 도출된다. packed key를 단순한 인코딩 결과가 아니라 **데이터의 identity**로 취급하는 관점이 핵심이다.
