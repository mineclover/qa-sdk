# spec-analyzer

`spec-analyzer`는 문서 선언과 실제 코드 export를 비교하는 정적 분석기다.

## 먼저 볼 문서

- [spec-verification-system.md](../../docs/specs/spec-verification/spec-verification-system.md) — verification 상위 구조
- [spec-analyzer-system.md](../../docs/specs/spec-verification/spec-analyzer-system.md) — analyzer 진입점
- [definition-code-link-coverage.spec.md](../../docs/specs/definition-catalog/definition-code-link-coverage.spec.md) — code↔document coverage 운영 문맥

## 패키지 역할

- markdown 마커에서 선언을 추출한다.
- TS 소스 export를 스캔한다.
- 선언과 구현의 drift를 계산해 정적 gap 리포트를 만든다.

## 코드 진입점

- `src/index.ts` — public export
- `src/extractor.ts` — 선언 추출
- `src/scanner.ts` — 구현 스캔
- `src/drift.ts` — drift 분석
- `src/types.ts` — 타입

## 실행

```bash
pnpm --filter spec-analyzer build
pnpm --filter spec-analyzer test
```
