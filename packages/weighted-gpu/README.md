# weighted-gpu

`weighted-gpu`는 `weighted-index` 연산을 WebGPU로 가속하는 실험 패키지다.

## 먼저 볼 문서

- [weighted-gpu.spec.md](../../docs/specs/weighted-index-system/weighted-gpu.spec.md) — 패키지 계약
- [wi-hardware-acceleration.spec.md](../../docs/specs/weighted-index-system/wi-hardware-acceleration.spec.md) — 하드웨어 가속 개요
- [todo-plan.md](../../docs/specs/todo-plan.md) — weighted-gpu 구현 완료 맥락
- [test-gpu-fallback.md](../../docs/specs/tasks/test-gpu-fallback.md) — 테스트 태스크
- [indexing/README.md](../../docs/specs/indexing/README.md) — indexing 상위 문맥

## 패키지 역할

- batch encode/decode/reduce 계열을 GPU로 오프로드하는 실험적 엔진이다.
- GPU 미지원 환경에서는 fallback 경로를 제공한다.
- `weighted-index` 수학을 배치 가속 관점에서 검증한다.

## 코드 진입점

- `src/index.ts` — public API
- `src/bench.ts` — benchmark harness
- `src/index.test.ts` — fallback/기본 테스트

## 실행

```bash
pnpm --filter weighted-gpu test
pnpm --filter weighted-gpu typecheck
```
