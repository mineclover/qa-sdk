---
def:
  id: federated-connection-runtime
  type: spec
  level: leaf
  tier: component
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: approved
  layer: mediation
  svc: federated-connection-runtime
  tags: [connection, mapping, impact, policy, execution, verification]
  links:
    - target: federated-connection-contract
      type: depends_on
    - target: federated-architecture-governance
      type: implements
    - target: system-packages
      type: refs
    - target: spec-verification-system
      type: refs
sources:
  - packages/federated-connection-runtime/src/runtime-contract.ts
  - packages/federated-connection-runtime/src/planner.ts
  - packages/federated-connection-runtime/src/store.ts
  - packages/federated-connection-runtime/src/runtime.ts
  - packages/federated-connection-runtime/src/index.ts
  - packages/federated-connection-runtime/__tests__/runtime.test.ts
---

# Federated Connection Runtime

## 목적 ^purpose

`federated-connection`의 순수 identity/identifier-rule/mapping/relation 계약을 운영 가능한 read-mostly 흐름으로 조합한다. observation metadata를 영속화하고, graph snapshot과 policy에서 impact plan을 만들며, 승인·precondition·외부 executor·re-fetch·verification 상태를 분리해 관리한다.

이 문서는 ERP/CRM 업무 runtime의 명세가 아니다. source payload의 권위, source-specific API/SDK, source write와 business workflow는 runtime 외부의 adapter가 소유한다.

## 책임 구성 ^overview

| 책임 | 구현 | 소유하지 않는 것 |
|---|---|---|
| 상태 저장 | `InMemoryConnectionStateStore`, `SqliteConnectionStateStore` | source payload 전체와 source authority |
| observation 기록 | `StoredSourceObservation` | webhook payload를 final state로 확정하는 행위 |
| 식별자 규칙 고정 | `identifierRegistry` 주입, observation의 rule ID/version | source local ID를 connection ID로 치환하거나 다른 source rule을 공유하는 행위 |
| 영향 해석 | `createImpactPlan` | source write와 graph lifecycle mutation |
| policy | `PropagationPolicy`, propagation mode | 승인 우회와 업무 rule의 중앙 대체 |
| approval | `FederatedConnectionRuntime.approve/reject` | relation을 approval 상태로 바꾸는 행위 |
| execution bridge | `SourceExecutionAdapter` 주입 | 특정 ERP/CRM API 구현 |
| verification | re-fetch와 expected revision/hash 비교 | apply 성공을 자동 verified로 간주하는 행위 |
| audit/evidence | `ConnectionAuditEvent`, `ConnectionEvidenceSink` | quality/review ledger의 business approval authority |

## 상태 모델 ^constraint

- mapping과 relation은 `federated-connection` registry 규칙으로 검증한다.
- observation은 source identity와 revision을 보존하고 payload는 state store에 저장하지 않는다.
- identifier registry를 사용하는 observation은 source/entity별 active rule ID/version을 고정하고, execute 시 같은 rule로 재검증한다.
- identifier rule이 없거나 retired/draft이면 observation을 저장하지 않는다.
- exact source revision에 active mapping이 없으면 plan candidate를 `blocked`로 만든다.
- `automatic`도 high-risk candidate가 있으면 자동 승인하지 않는다.
- `review_required`, `notify_only`, `validate_only`, `blocked`는 source mutation으로 이어지지 않는다.
- approved plan은 실행 직전 source identity, status, revision, payload hash가 plan precondition과 일치해야 한다.
- identity/status/revision/payload hash 중 하나라도 달라지면 executor를 호출하지 않고 plan을 `stale`로 기록한다.
- executor receipt에 expected revision/hash가 없으면 결과는 `applied`이며 `verified`가 아니다.
- 실행 후 재조회에 성공한 observation metadata는 최신 source 상태로 store에 반영한다. 재조회에 실패하면 source mutation 여부를 확정하지 않고 `applied` 또는 `failed`로 남긴다.
- audit event는 actor/source/relation/policy/plan/action/result correlation을 보존한다.
- 외부 evidence sink 실패는 source execution 상태를 되돌리지 않으며 `evidence.failed` audit으로 남긴다.

## 운영 흐름 ^workflow

```text
SourceAdapter
  -> observe()
  -> StoredSourceObservation
  -> createPlan(policy)
  -> proposed / automatic approval
  -> approve()
  -> execute(SourceExecutionAdapter)
  -> re-fetch
  -> applied / verified / stale / failed
```

### Impact graph

planner는 source endpoint에서 시작하여 다음 경계를 결정론적으로 순회한다.

1. exact source revision의 active mapping을 connection endpoint로 확장한다.
2. typed relation의 source endpoint를 따라 indirect target을 찾는다.
3. connection endpoint의 active reverse mapping으로 다른 source reference를 찾는다.
4. `maxDepth`를 넘는 후보는 만들지 않으며, 같은 endpoint는 한 번만 방문한다.
5. 직접 영향과 간접 영향, risk, relation path, disposition을 각각 보존한다.

mapping이 없거나 ambiguity가 있으면 자동으로 다른 target을 선택하지 않고 blocked/ambiguous 경계를 소비자가 처리한다.

## Persistence ^implementation

SQLite store는 다음 metadata만 저장한다.

- mapping/relation payload와 deterministic key
- source identity, revision, observedAt, payloadHash, change evidence
- 실행 후 재조회된 최신 observation metadata
- plan status, policy, candidates, actions, approval
- execution status, receipts, re-fetch verification evidence
- audit event와 외부 evidence sink 전달 상태

SQLite 재기동 후 registry, observation, plan을 복원할 수 있어야 한다. in-memory store는 동일한 `ConnectionStateStore` 계약을 테스트와 local dry-run에 제공한다.

## 외부 실행 경계 ^context

`SourceExecutionAdapter.apply()`는 승인된 abstract action을 source-specific operation으로 해석한다. runtime은 다음만 전달하고 강제한다.

- plan과 action
- 실행 직전 source identity, status, revision, payload hash
- relation path와 source precondition
- executor receipt의 expected revision/hash

runtime은 source API client를 직접 import하지 않으며, executor가 source를 변경했는지 최종 판단하기 위해 re-fetch한다. `apply`와 `verify`는 별도 상태다.

## 검증 ^validation

```bash
corepack pnpm --filter federated-connection-runtime typecheck
corepack pnpm --filter federated-connection-runtime test
corepack pnpm --filter federated-connection-runtime build
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
