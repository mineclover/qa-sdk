# weighted-index ↔ RDBMS 등가성

weighted-index가 수행하는 좌표 ↔ 주소 변환은 **관계형 데이터베이스가 복합 PK를 lex-order btree로 저장할 때 수행하는 계산과 동일**하다. 이 디렉토리는 그 등가성과, 등가성 위에서 파생되는 인덱스 전략을 정리한다.

## 문서 구성

- [`concept.md`](concept.md) — 핵심 주장, 개념 매핑, shape 안정성 전제, 증명 요약, 한계
- [`strategy-sparse.md`](strategy-sparse.md) — #1 Sparse materialization (1순위)
- [`strategy-expression.md`](strategy-expression.md) — #2 Expression index (제한적)
- [`strategy-partial.md`](strategy-partial.md) — #3 Partial index (축 순서 불일치 해결)
- [`strategy-brin.md`](strategy-brin.md) — #4 BRIN (PostgreSQL 전용)
- [`strategy-bitmap.md`](strategy-bitmap.md) — #5 Bitmap ↔ buildMask 동형
- [`strategy-covering.md`](strategy-covering.md) — #6 Covering index (denormalized)
- [`strategy-hybrid.md`](strategy-hybrid.md) — #7 Hybrid with VersionedIndex (실전 1순위)
- [`supplementary.md`](supplementary.md) — 보완 전략 4종 (Z-order, Bloom, Aggregates MV, Sharding)

검증 코드: `src/rdbms/*.test.ts`

---

## 우선순위 매트릭스

실전 도입 순서. 성능 병목 전까지 **1순위 전략만** 도입하고, 측정 결과에 따라 확장한다.

### 도입 1순위 (default)

| 전략 | 왜 |
|---|---|
| **[Sparse materialization](strategy-sparse.md)** | 조합 공간이 닫혀 있는 거의 모든 경우에 적용. 축별 marginal density 함께 |
| **[Hybrid with VersionedIndex](strategy-hybrid.md)** | 실전 이벤트 저장의 표준 형태. version 없이 도입하지 말 것 |

### 2순위 (성능 측정 후)

| 상황 | 추가 전략 |
|---|---|
| 복합 PK와 다른 축 순서로 쿼리 잦음 | [Partial index](strategy-partial.md) |
| GB급 append-only + 범위 쿼리 (PG) | [BRIN](strategy-brin.md) |
| 다축 교집합 쿼리가 병목 | [Bitmap](strategy-bitmap.md) |
| 읽기 1000배 이상 vs 쓰기 | [Covering index](strategy-covering.md) |
| 범위 쿼리 SQL 단순화만 필요 | [Expression index](strategy-expression.md) (단 Hybrid로 대체 검토) |

### 특수 상황

| 상황 | 전략 |
|---|---|
| 존재 여부 빈번한 체크 | [Bloom filter](supplementary.md#bloom-filter-on-addresses) |
| 공간 쿼리 (다축 범위) | [Z-order/Hilbert](supplementary.md#z-order--hilbert-curve) |
| 수평 분산 | [Address hash sharding](supplementary.md#sharding-by-address-hash) |
| 실측 집계 필요 | [Materialized view](supplementary.md#aggregates-materialized-view) |

### 도입하지 말 것

- shape이 자주 바뀌는 도메인 (user, order, transaction) — RDBMS row-level mutability 그대로 사용
- 관측이 **거의 전체 공간**을 채움 → materialize와 산술 차이 없음, 더 복잡한 쪽 비추천

---

## 핵심 메시지

> **인덱스는 조합 공간의 보관소가 아니라 관측점의 좌표 카탈로그.**
>
> 공간 크기는 shape이 갖고, 인덱스는 관측된 좌표에만 비용을 지불한다.
> 이론 카디널리티는 산술, 실측 카디널리티는 DB — 두 값의 비율이 공간 활용률이자 샤딩·파티셔닝 판단 지표다.
>
> 그리고 shape version 없이는 address를 저장하지 마라 — 미래의 마이그레이션 지옥을 피하는 유일한 장치다.
