# dkg-enrichment

DKG bootstrap **enrichment** + convergence/decision-flow 분석 스킬 (logic tier).

- `bootstrapDkg()` — `dkg.bootstrapDkgBase` → `enrichDkgGraph` → `dkg.bootstrapDkgFinalize`
- `enrichDkgGraph` — flow schema, headroom, overlap 분석
- 스킬: `convergeChain`, `auditCoverage`, `traceFlows`, …

**kernel `dkg` 패키지는 convergence/decision-flow에 의존하지 않는다.** 전체 그래프가 필요하면 본 패키지를 사용한다.

```ts
import { bootstrapDkg } from "dkg-enrichment";
```
