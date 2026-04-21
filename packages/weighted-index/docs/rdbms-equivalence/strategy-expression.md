# #2 Expression index

[← 진입점](README.md)

DB가 `encode` 수식을 자동 인덱싱. address 정수로 O(log N) 조회.

검증 코드: `src/rdbms/strategy-expression.test.ts`

## 예시

```sql
CREATE INDEX coords_addr ON coords (
  (role_id - 1) * 9 + (action_id - 1) * 3 + (resource_id - 1)
);

-- 쿼리
SELECT * FROM coords
WHERE (role_id - 1) * 9 + (action_id - 1) * 3 + (resource_id - 1) = 13;
```

## 트레이드오프

- ⚠️ **근본 함정**: 클라이언트가 이미 `encode` 결과를 갖고 있으면 composite PK로 직접 조회하면 됨 — expression index 없어도 됨
- ⚠️ 쓰기마다 수식 재계산 → 쓰기 비용
- ⚠️ shape 변경 시 인덱스 재생성 필수
- ✅ **유일한 실용**: `address BETWEEN lo AND hi` 범위 쿼리가 복합 PK 범위보다 간결할 때

## 언제 쓰는가

- 복합 PK 여러 축 범위 조건을 **하나의 정수 범위**로 쓰고 싶을 때
- 사실상 [Hybrid 전략](strategy-hybrid.md)의 열화판 — **Hybrid를 먼저 고려**할 것

## 핵심 포인트

- 수식이 shape에 결합되므로 shape 안정성 필수
- SQLite에서 planner가 소규모 테이블엔 PK 선호 → `INDEXED BY`로 강제 또는 `ANALYZE` 필요
- 범위 쿼리 SQL 간결화 외의 실익 불분명 → 대안(Hybrid) 우선
