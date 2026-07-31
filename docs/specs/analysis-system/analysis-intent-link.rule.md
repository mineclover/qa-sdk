---
def:
  id: analysis-intent-link-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [observability, event, trace]
  links:
    - target: analysis-intent-link
      type: constrains
sources:
  - packages/dkg/src/skills/flow-trace.ts
  - packages/cli/src/commands/dkg.ts
---
# IntentLink — 소비 규칙

## 목적 ^purpose

IntentLink flow trace를 소비할 때 event context와 observation lifecycle을
일관되게 유지하고, 근거 없는 자동 해소를 방지한다.

## 소비 체크리스트

- `traceFlows()`는 `address_context`가 비어 있지 않은 event record만 검사한다.
- invariant가 있는 IntentLink는 endpoint 순서와 invariant 텍스트를 함께 사용해
  누락 event를 판정한다.
- 위반 observation ID는 IntentLink와 missing prefix에서 결정적으로 파생한다.
- `resolveRecoveredFlowObservations()`는 현재 실행에서 endpoint가 실제 관측된
  link만 대상으로 하며, 같은 실행의 trace 위반이 있으면 해소하지 않는다.
- records가 없거나 link가 미관측이면 정상 결과만으로 과거 observation을 닫지 않는다.
- observation 생성·해소와 관련 event snapshot 영속화는 CLI `--apply`에서만 수행한다.

## 구현·검증 증거 ^implementation-evidence

flow 판정과 회복 후보 계산은 `packages/dkg/src/skills/flow-trace.ts`가 소유하고,
self-check orchestration과 DKG 저장은 `packages/cli/src/commands/dkg.ts`가 담당한다.

검증 명령:

```bash
corepack pnpm --filter dkg test
corepack pnpm --filter @qa-sdk/cli typecheck
node packages/cli/dist/index.js dkg self-check --apply
```
