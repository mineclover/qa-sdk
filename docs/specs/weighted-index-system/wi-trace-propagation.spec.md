---
def:
  id: wi-trace-propagation
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-trace-axes
      type: depends_on
    - target: wi-codec
      type: refines
    - target: partial-binder-spec
      type: refines
---
# weighted-index 변경 전파 경로

## 목적 ^purpose

변경 유형별 전파 경로. entry 추가(additive), entry 삭제(reductive), shape 변경(structural)이 상위 계층에 미치는 영향.

## 구성 ^overview

- **유형 1 — headroom 내 entry 추가**: shape/stride 불변, 기존 주소 보존, 전파 없음 (안전)
- **유형 2 — capacity 변경 (stride-break)**: stride는 동일하지만 주소 공간 크기 변경, bitmask 재생성 필요
- **유형 3 — shape 재구성 (full stride-break)**: 차원 추가 등으로 stride 완전 변경, 모든 기존 주소 re-encode 필요
- **유형 4 — prefix_ref 대상 변경**: 참조 prefix의 shape 변경 시 상위 계층(DKG)이 감지·처리해야 하는 경계
- **전파 시나리오 — entry 추가**: LabelRegistry에 entry 추가 → shape 불변 확인 → DKG 4단계 cascade → 서비스 마이그레이션 불필요
- **전파 시나리오 — capacity 확장**: max 초과 시 capacity 확장 → 새 prefix version 생성 → bitmask 크기 변경 → 소비자 갱신 필요
- **weighted-index 경계**: prefix 간 참조 전파는 weighted-index가 아닌 호출자(demo-accessors, DKG)의 책임

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
