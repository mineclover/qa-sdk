# definition-catalog

`definition-catalog`는 문서 메타데이터를 좌표와 그래프로 다루는 커널이다. 이 패키지는 central spec을 먼저 보고 코드를 따라가는 방식이 맞다.

## 먼저 볼 문서

- [definition-catalog.spec.md](../../docs/specs/definition-catalog/definition-catalog.spec.md) — 전체 진입점
- [definition-management.spec.md](../../docs/specs/definition-catalog/definition-management.spec.md) — 운영 흐름
- [definition-harness-architecture.spec.md](../../docs/specs/definition-catalog/definition-harness-architecture.spec.md) — 상태/하네스 구조
- [definition-quality-gates.spec.md](../../docs/specs/definition-catalog/definition-quality-gates.spec.md) — 품질 게이트 통합

## 패키지 역할

- taxonomy, extraction, assembly, contract, state-model, quality-gates, harness를 제공한다.
- docs frontmatter를 스캔해 registry/graph/runtime 상태를 파생한다.
- definition-service와 CLI가 공유하는 문서 커널 역할을 맡는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/taxonomy.ts`, `src/vocabulary.ts`, `src/types.ts` — 분류 체계
- `src/frontmatter.ts`, `src/extract.ts`, `src/assemble.ts` — 문서 파싱/조립
- `src/contract.ts`, `src/contract-evidence.ts`, `src/contract-stats.ts` — 계약 조립
- `src/state-model.ts`, `src/harness-*`, `src/cross-loop-bridge.ts`, `src/runtime.ts` — 상태/하네스
- `src/validate.ts`, `src/code-references.ts` — 검증/코드 연결

## 실행

```bash
pnpm --filter definition-catalog build
pnpm --filter definition-catalog test
```
