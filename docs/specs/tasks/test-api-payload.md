# api-payload 테스트 보강

> index-meta의 batch entry 검증/적용 로직이 테스트 미검증.

## 우선순위: 🔴 2순위

## 대상

`packages/index-meta/src/api-payload.ts`

| export | 설명 |
|---|---|
| `validateEntryBatchPayload` | sparse entry batch 검증 |
| `applyEntryBatch` | 검증된 payload를 레지스트리에 적용 |

## 테스트 파일

`packages/index-meta/src/api-payload.test.ts`

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | 유효한 sparse payload | position → entity 매핑 |
| 2 | 예약 토큰 처리 | `_`, `~`, `?`, `NaN` |
| 3 | 잘못된 position (범위 초과) | capacity 초과 position |
| 4 | 빈 entries | 빈 객체 검증 |
| 5 | applyEntryBatch 적용 | 레지스트리에 반영 후 상태 확인 |
