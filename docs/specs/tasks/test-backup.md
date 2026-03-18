# backup 테스트 보강

> 버전 export/import 로직이 테스트 미검증.

## 우선순위: 🔴 4순위

## 대상

`packages/index-meta/src/backup.ts`

| export | 설명 |
|---|---|
| `exportVersion` | 특정 index version의 전체 데이터 추출 |
| `importVersion` | 추출된 데이터를 다른 레지스트리에 복원 |

## 테스트 파일

`packages/index-meta/src/backup.test.ts`

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | export → import 왕복 | 원본과 복원 데이터 동등성 |
| 2 | 다중 dim export | 여러 dim/snapshot 포함 |
| 3 | cross-index ref 보존 | index_ref dim 참조 무결성 |
| 4 | 빈 version export | entries 없는 version |
| 5 | import 충돌 | 이미 존재하는 ID에 import 시 동작 |
