# review-ledger

`review-ledger`는 파일 리뷰 상태와 AI feedback request artifact를 함께 관리하는 원장 패키지다.

## 먼저 볼 문서

- [review-ledger.spec.md](../../docs/specs/review-system/review-ledger.spec.md) — 공개 계약
- [definition-management.spec.md](../../docs/specs/definition-catalog/definition-management.spec.md) — definition feedback loop와의 연결

## 패키지 역할

- 파일별 reviewed/stale/unreviewed 상태를 커밋 기준으로 추적한다.
- feedback request와 evidence bundle을 생성한다.
- definition 문서나 DKG observation 루프와 연결되는 리뷰 artifact를 제공한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/ledger.ts` — 리뷰 원장 로직
- `src/feedback-request.ts` — 요청 artifact
- `src/store.ts` — 저장소
- `src/scope-resolver.ts`, `src/staleness.ts` — 보조 계산
- `src/db/schema.ts` — DB 스키마

## 실행

```bash
pnpm --filter review-ledger build
pnpm --filter review-ledger test
```
