# work-domain

`work-domain`은 작업 유형 분류와 품질 게이트 매핑을 제공한다. 품질 게이트 번들 문서가 공개 계약을 정의한다.

## 먼저 볼 문서

- [work-domain-quality-contract.spec.md](../../docs/specs/quality-gates/work-domain-quality-bundle/work-domain-quality-contract.spec.md) — 공개 계약
- [work-domain-quality-bundle.md](../../docs/specs/quality-gates/work-domain-quality-bundle.md) — 품질 번들 맥락
- [definition-harness-architecture.spec.md](../../docs/specs/definition-catalog/definition-harness-architecture.spec.md) — harness와의 연결

## 패키지 역할

- `WorkDomainId`, `GateKindId`, `resolveQualityGates()`, `buildDocQuery()`, `classifyUserStory()`를 제공한다.
- contract → gate kind → harness state를 연결하는 taxonomy 커널이다.
- definition-catalog 품질 시스템이 이 패키지를 기준 분류기로 사용한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/types.ts`, `src/registry.ts`, `src/mapping.ts` — taxonomy/매핑
- `src/classify.ts` — 작업 유형 분류
- `src/quality-gates.ts` — 품질 게이트 매핑
- `src/harness.ts`, `src/harness-model.ts`, `src/gate-tracker.ts`, `src/gate-kind.ts` — harness/gate 계층

## 실행

```bash
pnpm --filter work-domain build
pnpm --filter work-domain test
```
