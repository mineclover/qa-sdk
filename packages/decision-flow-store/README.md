# decision-flow-store

`decision-flow-store`는 `decision-flow` 인스턴스 영속을 위한 SQLite 어댑터다. 전용 package spec은 약하고, decision-flow 인터페이스 문서에서 역할을 읽는 편이 맞다.

## 먼저 볼 문서

- [df-system.md](../../docs/specs/decision-flow/df-system.md) — decision-flow 전체 구조
- [df-cli-persistence.spec.md](../../docs/specs/decision-flow/df-interface-group/df-cli-persistence.spec.md) — CLI/SQLite 영속 계약
- [definition-harness-derive.spec.md](../../docs/specs/definition-catalog/definition-harness/definition-harness-derive.spec.md) — FlowInstance를 외부에서 어떻게 읽는지
- [drizzle-orm-convention.spec.md](../../docs/specs/system/drizzle-orm-convention.spec.md) — SQLite/Drizzle 제약

## 패키지 역할

- `decision-flow`의 `InstanceStore`를 SQLite로 구현한다.
- CLI나 하네스가 FlowInstance 상태를 로컬 저장소에서 재구성할 수 있게 한다.
- `index-meta`와 `@qa-sdk/core` 타입을 같이 사용하지만 역할은 영속 어댑터에 한정된다.

## 코드 진입점

- `src/index.ts` — public export
- `src/store.ts` — SQLite store 구현
- `src/db/schema.ts` — Drizzle 스키마

## 실행

```bash
pnpm --filter decision-flow-store build
pnpm --filter decision-flow-store typecheck
```
