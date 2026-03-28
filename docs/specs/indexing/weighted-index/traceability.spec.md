---
def:
  id: wi-traceability-spec
  address: def_document:v1:547
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: deprecated
  layer: domain
  tags: [testing]
  links:
    - target: wi-codec
      type: traces_to
    - target: range-query-spec
      type: traces_to
---
# weighted-index 변경 전파 추적성

## 목적 ^purpose

weighted-index가 DKG 성장 나선의 가장 안쪽 고리로서
단일 축/prefix 내부의 변경 전파를 어떻게 추적하고,
상위 계층에 어떤 계약을 제공하는지 정의한다.

기반: [core.spec.md](core.spec.md) · [../../spec-engine/design-knowledge-graph.md](../../spec-engine/design-knowledge-graph.md) · [../foundation.md](../foundation.md) · [../coordinate-states.md](../coordinate-states.md)

---

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

## 변경 유형과 전파 경로

### 유형 1: headroom 내 entry 추가 (안전)

```
role v3: entries=[admin, dev, op, viewer, ro, customer], capacity=8
role v4: entries=[admin, dev, op, viewer, ro, customer, auditor], capacity=8

max: 8 → 8 (불변)
shape: [8, 4] → [8, 4] (불변)
stride: [4, 1] → [4, 1] (불변)
```

**전파:** 없음. 기존 주소가 모두 보존된다. 새 entry는 기존에 비활성(headroom)이었던 position을 활성화할 뿐이다.

```
DKG 관점:
  VersionEvent: { kind: "entry-added", detail: "position 6에 'auditor' 추가" }
  impact: "shape 불변. 기존 주소 보존. no-impact"

  diff() 결과: changedLabels = [] (max가 안 바뀌었으므로)
```

### 유형 2: capacity 변경 (stride-break)

```
role v2: capacity=6
role v3: capacity=8

permission pv2: shape=[6, 4] → stride=[4, 1], size=24
permission pv3: shape=[8, 4] → stride=[4, 1], size=32

stride는 같지만 size가 다르다.
같은 좌표 [6, 4]가 pv2에서는 주소 23 (마지막), pv3에서는 23 (중간).
```

이 경우 stride는 같지만 **주소 공간 크기가 다르다.** 새 주소(24~31)가 생겼다.

```
diff() 결과:
  changedLabels: [{ label: "role", fromMax: 6, toMax: 8 }]

DKG 관점:
  VersionEvent: { kind: "capacity-changed", detail: "role capacity 6→8" }
  Decision: DEC-001 "bitmask 정렬 최적화"
  impact: "size 24→32. 기존 좌표의 주소값은 동일하지만, bitmask 크기가 변경됨"
```

### 유형 3: shape 재구성 (full stride-break)

```
permission pv_old: labels=[role, action]    shape=[8, 4]   stride=[4, 1]
permission pv_new: labels=[role, action, resource]  shape=[8, 4, 16]  stride=[64, 16, 1]

stride[0]: 4 → 64  ← 완전히 다른 주소 체계
```

**모든 기존 주소의 의미가 바뀐다.** 전체 re-encode가 필요하다.

```
diff() 결과:
  changedLabels: [{ label: "resource", fromMax: 0, toMax: 16 }]  (새 차원 추가)

DKG 관점:
  VersionEvent: { kind: "dim-added", detail: "resource 차원 추가" }
  impact: "full stride-break. 모든 기존 주소 re-encode 필요"

migrate() 사용:
  registry.migrate(
    { prefix: "permission", v: "pv_old", id: 5 },
    "pv_new",
    (oldCoords, oldLabels, newLabels) => {
      // 2D → 3D: 새 차원에 기본값 1 부여
      return [...oldCoords, 1];
    }
  );
```

### 유형 4: prefix_ref 대상 변경

```
permission의 perm_svc 차원이 service prefix를 참조
service prefix의 shape이 바뀌면 → perm_svc의 max도 바뀐다

이 변경은 weighted-index 내부에서 자동 전파되지 않는다.
상위 계층(demo-accessors, DKG)이 감지하고 새 prefix version을 생성해야 한다.
```

**이것이 weighted-index의 경계다.** prefix 간 참조 전파는 호출자의 책임이다.

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

---

## 수정의 프로토콜

### 새 entry 추가 (headroom 내)

```
1. LabelRegistry에 새 version 추가 (기존 ids + 새 id append)
2. 새 version의 max ≤ 기존 capacity → shape 불변 확인
3. 기존 prefix version은 그대로 유지 (shape이 안 바뀌므로)
4. DKG: VersionEvent(entry-added) 기록
```

### 새 entry 추가 (headroom 초과)

```
1. LabelRegistry에 새 version 추가 (새 capacity 설정)
2. 새 prefix version 생성 (새 label version 핀)
3. shape 변경 → 새 WeightedIndex 생성
4. 기존 주소 마이그레이션: migrate(old_vi, new_version, migrator)
5. DKG: VersionEvent(capacity-changed) + Decision(왜 이 capacity인가)
```

### 차원 추가

```
1. 새 label 정의 (LabelRegistry에 추가)
2. 새 prefix version 생성 (labels 배열 확장 + 새 label version 핀)
3. shape 변경 → full stride-break
4. 전체 re-encode: migrate(old_vi, new_version, migrator)
5. DKG: VersionEvent(dim-added) + Decision(왜 이 차원인가)
```

### 차원 제거

```
차원은 제거하지 않는다.
비활성화만 한다 (coordinate-states.md 참조).
position은 영구히 entry와 연결되어 있다.

DKG: Decision("왜 제거가 아니라 비활성화인가")
  → position 항등성 보존이 append-only 불변식의 핵심이므로
```

---

## 상위 계층에 제공하는 계약

### DKG에 제공하는 것

| 계약 | 메서드 | DKG에서의 용도 |
|---|---|---|
| **변경 감지** | `diff(prefix, from, to)` | VersionEvent의 changes 필드 근거 |
| **영향 판정** | shape 비교 (fromMax vs toMax) | stride-break 여부 → impact 등급 |
| **마이그레이션 경로** | `migrate(vi, toVersion, migrator)` | 주소 변환 실행 가능성 |
| **범위 산출** | `calcAddressRanges(shape, constraints)` | 영향받는 주소 구간 |

### qa-sdk에 제공하는 것

| 계약 | 메서드 | qa-sdk에서의 용도 |
|---|---|---|
| **인코딩** | `encode/encodeFromIds` | 서비스 경계에서 좌표 → 주소 변환 |
| **디코딩** | `decode/decodeToIds` | 주소 → 좌표 복원 |
| **직렬화** | `serialize/parse` | DB 저장/복원 (`prefix:v:id`) |
| **버전 확인** | `isCurrent(vi)` | 마이그레이션 필요 여부 판단 |
| **부분 바인딩** | `createBinder(codec, prefix, fixedDims)` | SDK 부트 시 고정 차원 캐시 |

### weighted-index가 하지 않는 것

| 하지 않는 것 | 책임 주체 |
|---|---|
| prefix 간 참조 전파 (prefix_ref) | demo-accessors |
| 도메인/바운더리 관리 | DKG Domain 노드 |
| 서비스 소비자 추적 | DKG Consumer 노드 + qa-sdk |
| 연결 의도 보존 | DKG IntentLink |
| 런타임 버전 호환성 검증 | qa-sdk registry |
| 비활성화/활성 영역 관리 | index-meta EntryFlagStore |

---

## 전파 추적 시나리오

### 시나리오: role 축에 entry 추가

```
현재 상태:
  role v3: ["admin","dev","op","viewer","ro","customer"], capacity=8
  permission pv3: { role: v3, action: v1 }, shape=[8, 4]

변경: "auditor" 추가

weighted-index 내부:
  1. LabelRegistry: role v4 = [..., "auditor"], max=8 (capacity 내)
  2. PrefixCodec: shape 불변 확인 → 새 prefix version 불필요
  3. diff("permission", "pv3", "pv3") → changedLabels: [] (max 동일)

DKG (1단계 → 4단계):
  1. VersionEvent(VE-role-v3-v4): entry-added, impact=no-impact
  2. composes: Axis(role) ← Prefix(permission, rbac) → 영향 전파
  3. contains: Domain(shopping) → Prefix(permission) → 도메인 범위 확인
  4. consumes: Domain(shopping) ← Consumer(auth-service, payment-service)
     → "shape 불변이므로 서비스 마이그레이션 불필요"

qa-sdk:
  · registry에 role v4 등록
  · 기존 prefix version으로 계속 운용
  · 새 entry "auditor"로 encode 가능
```

### 시나리오: role capacity 확장 (stride-break)

```
현재 상태:
  role v4: capacity=8
  permission pv3: shape=[8, 4], size=32

변경: 9번째 role이 필요 → capacity 8→16

weighted-index 내부:
  1. LabelRegistry: role v5, capacity=16, max=16
  2. PrefixCodec: permission pv4 = { role: v5, action: v1 }, shape=[16, 4]
  3. 새 WeightedIndex([16, 4]): stride=[4, 1], size=64
  4. diff("permission", "pv3", "pv4"):
       changedLabels: [{ label:"role", fromMax:8, toMax:16 }]
  5. migrate(pv3_address, "pv4", coords => coords):
       좌표 동일, 주소값도 동일 (stride[0]=4 불변)
       단, size가 32→64로 증가 → bitmask 크기 변경

DKG:
  1. VersionEvent: capacity-changed, fromMax:8, toMax:16
  2. Decision: "왜 16인가 — 다음 stride-break까지 최대 여유"
  3. impact: "size 변경. bitmask 재생성 필요. 주소값 자체는 보존"
  4. Constraint 검사: CON-001(rbac_role≠role) 여전히 유효
  5. Consumer cascade: auth-service, payment-service에 bitmask 갱신 필요

qa-sdk:
  · permission pv4 등록
  · 기존 pv3 주소는 decode 계속 가능 (v 필드로 구분)
  · 새 인코딩은 pv4로 수행
  · bitmask 크기 32→64 바이트로 재생성
  · 트래커가 서비스 간 버전 호환성 검증
```

---

## 불변식

1. **calcWeights는 유일한 stride 계산원이다.** WeightedIndex 생성자가 이를 호출한다. 다른 경로로 stride를 계산하지 않는다.
2. **ids 배열은 append-only.** 기존 entry의 position(index)은 어떤 version에서도 변하지 않는다.
3. **VersionedIndex의 v 필드는 decode의 필수 조건이다.** v 없이 id만으로는 좌표를 복원할 수 없다.
4. **prefix version의 labelVersions 스냅샷은 생성 후 불변이다.** 수정이 필요하면 새 version을 만든다.
5. **diff()는 순수 함수다.** 상태를 변경하지 않는다. 두 버전 사이의 차이를 읽기만 한다.
6. **migrate()는 새 VersionedIndex를 반환한다.** 기존 VersionedIndex를 수정하지 않는다.
7. **prefix_ref 전파는 weighted-index의 책임이 아니다.** 호출자(demo-accessors, DKG)가 참조 체인을 추적해야 한다.
