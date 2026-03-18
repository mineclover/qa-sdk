# weighted-wasm JS 래퍼 테스트

> Rust→WASM 바인딩의 JS 쪽 래퍼가 테스트 미검증.

## 우선순위: 🟡 5순위

## 대상

`packages/weighted-wasm/js/index.ts`

| export | 설명 |
|---|---|
| `initWasm()` | WASM 모듈 로드 (실패 시 JS fallback) |
| `encodeBatch()` | 배치 인코딩 |
| `decodeBatch()` | 배치 디코딩 |
| `popcountWasm()` | 비트 카운트 |
| `maskAndWasm()` | 비트 AND |
| `maskOrWasm()` | 비트 OR |
| `masksOverlapWasm()` | 겹침 확인 |

## 테스트 파일

`packages/weighted-wasm/js/index.test.ts`

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | initWasm 성공 | WASM 로드 + 함수 바인딩 |
| 2 | initWasm 실패 → fallback | WASM 없을 때 JS fallback |
| 3 | encodeBatch 정확성 | JS WeightedIndex.encode()와 결과 동등 |
| 4 | decodeBatch 정확성 | JS WeightedIndex.decode()와 결과 동등 |
| 5 | popcount 정확성 | 알려진 비트 패턴 검증 |
| 6 | mask AND/OR 정확성 | 비트 연산 결과 검증 |
