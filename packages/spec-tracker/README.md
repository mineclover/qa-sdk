# spec-tracker

`spec-tracker`는 테스트/런타임 증거를 spec 문서에 연결하는 수집기다.

## 먼저 볼 문서

- [spec-verification-system.md](../../docs/specs/spec-verification/spec-verification-system.md) — verification 상위 구조
- [spec-tracker-system.md](../../docs/specs/spec-verification/spec-tracker-system.md) — tracker 진입점
- [definition-harness-derive.spec.md](../../docs/specs/definition-catalog/definition-harness/definition-harness-derive.spec.md) — spec-tracker 증거가 하네스 상태에 주는 영향

## 패키지 역할

- 테스트와 런타임에서 ContractEvidence를 수집한다.
- specId별 ContractReport와 VerificationSummary를 생성한다.
- vitest adapter를 통해 테스트와 문서를 연결한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/collector.ts` — evidence 수집기
- `src/reporter.ts`, `src/claim-report.ts`, `src/claim-audit.ts` — 집계/리포트
- `src/claim-extractor.ts`, `src/verification-claim.ts` — claim 처리
- `src/vitest-adapter.ts` — vitest 연결

## 실행

```bash
pnpm --filter spec-tracker build
pnpm --filter spec-tracker test
```
