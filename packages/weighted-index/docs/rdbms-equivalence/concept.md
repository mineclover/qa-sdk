# 개념 · 등가성 · 전제

[← 진입점](README.md)

## 1. 핵심 주장

**Materialized composite-PK fact table ≡ weighted-index encoding.**

dim 테이블의 카테시안 곱을 복합 PK fact 테이블로 materialize하면, btree의 lex-order row position이 mixed-radix 주소 계산 결과와 정확히 일치한다. 두 모델은 동일 연산의 두 극단:

- **저장 중심 (RDBMS)** — 모든 좌표를 row로 보관, btree가 좌표↔position 매핑 담당
- **계산 중심 (weighted-index)** — 좌표는 shape 산술로 즉시 주소 생성, 저장 불필요

갈림길은 단 하나: **"빈 좌표를 저장할 것인가 계산할 것인가"**.

---

## 2. 개념 매핑

| E/C/I/S + L/P | weighted-index | RDBMS 대응 |
|---|---|---|
| **Component (C)** — 축 | `LabelRegistry` 한 dim | Dimension table |
| **Entry (E)** — 식별값 | entity ID ↔ 1-based index | Dim table row (PK) |
| **Interface (I)** — 계약 | `PrefixCodec` 직렬화 | Composite PK 튜플 |
| **System (S)** — 행위 | `WeightedIndex.encode/decode` | btree lex-order traversal |
| **Layout (L)** | `shape`, `UUIDLayout` | Schema, partitioning |
| **Policy (P)** | append-only entries, capacity guard | Migration, constraint |

**Event = Entry 조합의 주소 = btree row position.**

---

## 3. 전제: Shape 안정성

**모든 인덱스 전략은 shape의 안정성에 의존한다.**

shape이 바뀌면 (축 추가, 축 capacity 변경, 축 재배열) `encode`의 수식이 달라지고, 기존 저장된 주소의 의미가 재해석된다. 결과:

- 모든 expression index 재생성
- 모든 partial index WHERE 조건 재작성
- 저장된 address 컬럼 전체 마이그레이션
- bitmap/BRIN 인덱스 재구축

이는 weighted-index의 **근본 제약**이다. 실전에서는 다음으로 완화한다:

1. **Capacity headroom** — `nextPowerOf2(entries × 2)` 여유 (CLAUDE.md 좌표 컨벤션)
2. **Append-only entries** — 값 추가는 마이그레이션 불필요
3. **Version으로 shape 스냅샷 고정** — `PrefixCodec` 버전 ([Hybrid 전략](strategy-hybrid.md) 참조)

shape이 자주 바뀌는 영역에는 이 등가성 기반 전략을 **쓰지 않는다** — RDBMS의 row-level mutability를 그대로 사용한다.

---

## 4. 증명 요약

검증 코드: `src/rdbms/core-equivalence.test.ts`

### 4.1 row position === encode

```sql
CREATE TABLE coords (
  role_id INTEGER, action_id INTEGER, resource_id INTEGER,
  PRIMARY KEY (role_id, action_id, resource_id)  -- lex order btree
);
-- 모든 좌표 INSERT 후:
SELECT ROW_NUMBER() OVER (ORDER BY role_id, action_id, resource_id) - 1
  AS address, * FROM coords;
```

`address`는 `WeightedIndex.encode([role_id, action_id, resource_id])`와 모든 좌표에서 일치.

### 4.2 JOIN 복원 === decodeToIds

dim 테이블 JOIN으로 entity ID를 복원하는 것은 `PrefixCodec.decodeToIds`와 동일한 결과.

### 4.3 WHERE 필터 === calcAddressRanges

`WHERE role_id = 2`가 선택하는 row들의 주소 집합은 `calcAddressRanges(shape, ["2", null, null])`가 반환하는 범위와 정확히 일치. shape `[3,3,3]`에서 `[[9, 17]]`.

### 4.4 부수 불변

- `COUNT(*) FROM coords === ∏shape` — 닫힌 공간 크기
- `MAX(address) === size - 1` — 주소 상한

---

## 5. 증명의 한계

현재 테스트는 **correctness만** 증명한다:

- ✅ 수학적 등가성: row position === encode
- ✅ 구조적 등가성: WHERE filter === range
- ❌ **미증명**: performance, 공간 비용, 실측 쿼리 플랜 효과, 쓰기 처리량

"언제 쓰는가"는 워크로드 프로파일 없이는 장식적 가이드다. 실제 채택 전에 **해당 워크로드로 benchmark**하고, 쓰기:읽기 비율과 카디널리티를 측정할 것.
