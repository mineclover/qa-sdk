# schema-sync 테스트 보강

> 스키마 동기화 로직이 테스트 미검증.

## 우선순위: 🔴 3순위

## 대상

`packages/index-meta/src/schema-sync.ts`

| export | 설명 |
|---|---|
| `syncSchemaToRegistry` | 스키마 정의 → 레지스트리 동기화 |
| `applySchemaDiff` | 스키마 diff → 레지스트리 적용 |

## 테스트 파일

`packages/index-meta/src/schema-sync.test.ts`

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | 초기 동기화 | 빈 레지스트리에 스키마 적용 |
| 2 | dim 추가 | 기존 스키마에 새 dim 추가 |
| 3 | entry 추가 (append-only) | 기존 dim에 entry 추가 |
| 4 | version 추가 | 새 index version 생성 |
| 5 | diff 적용 | 두 스키마 간 차이 계산 + 적용 |
| 6 | 충돌 감지 | 동기화 불가 상황 에러 |
