# #3 Partial index — 축 순서 불일치 해결

[← 진입점](README.md)

composite PK와 **다른 축 순서로 자주 쿼리**할 때 쓰는 대체 인덱스.

검증 코드: `src/rdbms/strategy-partial.test.ts`

## 재프레이밍

초기에 "calcAddressRanges 영속화"로 설명했으나 부정확. composite PK가 `(role, action, resource)` 순서면 PK 자체가 이미 `WHERE role=X` 커버 — partial이 중복이 된다. **축 순서 불일치 해결**로 이해한다.

## 예시

```sql
-- PK 순서와 다른 쿼리 패턴에 최적화
CREATE INDEX coords_by_resource ON coords (resource_id) WHERE role_id = 2;

-- 쿼리
SELECT * FROM coords WHERE role_id = 2 AND resource_id = 3;
```

## 트레이드오프

- ⚠️ PK가 이미 쿼리 축 순서를 커버하면 partial은 중복 → 삭제
- ⚠️ 인덱스 쓰기 오버헤드 — 축 값 개수만큼 partial이 늘어나면 관리 비용 증가
- ✅ **진짜 적합**: composite PK와 다른 축 순서로 자주 쿼리할 때

## 언제 쓰는가

- PK가 `(role, action, resource)`인데 `WHERE resource=X`가 주 쿼리
- 특정 축 값(예: `role=admin`)에 대한 쿼리가 압도적으로 많을 때 (선택성 ↑)
- 쓰기 비용을 감당할 수 있을 때

## 핵심 포인트

- PK 순서와 쿼리 패턴의 **불일치**를 먼저 확인
- 불일치가 없으면 추가하지 말 것 — 중복 인덱스는 부채
- SQLite planner가 소규모 테이블엔 PK 선호 → `INDEXED BY`로 검증
