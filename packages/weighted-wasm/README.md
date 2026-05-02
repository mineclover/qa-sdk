# weighted-wasm

`weighted-wasm`는 `weighted-index`와 bitmask 연산을 Rust + WASM으로 가속하는 패키지다.

## 먼저 볼 문서

- [weighted-wasm.spec.md](../../docs/specs/weighted-index-system/weighted-wasm.spec.md) — 패키지 계약
- [wi-hardware-acceleration.spec.md](../../docs/specs/weighted-index-system/wi-hardware-acceleration.spec.md) — 하드웨어 가속 개요
- [todo-plan.md](../../docs/specs/todo-plan.md) — weighted-wasm 구현 완료 맥락
- [test-wasm-js.md](../../docs/specs/tasks/test-wasm-js.md) — JS wrapper 테스트 태스크
- [indexing/README.md](../../docs/specs/indexing/README.md) — indexing 상위 문맥

## 패키지 역할

- Rust 코어를 `wasm-pack`으로 빌드해 batch encode/decode와 bitmask 연산을 가속한다.
- JS wrapper가 WASM 로딩과 fallback 경로를 담당한다.
- 브라우저/Node 양쪽에서 같은 수학 코어를 재사용할 수 있게 한다.

## 코드 진입점

- `js/index.ts` — JS wrapper / public API
- `js/bench.ts` — benchmark harness
- `js/index.test.ts` — wrapper 테스트
- `src/lib.rs` — Rust/WASM 코어
- `pkg/` — wasm-pack 산출물

## 실행

```bash
pnpm --filter weighted-wasm build
pnpm --filter weighted-wasm test
pnpm --filter weighted-wasm typecheck
```
