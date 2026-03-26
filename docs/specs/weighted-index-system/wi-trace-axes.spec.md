---
def:
  id: wi-trace-axes
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-trace-group
      type: member_of
    - target: wi-math
      type: depends_on
---
# weighted-index 추적성의 3축

## 목적 ^purpose

추적성의 3축: 역할(producer/consumer/auditor), 변경 유형(additive/reductive/structural), 고정(stride/capacity/shape).

## 구성 ^overview

- **주소 항등성**: 같은 shape + 같은 좌표 = 항상 같은 정수 (stride가 shape의 결정론적 함수)
- **버전 격리**: prefix:version:id 삼중체가 decode의 열쇠, 서로 다른 version의 주소는 독립적
- **변경 감지**: diff()로 두 버전 간 changedLabels, fromMax→toMax를 구조적으로 기술
- **5단계 cascade**: weighted-index(diff) → DKG composes → DKG contains/references → DKG consumes → qa-sdk 런타임
- **3-tier 핀 구조**: label version(어휘 고정) → prefix version(shape 고정) → WeightedIndex(stride 고정)
- **핀 불변식**: ids 배열 append-only, labelVersions 스냅샷 생성 후 불변, shape→stride→encode/decode 불변
- **연쇄 규칙**: label version 변경 → 새 prefix version 필요 → 새 WeightedIndex 생성, 기존 핀은 절대 수정 불가

---


## 참조

기반: [wi-math.spec.md](wi-math.spec.md) · [../../spec-engine/design-knowledge-graph.md](../../spec-engine/design-knowledge-graph.md)

## 역할 정의

weighted-index는 **변경 전파의 수학적 기반**이다.

```
DKG 영향 분석 질의: "role 축 변경의 전체 cascade"

  1단계  weighted-index (이 문서)
         diff() → "어떤 label이, 어떻게 바뀌었는가"
         shape 비교 → "stride-break인가, 안전한가"
         migrate() → "기존 주소를 새 주소로 어떻게 변환하는가"

  2단계  DKG composes
         Axis(role) ←── Prefix(permission, rbac)
         → "어떤 prefix가 영향받는가"

  3단계  DKG contains / references
         Domain(shopping) ──→ Prefix(permission)
         Prefix(event) ──ref──→ Prefix(service)
         → "어떤 도메인, 어떤 참조 체인이 영향받는가"

  4단계  DKG consumes
         Domain(shopping) ←── Consumer(auth-service, payment-service)
         → "어떤 서비스가 영향받는가"

  5단계  qa-sdk 런타임
         registry 조회 → 실제 버전 호환성 검증 + 마이그레이션 실행
```

weighted-index는 1단계를 담당한다. 나머지는 상위 계층의 책임이다.

---

## 추적성의 세 축

### 1. 주소 항등성 (Address Identity)

**계약: 같은 shape + 같은 좌표 = 항상 같은 정수.**

```
encode([admin=1, write=2, users=4], shape=[8,4,16]) = 19

이 대응은 shape이 [8,4,16]인 한 영원하다.
shape, 좌표가 같으면 encode 결과는 언제, 어디서, 누가 호출해도 19이다.
```

이것이 가능한 이유:

```
stride = calcWeights(shape)     ← shape에서 결정론적으로 파생
address = Σ (x_i - 1) × stride[i]  ← 순수 산술, 부작용 없음
```

**stride가 shape의 함수**이므로, shape이 불변이면 주소 대응도 불변이다. 이것이 좌표 시스템의 "닫힌 세계"가 안정적으로 동작하는 수학적 근거다.

### 2. 버전 격리 (Version Isolation)

**계약: 서로 다른 version의 주소는 독립적이다. 혼용하면 안 된다.**

```
VersionedIndex = { prefix, v, id }

permission:pv1:19  ≠  permission:pv3:19

같은 id=19이지만 shape이 다르므로 다른 좌표를 의미한다.
v 없이 id만으로는 decode가 불가능하다.
```

격리의 메커니즘:

```
PrefixCodec 내부:
  indexCache: Map<"permission:pv1", WeightedIndex([5,4])>
              Map<"permission:pv3", WeightedIndex([8,4])>

  encode("permission", coords, "pv1") → pv1 전용 WeightedIndex 사용
  encode("permission", coords, "pv3") → pv3 전용 WeightedIndex 사용
```

**v 필드가 decode의 열쇠다.** 이것이 없으면 같은 정수가 서로 다른 좌표로 해석된다. DB에 저장할 때 반드시 `{ prefix, v, id }` 삼중체를 함께 저장해야 한다.

### 3. 변경 감지 (Change Detection)

**계약: 두 버전 사이의 차이를 구조적으로 기술할 수 있다.**

```typescript
diff("permission", "pv1", "pv2")
→ {
    prefix: "permission",
    from: "pv1",
    to: "pv2",
    changedLabels: [{
      label: "role",
      fromLabelVersion: "v1", fromMax: 5,
      toLabelVersion: "v2", toMax: 6
    }]
  }
```

diff가 제공하는 정보:

| 정보 | 용도 |
|---|---|
| 어떤 label이 바뀌었는가 | DKG composes 엣지의 출발점 |
| fromMax → toMax | stride-break 여부 판정 |
| fromLabelVersion → toLabelVersion | LabelRegistry의 entry 변경 내용 추적 |

---

## 버전 고정의 메커니즘

### 3-tier 핀 구조

```
LabelRegistry (축별 어휘)
  └─ label "role"
       ├─ v1: ids=["admin","dev","op","viewer","ro"]        → max=5
       ├─ v2: ids=["admin","dev","op","viewer","ro","customer"] → max=6
       ├─ v3: (capacity=8, entries 동일)                     → max=8
       └─ v4: ids=[...,"auditor"]                           → max=8

  핀 ①: label version이 entity 목록을 고정한다
         → position 항등성: ids[0]="admin"은 모든 version에서 index=1

PrefixCodec (prefix별 버전 핀)
  └─ prefix "permission"
       ├─ pv1: { role: v1, action: v1 } → shape=[5, 4]
       ├─ pv2: { role: v2, action: v1 } → shape=[6, 4]
       └─ pv3: { role: v3, action: v1 } → shape=[8, 4]

  핀 ②: prefix version이 label version 조합을 고정한다
         → shape 결정론: pv3은 항상 [8, 4]

WeightedIndex (수학 엔진)
  └─ indexCache: "permission:pv3" → WeightedIndex([8, 4])

  핀 ③: shape이 stride를 고정한다
         → 주소 항등성: shape=[8,4]에서 좌표 [1,1]은 항상 0
```

### 핀의 불변식

| 핀 | 불변식 | 위반 시 |
|---|---|---|
| ① label version | ids 배열은 append-only. 기존 순서 변경 금지. | 기존 index의 의미가 바뀜 → 모든 주소 무효 |
| ② prefix version | labelVersions 스냅샷은 생성 후 불변. | shape가 바뀌어 stride 불일치 |
| ③ WeightedIndex | shape → stride → encode/decode 모두 불변. | 같은 좌표가 다른 정수를 반환 |

**핀은 위에서 아래로 연쇄한다:** label version이 바뀌면 → 새 prefix version이 필요하고 → 새 WeightedIndex가 생성된다. 기존 version의 핀은 절대 수정되지 않는다.
