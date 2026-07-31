---
def:
  id: analysis-self-check-test
  tier: component
  type: spec
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [testing, observability, error-handling]
  links:
    - target: analysis-self-check
      type: verifies
    - target: analysis-self-check-rule
      type: depends_on
sources:
  - packages/convergence/src/self-check-analyzer.test.ts
  - packages/cli/src/commands/dkg.e2e.test.ts
---
# Self-Check — 검증 기준

## 목적 ^purpose

Self-check의 좌표화, 실패 경로, metrics detail 출력, package-scoped flow trace가
현재 구현과 함께 유지되는지 검증한다.

## 검증 매핑 ^defines

| 검증 표면 | 현재 테스트 |
|-----------|-------------|
| build/test 결과 encode·aggregate·coverage | `packages/convergence/src/self-check-analyzer.test.ts` |
| build failure/test failure invariant | `packages/convergence/src/self-check-analyzer.test.ts` |
| full self-check build/test/metrics/IntentLink smoke | `packages/cli/src/commands/dkg.e2e.test.ts` |
| non-`ok` metric의 ID·status·detail 출력 | `packages/cli/src/commands/dkg.ts` + full self-check |

## 시나리오 ^scenarios

1. 정상 build/test 결과는 health 100%와 유효한 address context를 만든다.
2. build failure와 test failure는 각각 failure-path invariant로 남고, 실행 결과가
   누락되거나 성공으로 위장되지 않는다.
3. 패키지의 build/test/contract 이벤트를 함께 검사할 때 단일 prefix 레코드로 인한
   false positive가 발생하지 않는다.
4. metrics warning은 metric ID, 상태, detail과 함께 출력되고, `--apply` 전에는
   observation 저장이 실행되지 않는다.

## 검증 명령 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli typecheck
corepack pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js dkg self-check
```
