# #6 Covering index (denormalized)

[← 진입점](README.md)

복합 PK가 entity 이름까지 cover → index-only scan으로 `decodeToIds` 결과 반환. 쓰기 ↑ vs 읽기 JOIN 제거 트레이드오프.

검증 코드: `src/rdbms/strategy-covering.test.ts`

## 예시

```sql
CREATE TABLE fact_denorm (
  role_id INTEGER, action_id INTEGER, resource_id INTEGER,
  role_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  PRIMARY KEY (role_id, action_id, resource_id)
);

-- JOIN 없이 entity 이름까지 반환
SELECT role_name, action_name, resource_name
FROM fact_denorm
WHERE role_id=? AND action_id=? AND resource_id=?;
```

## 트레이드오프

- ⚠️ **최대 함정**: entity rename 시 fact 테이블 전체 UPDATE 필요 — SSOT 위반
- ⚠️ SQLite INTEGER PK는 이미 covering — 별도 인덱스 불필요
- ⚠️ dim 테이블이 작으면 JOIN 비용 무시 가능 — "JOIN 제거"가 진짜 병목이 아닌 경우 많음
- ✅ **진짜 적합**: 쓰기 1회 / 읽기 1000회+ read-heavy analytics

## 언제 쓰는가

- entity ID가 append-only이고 rename이 없는 운영 규율
- 읽기 경로가 latency-sensitive (대시보드, API 응답)
- JOIN 비용이 실측으로 병목 확인

## 핵심 포인트

- denormalization = **쓰기 비용과 SSOT 위험**으로 읽기 속도 매입
- 실전에서는 dim rename 금지 정책과 함께 도입
- 단순 "JOIN 없음"이 목적이면 MV로도 가능 (읽기 일관성 요구에 따라 선택)
