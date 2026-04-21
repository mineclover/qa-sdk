# #1 Sparse materialization

[← 진입점](README.md)

관측된 좌표만 INSERT, 이론 공간은 shape로 산술 계산.

검증 코드: `src/rdbms/strategy-sparse.test.ts`

## 예시

```ts
const theoretical = WI.size;             // ∏shape (계산)
const observed = db.count(events);       // 실제 row (측정)

// 축별 marginal density — 전체 density보다 실무에 유용
const roleActive = db.select(sql`COUNT(DISTINCT role_id)`).from(events);
const roleCoverage = roleActive / shape[0];
```

## 트레이드오프

- ✅ **권장**: 이벤트 prefix, 권한 좌표 등 대부분이 미관측
- ⚠️ **주의**: 전체 density 단일 숫자는 정보 손실 — 축별 marginal density(축 활용률)를 병기해야 샤딩/파티셔닝 판단 가능
- ❌ **부적합**: time 축이 섞여 "관측"의 단위가 modeling-level과 event-level로 혼합될 때 — 정의 분리 필요

## 언제 쓰는가

- 닫힌 조합 공간이 존재하지만 **관측 좌표가 소수**
- 전체 materialization 비용(∏shape rows)이 실질적 부담
- 이론 상한(capacity planning)과 실측 분포(마이그레이션/샤딩 결정) 모두 필요

## 핵심 포인트

- 공간 크기는 **shape 산술**로 계산 (저장 불필요)
- 관측 공간은 **DB row count**로 측정
- 실무 판단은 전체 density가 아닌 **축별 marginal density** 기반
