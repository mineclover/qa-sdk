---
def:
  id: slot-marker-concept
  address: def_document:v2:342197
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, structural, runtime]
  links:
    - target: wi-pack-format-def
      type: depends_on
---
# 슬롯 마커의 개념

## 목적 ^purpose

슬롯 마커의 개념. 닫힌 축에서 '기타(other)' 항목을 명시적으로 표현하는 설계 패턴.

## 구성 ^overview

- **문제**: WeightedIndex는 닫힌 패턴이라 좌표를 비울 수 없지만, 현실에서는 미결정/해당없음/분류불가 등 빈 좌표가 필요한 상황이 반복 발생
- **해법**: "비어있음"이라는 의미를 가진 좌표를 주소 공간에 미리 예약하는 슬롯 마커 패턴
- **표준 토큰 3종**: `"_"`(null/값 없음), `"~"`(other/분류 불가), `"?"`(unknown/식별 불가) + number_enum용 `"NaN"`
- **의도적 비선택**: `"_"`는 값이 없는 것이 아니라 "비어있다는 의미의 좌표"가 채워진 것 — 비선택도 하나의 선택
- **원칙 1 — 투명성**: 코덱은 마커를 특별 취급하지 않으며, 의미 해석은 서비스 레이어가 담당
- **원칙 2 — 선두 배치**: entries 배열 앞쪽에 `"_"` → `"~"` → `"?"` 순서로 배치하여 인덱스 안정성 확보
- **원칙 3 — 명시적 선언**: dim의 description 필드에 `reserved:` 접두어로 마커 사용을 선언
- **안티패턴**: 코덱에 마커 특별 처리 로직 삽입 금지, dim마다 다른 마커 토큰 사용 금지

---

## 1. 문제: 닫힌 패턴에서 열린 상황

`WeightedIndex`는 닫힌 패턴이다. 모든 차원의 좌표는 `[1, shape[i]]` 범위 안에 있어야 하며, 좌표를 비울 수 없다.

하지만 현실 도메인에서는 좌표를 비워야 하는 상황이 반복적으로 발생한다:

| 상황 | 예시 | encode 시 문제 |
|------|------|---------------|
| **값 미결정** | 이벤트 발생 시 role이 아직 할당되지 않음 | 넣을 좌표가 없음 |
| **해당 없음** | 시스템 cron job에 "role" 개념 자체가 없음 | 차원이 적용되지 않음 |
| **분류 불가** | 신규 API가 기존 action 분류에 맞지 않음 | 일치하는 엔티티 없음 |
| **선택하지 않음** | 모든 role에 적용되는 정책을 등록 | 특정 값을 지정하고 싶지 않음 |
| **식별 불가** | 외부 시스템 응답 파싱 실패 | 값은 존재하지만 어떤 엔티티인지 모름 |
| **삭제된 엔티티** | 폐지된 role이지만 기존 주소는 유효해야 함 | append-only라 entries에서 제거 불가 |

이 모든 상황에서 `encode()`는 에러를 내뱉는다. 좌표가 비어있기 때문이다.

---

## 2. 해법: 슬롯 마커

좌표를 비울 수 없다면, **"비어있음"이라는 의미를 가진 좌표를 주소 공간에 미리 예약**한다. 이것이 슬롯 마커다.

마커도 entries 배열의 entry이므로 shape에 포함되고, encode/decode되고, bijection이 유지된다. 시스템 입장에서 마커는 그냥 좌표다. **"이 좌표가 마커다"라는 해석은 전적으로 도메인 레이어의 책임이다.**

### 표준 토큰

`string_enum` 차원에서 프로젝트 전체에 걸쳐 동일한 의미로 사용해야 하는 예약 토큰:

| 토큰 | 역할 | 커버하는 상황 |
|------|------|-------------|
| `"_"` | **null** — 값 없음 | 미결정, 해당 없음, 선택하지 않음 |
| `"~"` | **other** — 분류 불가 | 기존 분류 체계에 맞지 않는 새 값, 마이그레이션 과도기 |
| `"?"` | **unknown** — 식별 불가 | 값이 존재하지만 파싱 실패, 외부 시스템 응답 불명 |

`number_enum` 차원:

| 토큰 | 역할 |
|------|------|
| `"NaN"` | **not a number** — 숫자가 아닌 값 유입 |

### "선택하지 않음"이 공식 패턴인 이유

`"_"` 마커의 역할 중 가장 중요한 것은 **의도적 비선택(intentional non-selection)**이다. 이것은 "값이 없어서 넣을 수 없는" 상황과 다르다.

```
"이 정책은 모든 role에 적용된다" → role 차원에 특정 값을 지정하고 싶지 않다
"이 이벤트에 role 개념은 존재하지 않는다" → role 차원이 적용되지 않는다
```

두 경우 모두 `"_"`로 인코딩한다. 좌표가 비어있는 것이 아니라, **"비어있다는 의미의 좌표"가 채워진 것이다.** 비선택도 하나의 선택이며, 주소 공간에서 자기 자리를 차지한다.

이 패턴 덕분에:
- 닫힌 패턴의 bijection이 유지됨
- 범위 쿼리로 "미결정 레코드"를 정확히 선택 가능
- bitmask로 "선택하지 않음" 조합에 대한 권한을 명시적으로 부여/거부 가능
- 새 차원 추가 시 기존 데이터의 기본값으로 활용 가능

---

## 3. 설계 원칙

### 원칙 1: 시스템은 마커를 특별 취급하지 않는다

코덱(WeightedIndex, MetaCodec) 입장에서 `"_"`는 그냥 position 1의 entry다. 마커 관련 분기가 코덱에 존재하지 않는다.

```ts
// MetaCodec 내부 — 마커 판별 로직 없음
encode(entityIds: Record<string, EntityId>): VersionedValue {
  // "_"든 "admin"이든 동일한 경로로 encode
  const vi = this._prefix.encodeFromIds(this._map.indexId, entityIds, this._map.versionId);
  return { indexId: vi.prefix, versionId: vi.v, value: vi.id };
}
```

의미 해석은 서비스 레이어가 담당한다:

```ts
// 서비스 레이어 — 마커 판별은 여기서
const RESERVED_TOKENS = new Set(["_", "~", "?", "NaN"]);

function classifyEntry(value: string): "normal" | "reserved" {
  return RESERVED_TOKENS.has(value) ? "reserved" : "normal";
}
```

### 원칙 2: 선두 배치

마커는 entries 배열의 **앞쪽**에 배치한다. 순서: `"_"` → `"~"` → `"?"` → 커스텀 마커 → 정규 엔티티.

```ts
// 선두 배치 — 정규 엔티티가 끝에 추가되어도 마커 인덱스 안정
entries: ["_", "~", "admin", "editor"]
// "viewer" 추가 → ["_", "~", "admin", "editor", "viewer"]
// _ = position 1, ~ = position 2 고정
```

선두 배치의 실익:
- 범위 쿼리에서 마커 이후 position으로 정규 엔티티만 깔끔하게 선택 가능
- 모든 차원에서 `"_"`이 항상 position 1이라는 예측 가능성

### 원칙 3: 명시적 선언

마커 사용 여부는 dim의 `description` 필드에 `reserved:` 접두어로 선언한다. 선언이 없으면 모든 entry가 정규 도메인 값이다.

```
reserved: [1]="_" (미분류), [2]="~" (기타)
```

---

## 4. 안티패턴

**AP-1: 코덱에 마커 특별 처리 로직 삽입**

```ts
// 코덱이 마커를 특별 처리 → 범용성 훼손
encode(coords) {
  if (coords.includes("_")) return SPECIAL_NULL_ADDRESS;
}

// 코덱은 마커를 일반 entry와 동일하게 처리
// 의미 해석은 서비스 레이어가 담당
```

**AP-2: dim마다 다른 마커 토큰 사용**

```ts
// 불일치 — "이 dim에서 null은 뭘로 표현하지?" 매번 확인 필요
role:     description: 'reserved: [1]="unassigned"'
action:   description: 'reserved: [1]="none"'

// 표준 토큰 사용
role:     description: 'reserved: [1]="_"'
action:   description: 'reserved: [1]="_"'
```

## 참조

- [slot-marker-patterns](slot-marker-patterns.spec.md) — 실제 사용 패턴과 테스트
- [slot-marker-capacity](slot-marker-capacity.spec.md) — 용량 영향
- [`conventions-system.md`](conventions-system.md) — 규범적 요약
