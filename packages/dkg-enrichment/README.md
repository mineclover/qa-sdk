# dkg-enrichment

DKG bootstrap **enrichment** + convergence/decision-flow 분석 스킬 (logic tier).

- `bootstrapDkg()` — `dkg.bootstrapDkgBase` → `enrichDkgGraph` → `dkg.bootstrapDkgFinalize`
- `enrichDkgGraph` — flow schema, headroom, overlap 분석
- 스킬: `convergeChain`, `auditCoverage` — `@qa-sdk/convergence` 분석기를 쓰는 정본 구현. `traceFlows`·`validateDslInvariants`는 kernel `dkg`가 정본이다 (중복 정리: `docs/proposals/swc-next-qa-sdk-optimization/06-feature-cleanup-candidates.md` M-1)

**kernel `dkg` 패키지는 convergence/decision-flow에 의존하지 않는다.** 전체 그래프가 필요하면 본 패키지를 사용한다.

```ts
import { bootstrapDkg } from "dkg-enrichment";
```
