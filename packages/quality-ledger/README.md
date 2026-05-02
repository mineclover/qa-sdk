# quality-ledger

`quality-ledger`는 gate 실행 결과를 SQLite에 저장하는 원장 패키지다.

## 먼저 볼 문서

- [quality-gates-system.md](../../docs/specs/quality-gates/quality-gates-system.md) — 품질 게이트 전체 구조
- [quality-ledger.spec.md](../../docs/specs/quality-gates/quality-ledger.spec.md) — 원장 공개 계약

## 패키지 역할

- gate 문서 ID + 문서 버전 기준으로 최신 실행 결과를 저장한다.
- bundle 단위 `verified/failed/stale/unverified` 판정을 계산한다.
- 하네스의 verified 판정을 위한 데이터 소스를 제공한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/ledger.ts` — 원장 로직
- `src/store.ts` — 저장소 계층
- `src/db/schema.ts` — DB 스키마
- `src/types.ts` — 타입

## 실행

```bash
pnpm --filter quality-ledger build
pnpm --filter quality-ledger test
```
