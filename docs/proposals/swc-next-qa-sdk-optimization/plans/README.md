---
lifecycle: draft
status: draft
sources:
  - docs/proposals/swc-next-qa-sdk-optimization/README.md
  - docs/proposals/swc-next-qa-sdk-optimization/01-tracks.md
---

# SWC Next 최적화·호환성 — 트랙별 구현 계획

[상위 README](../README.md)의 트랙을 실행 단위로 분해한 계획이다. 트랙 경계·파일 소유권·머지 규칙은 [01-tracks.md](../01-tracks.md)가 정본이다.

## 계획 목록

| Wave | 트랙 | 계획 | 착수 조건 | Task 수 |
|---|---|---|---|---|
| 0 | T0 계약 기반 | [T0-contract-foundation.md](./T0-contract-foundation.md) | 즉시 | 7 (0~6) |
| 1 | A Codec 호환성 | [A-codec-compatibility.md](./A-codec-compatibility.md) | T0 ✅ + D-1·D-8 확정 | 7 (0~6) |
| 1 | B Envelope binding | [B-envelope-snapshot-binding.md](./B-envelope-snapshot-binding.md) | T0 + D-2 | 8 (0~7) |
| 1 | C Baseline benchmark | [C-baseline-benchmark.md](./C-baseline-benchmark.md) | 즉시 | 5 (0~4) |
| 1 | D Codegen 결정론 | [D-codegen-determinism.md](./D-codegen-determinism.md) | Task 1 즉시, Task 2~ T0 | 6 (0~5) |
| 1 | E Ingest 정리 | [E-ingest-pipeline-hygiene.md](./E-ingest-pipeline-hygiene.md) | 즉시 + D-3·D-4·D-5 | 7 (0~6) |
| 1 | F 분석 결정론 | [F-analysis-determinism.md](./F-analysis-determinism.md) | 즉시 | 5 (0~4) |
| 2 | G2·G3·G5·G6 | [gated-phases.md](./gated-phases.md) | 측정 게이트 | — |

## 즉시 병렬로 시작할 수 있는 조합

결정 게이트 없이 바로 시작할 수 있는 작업은 서로 파일이 겹치지 않는다.

- **T0** (core `catalog/snapshot/**`)
- **C** (`packages/bench/**`, `benchmarks/**`, `bench.yml`)
- **D Task 1** (`packages/codegen-core/**`, `demo-types` 생성물)
- **F** (`packages/convergence/**`, `packages/dkg/**`, `packages/dkg-enrichment/**`)
- **E Task 0~1** (metrics collector) — Task 2~4는 D-3·D-4·D-5 확정 후

T0 머지 후 A·B·D(Task 2~)가 열린다.

## 검증 상태

- **T0 구현 완료 (2026-10-28, 미커밋)**: `packages/core/src/catalog/snapshot/` 13개 파일, core barrel export, ADR-010. core vitest 89 files / 1238 tests PASS(신규 36), `tsc --noEmit` 오류 0, `@qa-sdk/browser`·`@qa-sdk/sdk`·`@qa-sdk/context` 빌드 성공, snapshot 모듈 `node:` import 0건.
- **Track A 구현 완료 (2026-10-29)**: Task 1~6. R-1(DecodeMap shape)·R-11(버전별 dim) 해소, 3-way parity 83 + registry parity 83, legacy-v1 corpus 619 case, strict 주소 파서.
- **Track C·D·E·F 구현 완료 (2026-10-29)**: 각 세션 브랜치에서 구현 후 main에 merge. E 후속으로 runtime PG 마이그레이션 drift(X-18) 수정.
- 남은 트랙: B (D-2 결정 대기), Wave 2 G2·G3·G5·G6 (측정 게이트). D-9는 G3에서 결정.
- B 계획의 테스트 코드는 실행 검증 전이다. Task 0이 전제(시그니처·참조 위치)를 다시 확인한다.

## 환경 메모

- 루트에서 `corepack pnpm exec …`를 실행하면 pnpm이 의존성 재설치를 시도하다 TTY가 없어 중단된다(`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). `--filter <pkg> build/test`는 같은 경고를 낸 뒤 정상 실행된다. 포맷은 `node_modules/.pnpm/oxfmt@0.42.0/node_modules/oxfmt/bin/oxfmt --write <paths>`로 직접 실행했다.
- 패키지 이름은 디렉토리명과 다를 수 있다: `packages/browser-sdk` → `@qa-sdk/browser`, `packages/demo-types` → `demo-types`.

## 실행 방식

- **Subagent-Driven** (권장): superpowers:subagent-driven-development — Task별 fresh subagent + 단계별 review. 트랙 간 인터페이스가 T0에 집중돼 있어, 트랙 내부 Task는 독립적으로 리뷰하기 좋다.
- **Inline**: superpowers:executing-plans — 한 세션에서 순서대로 실행.

트랙마다 별도 worktree·브랜치(`feat/swc-next-<track>-<slug>`)에서 실행한다.
