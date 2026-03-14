# 인덱싱 시스템 관례

> `weighted-index`와 `index-meta`를 사용하는 프로젝트에서 따라야 하는 규칙.
> 기반 원리는 [`foundation.md`](foundation.md), 사용 패턴은 [`patterns.md`](patterns.md)를 참조한다.

---

## 1. ID 네이밍 제약

`VersionedValue`의 직렬화 형식이 `"{indexId}:{versionId}:{value}"`이므로, `:` 문자는 구분자로 예약되어 있다.

**규칙**: `dimId`, `snapshotId`, `indexId`, `versionId` 모두 `:` 문자를 포함할 수 없다.

```ts
// ✅ 유효
"perm", "iv1", "role", "v2"

// ❌ ValidationError
"ro:le", "v:1", "pe:rm", "iv:1"
```

MetaRegistry 생성자에서 강제한다. `:` 가 포함되면 `ValidationError`.

> **이유**: 직렬화 형식 `"{indexId}:{versionId}:{value}"`의 파싱은 마지막 두 콜론을 구분자로 사용한다. `indexId`는 콜론을 포함할 수 있지만, `versionId`에 콜론이 있으면 `parse()` 시 잘못된 분리가 발생한다. 생성자에서 모든 ID의 콜론을 금지해 이 문제를 원천 차단한다.

---

## 2. 예약 항목(Reserved Entry)

### 문제

`encode()`는 모든 차원에 반드시 값이 있어야 한다. 값이 없으면 에러다. 그러나 실제 도메인에서는 정규 분류 밖의 상태가 존재한다:

| 상태 | 예시 |
|---|---|
| **미지정 (null)** | 우선순위 미배정, 마이그레이션 시 새 차원에 값 없음 |
| **기타 (other)** | 정의된 카테고리에 해당하지 않는 이벤트 |
| **알 수 없음 (unknown)** | 값이 존재하지만 식별 불가, 파싱 실패 |

이런 상태가 encode에서 에러가 되면 안 되므로, entries에 해당 상태를 나타내는 **예약 항목**을 포함해야 한다.

### 원칙

1. **dim이 허용하는 예약 항목을 명시적으로 선언한다.** 선언하지 않으면 모든 entry가 정규 도메인 값이며, 값 없이 encode하면 에러다.
2. **허용한다면 프로젝트 전체에서 동일한 토큰을 사용한다.** 각 dim이 `"unassigned"`, `"none"`, `"N/A"` 등 제각기 다른 표기를 쓰면 소비자가 일관되게 판단할 수 없다.
3. **시스템은 예약 항목을 특별 취급하지 않는다.** 좌표가 부여되고, encode/decode되고, bijection이 유지된다. "이 값이 예약 항목이다"라는 해석은 도메인 레이어의 책임이다.

### 표준 토큰

**`string_enum` 표준 예약 토큰** — 예약어이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 의미 | 제약 |
|---|---|---|
| `"_"` | **null** — 값이 없거나 아직 결정되지 않음 | entries에 있으면 반드시 null 의미 |
| `"~"` | **other** — 정의된 카테고리에 해당하지 않음 | entries에 있으면 반드시 other 의미 |
| `"?"` | **unknown** — 값이 존재하지만 식별 불가 | entries에 있으면 반드시 unknown 의미 |

**`number_enum` / `index_ref`**: 숫자 도메인은 유효 범위가 dim마다 다르므로 고정 토큰을 정의하지 않는다.
- null 용도로는 `0`을 기본 사용. `0`이 정규 값이면 `description`에 대체 토큰을 명시.
- other/unknown이 필요한 경우에도 `description`에 토큰과 의미를 명시.

### 배치 규칙

1. **예약 항목은 entries 배열의 앞쪽에 배치.** 정규 항목보다 앞에 위치시켜 경계를 명확히 한다.
2. 여러 예약 항목이 있으면 순서: `"_"` (null) → `"~"` (other) → `"?"` (unknown).
3. dim 정의의 `description`에 `reserved:` 접두어로 선언.

### 선언 형식

`description` 필드에 다음 형식으로 기술:

```
reserved: [position]=token (설명), [position]=token (설명)
```

선언이 없으면 예약 항목이 없는 것이다.

### 예시

```ts
// ── null만 허용 ───────────────────────────────────────────────────
priority: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미지정)',
  snapshots: {
    v1: { entries: ["_", "low", "medium", "high"] },
  },
}

// ── null + other 허용 ─────────────────────────────────────────────
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// ── 예약 항목 없음 — 값은 반드시 정규 도메인 값 ───────────────────
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### 소비자 판단 절차

1. `description`에 `reserved:` 선언이 있는지 확인.
2. **있으면**: 선언된 position과 토큰으로 예약 항목 식별. `string_enum` 표준 토큰은 토큰 자체로 의미 확정.
3. **없으면**: 모든 entry가 정규 도메인 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

---

## 3. EntityId 정규화

- `-0`은 `0`으로 정규화된다. `entries` 배열에 저장될 때와 `idToIndex` Map에 등록될 때 모두 `0`으로 변환된다. `getDimSnapshot().entries`에서 `-0`이 반환되는 일은 없다.
- `-0`과 `0`은 같은 EntityId로 취급되므로 동일 snapshot에 함께 존재하면 `ValidationError`.
- 동일 snapshot 내 중복 EntityId는 `ValidationError`.
