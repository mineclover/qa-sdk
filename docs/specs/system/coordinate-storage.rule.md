---
def:
  id: coordinate-storage
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, convention, storage, weighted-index]
  links:
    - target: system-specs-rules-index
      type: traces_to
    - target: drizzle-orm-convention
      type: refines
---

# Coordinate Storage — VersionedIndex 패턴 규칙

## 목적 ^purpose

qa-sdk에서 **weighted-index로 인코딩된 좌표를 저장하는 모든 지점**은 shape 버전을 함께 저장해야 한다. address만 저장하면 shape 변경 시 기존 데이터의 의미가 재해석되지 않아 비가역 부채가 된다. 본 규칙은 좌표 저장의 최소 스키마와 예외 조건을 고정한다.

근거: weighted-index ↔ RDBMS 등가성 문서 §7 Hybrid 전략. `packages/weighted-index/docs/rdbms-equivalence/strategy-hybrid.md`.

---

## 1. 규칙 — 좌표 저장 최소 스키마

### 1.1 정수 address로 저장하는 경우

다음 세 컬럼을 **반드시 함께** 보관한다:

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `prefix_id` | TEXT | 좌표 네임스페이스 (`PrefixCodec.prefix`) |
| `version` | TEXT | shape 스냅샷 식별자 (`PrefixCodec.version`) |
| `address` | INTEGER | `WeightedIndex.encode([...coords])` 결과 |

쿼리는 **반드시** `prefix_id` + `version`을 WHERE 조건에 포함한다. 이것이 version 격리(§2.2)의 유일한 보증 장치다.

### 1.2 좌표를 JSON/문자열로 저장하는 경우

예: `event_records.address_context`처럼 JSON blob으로 저장.

- version 동봉은 동일하게 필수 (`address_context` 내부에 `version` 필드 포함, 또는 별도 컬럼)
- 이는 Covering 전략(`strategy-covering.md`)과 호환되지만, address 기반 범위 쿼리는 불가

### 1.3 좌표를 저장하지 않는 경우

프로세스 내에서만 encode/decode하고 저장하지 않는 코드는 본 규칙 적용 대상이 아니다.

---

## 2. 규칙 — version 격리

### 2.1 동일 prefix의 다른 version이 공존할 수 있어야 한다

저장소에 `(perm, pv1, 42)`와 `(perm, pv2, 42)`가 동시 존재 가능해야 한다. 같은 address 정수가 서로 다른 shape 스냅샷에서 다른 의미를 가질 수 있기 때문이다.

PK 또는 UNIQUE 제약은 반드시 `(prefix_id, version, address, ...)` 조합으로 구성한다.

### 2.2 다른 version의 address를 같은 쿼리에서 섞지 않는다

범위 쿼리·집계 등 모든 읽기 경로에서 단일 `(prefix_id, version)` 쌍으로 격리한다. 다중 version 통합이 필요하면 version별 쿼리를 합성하고, 그 전에 마이그레이션 계획을 수립한다.

---

## 3. 규칙 — 마이그레이션

### 3.1 shape 변경 시 새 version 발급

기존 address를 재해석하지 않는다. 새 version을 발급하고, 이행 기간 동안 두 version을 병행한다. 이행 완료 후 구 version 데이터를 아카이브·삭제한다.

### 3.2 이행 기간 동안 read 경로 우선순위

새 쓰기는 새 version에, 새 읽기는 새 version 우선. 미이행 데이터는 구 version 조회로 fallback. 데이터 일관성 책임은 마이그레이션 도구에 있다.

---

## 4. 예외

### 4.1 in-memory only

테스트·요청 단위 계산처럼 저장이 없는 코드는 예외.

### 4.2 denormalized snapshot

Covering 전략(`strategy-covering.md`)을 따라 entity 이름·값을 함께 저장하는 경우, address 정수는 선택적. 단 `(prefix_id, version)`은 여전히 필수.

### 4.3 legacy 저장소

본 규칙 이전에 생성된 저장소는 `coordinate-storage.rule`와의 gap을 `docs/proposals/`에 감사 문서로 남기고, 이행 계획과 함께 예외로 둔다.

---

## 5. 검증

- 새 좌표 저장 스키마 PR은 본 규칙 참조 필수
- `def validate`에서 본 rule을 참조하는 스펙 문서가 존재하는지 확인
- 저장 스키마 변경 시 관련 ADR 또는 plan 문서 갱신

---

## 6. 안티패턴

### 6.1 address만 단독 저장

```ts
// ❌ 금지 — shape 변경 시 의미 재해석 불가
await db.insert(events).values({
  address: WI.encode(coord),
  observedAt,
});
```

### 6.2 version을 전역 상수로 하드코딩

```ts
// ❌ 금지 — PrefixCodec의 version 선언과 분리되어 drift
const DEFAULT_VERSION = "v1";
```

`PrefixCodec.version`을 단일 원본으로 삼는다.

### 6.3 JSON blob에 version 생략

```ts
// ❌ 금지 — address_context: {"role": 1, "action": 2}
// ✅ 권장 — address_context: {"version": "pv1", "coords": {...}}
```
