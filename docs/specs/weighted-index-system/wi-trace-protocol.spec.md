---
def:
  id: wi-trace-protocol
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-trace-axes
      type: depends_on
    - target: wi-codec
      type: constrains
    - target: partial-binder-spec
      type: constrains
    - target: range-query-spec
      type: constrains
---
# weighted-index 수정 프로토콜

## 목적 ^purpose

수정의 프로토콜. 변경 시 반드시 따라야 하는 절차 — 영향 분석 → 호환성 확인 → 마이그레이션 → 검증.

## 구성 ^overview

- **entry 추가 (headroom 내)**: shape 불변 확인 후 LabelRegistry에 새 version append, 기존 prefix version 유지
- **entry 추가 (headroom 초과)**: 새 capacity 설정 + 새 prefix version 생성 + migrate()로 기존 주소 마이그레이션
- **차원 추가/제거**: 차원 추가는 full stride-break + 전체 re-encode, 차원 제거는 금지하고 비활성화만 허용 (position 항등성 보존)
- **상위 계층 계약**: DKG에 변경 감지(diff), 영향 판정, 마이그레이션 경로, 범위 산출 제공; qa-sdk에 인코딩/디코딩/직렬화/부분 바인딩 제공
- **7대 불변식**: calcWeights 유일성, ids append-only, v 필드 필수, labelVersions 스냅샷 불변, diff/migrate 순수성, prefix_ref 전파 비책임

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

## 불변식

1. **calcWeights는 유일한 stride 계산원이다.** WeightedIndex 생성자가 이를 호출한다. 다른 경로로 stride를 계산하지 않는다.
2. **ids 배열은 append-only.** 기존 entry의 position(index)은 어떤 version에서도 변하지 않는다.
3. **VersionedIndex의 v 필드는 decode의 필수 조건이다.** v 없이 id만으로는 좌표를 복원할 수 없다.
4. **prefix version의 labelVersions 스냅샷은 생성 후 불변이다.** 수정이 필요하면 새 version을 만든다.
5. **diff()는 순수 함수다.** 상태를 변경하지 않는다. 두 버전 사이의 차이를 읽기만 한다.
6. **migrate()는 새 VersionedIndex를 반환한다.** 기존 VersionedIndex를 수정하지 않는다.
7. **prefix_ref 전파는 weighted-index의 책임이 아니다.** 호출자(demo-accessors, DKG)가 참조 체인을 추적해야 한다.
