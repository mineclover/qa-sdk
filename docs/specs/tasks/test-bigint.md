# BigInt 테스트 갭 보강 — ✅ 완료

> 기존 BigInt 구현의 테스트 커버리지 갭을 채운다.

## 흐름 심볼

해당 없음 — 라이브러리 품질 보강.

## 선행 조건

없음.

## spec.todo 매핑

B-1, B-2, B-3

## 작업 항목

| # | 작업 | 파일 | 설명 |
|---|---|---|---|
| 1 | SemanticAddressBig 프로토콜 테스트 | `demo-tests/src/index-meta/bigint-address.test.ts` | `createLayoutProtocolBig`의 serialize/parse 왕복. index > 2^53 hex 직렬화 검증 |
| 2 | INV-9 MetaCodec 동등성 테스트 | `demo-tests/src/index-meta/bigint-codec-equiv.test.ts` | `MetaCodec.encode().value === Number(MetaCodecBig.encode().value)` 소형 shape에서 검증 |
| 3 | MetaCodecBig.matchRanges 대형 shape | `demo-tests/src/index-meta/bigint-ranges.test.ts` | 2^53 초과 shape에서 matchRanges 정확성 |

## 산출물

- 테스트 파일 3건 (demo-tests 패키지)

## 검증

- `pnpm --filter demo-tests test` 전체 통과
