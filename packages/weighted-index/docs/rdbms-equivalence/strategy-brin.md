# #4 BRIN (PostgreSQL 전용)

[← 진입점](README.md)

composite PK가 lex order로 정렬되어 있고 address 공간이 연속·조밀하면, BRIN(Block Range Index)이 GB급 테이블을 수 KB 인덱스로 처리 가능.

검증 코드: `src/rdbms/strategy-brin.test.ts` (skip — PG 통합 환경 필요)

## 예시 (PostgreSQL)

```sql
CREATE INDEX coords_brin ON coords USING BRIN (role_id, action_id, resource_id)
  WITH (pages_per_range = 16);
```

## 원리

weighted-index의 range algebra가 BRIN metadata 구조와 동일:

- **BRIN**: 페이지 범위별 `(min, max)` 저장 → `WHERE` clause로 페이지 프루닝
- **weighted-index**: `calcAddressRanges` → `[lo, hi]` 범위 반환

## 트레이드오프

- ⚠️ **효과 전제**: **물리 저장 순서 = lex order**. UPDATE/DELETE로 correlation이 깨지면 이득 소실
- ⚠️ sparse 공간에서는 BRIN 이득 거의 없음 — row 수 자체가 적음
- ❌ SQLite에는 대응 개념 없음
- ✅ **진짜 적합**: append-only time-series에서 `(address, ts)` 조합. weighted-index address를 timestamp처럼 단조 증가시키는 경우

## 언제 쓰는가

- 억 단위 row + append-only + 범위 쿼리가 잦은 PG 환경
- heap 물리 순서가 lex order와 일치 (INSERT만, UPDATE/DELETE 거의 없음)

## 핵심 포인트

- SQLite에서는 이 전략을 사용할 수 없음 — PG 전용
- correlation 유지가 핵심 — `CLUSTER` 명령으로 주기적 재정렬 필요할 수 있음
- 본 저장소에서는 검증 환경 부재로 스킵
