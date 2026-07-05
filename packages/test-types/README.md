# test-types

`test-types`는 테스트 분류 타입의 SSOT다. 구현보다 계약 문서가 먼저다.

## 먼저 볼 문서

- [test-types.spec.md](../../docs/specs/system/test-types.spec.md) — 공개 계약

## 패키지 역할

- `TestPhase`, `TestKind`, `TestScope`, `TestLifecycle` 타입과 상수 배열을 제공한다.
- `@qa-sdk/core`, `test-scenario-store`, `@qa-sdk/cli`가 공통으로 참조한다.
- zero-dependency 타입 패키지다.

## 코드 진입점

- `src/index.ts` — 단일 export 파일

## 실행

```bash
pnpm --filter test-types build
pnpm --filter test-types typecheck
pnpm --filter test-types test
```

`test`는 build/typecheck 뒤 ESM/CJS 산출물이 동일한 `TEST_*` vocabulary, `GATE_KINDS`, `WORK_DOMAINS`, `getSubDomain()` 계약과 declaration export를 제공하는지 검증한다.
