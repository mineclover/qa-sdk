# #5 Bitmap ↔ buildMask 동형

[← 진입점](README.md)

RDBMS가 축별 bitmap을 유지하고 교집합으로 row를 찾는 연산은 weighted-index의 `buildMask` + `maskAnd` + `popcount`와 **수학적으로 동일**.

검증 코드: `src/rdbms/strategy-bitmap.test.ts`

## 대응 관계

| weighted-index | RDBMS bitmap index |
|---|---|
| `buildMask(size, positions)` | 축 값별 bitmap |
| `maskAnd(roleMask, actionMask)` | Bitmap AND (PG bitmap heap scan) |
| `popcount(mask)` | 교집합 카디널리티 |

## 예시

```ts
const roleMask = buildMask(WI.size, role2Positions);
const actionMask = buildMask(WI.size, action2Positions);
const intersect = maskAnd(roleMask, actionMask);
popcount(intersect); // 교집합 주소 개수
```

## 트레이드오프

- ✅ **수학적 동형** 정확 — 쿼리 플랜을 클라이언트에서 시뮬레이션 가능
- ⚠️ **저장 모델 주의**: RDBMS bitmap은 row 단위, library bitmask는 **주소 공간 전체 비트맵**
  - 2^30 주소 공간이면 128MB — materialize와 비용 유사
- 💡 실전에선 bitmap보다 **sorted int array + binary search** (`calcAddressRanges` 결과)가 간결한 경우가 많음

## 언제 쓰는가

- PG에서 다축 교집합 쿼리가 병목 (PG bitmap heap scan 활용)
- 클라이언트 측에서 DB 쿼리 플랜을 시뮬레이션하고 싶을 때
- 주소 공간이 작아 전체 비트맵이 부담되지 않을 때 (< 10^6)

## 핵심 포인트

- 동형은 연산 수준 — 저장 비용은 모델에 따라 완전히 다름
- 대형 공간에서는 bitmap보다 range/interval 표현이 효율적
- library bitmask는 쿼리 플랜 설계 도구로도 유용
