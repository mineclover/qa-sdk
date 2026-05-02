# Enterprise PM Simulation — Operator Workflows

운영자 관점의 canonical flow 문서.  
목적은 **시나리오 실행 결과를 바로 audit / graph / retention 조사로 이어 붙이는 것**이다.

## 1. 기본 원칙

- `pnpm sim:scenarios run ...` 출력이 1차 진입점이다.
- 각 시나리오는 가능하면 `operator.N:` 줄로 후속 명령을 직접 남긴다.
- 운영자는 이 handoff를 복사해서 실행한다.
- graph 관련 시나리오는 `audit context`를 우선 사용한다.
- non-graph 시나리오는 `audit trace` / `audit first-failure` / `audit entry`를 사용한다.

즉 흐름은 보통 다음 순서다.

```text
run scenario
  -> operatorHints 확인
  -> audit trace / first-failure / context
  -> 필요하면 graph prune
  -> ingest insight 확인
```

## 2. CLI 진입점

### 시나리오 실행

```bash
pnpm --filter @qa-sdk/sim-scenarios run scenario-4-cross-dept-deny
pnpm --filter @qa-sdk/sim-scenarios run scenario-6-delegated-resource
pnpm --filter @qa-sdk/sim-scenarios run --all
```

출력 예시:

```text
[OK] scenario-4-cross-dept-deny
  summary: passed, 3200ms, 4 step
  traces: 2 (t1, t2)
  operator.1: deny-trace: pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id ...
  operator.2: deny-first-failure: pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id ...
  operator.3: deny-entry: pnpm --filter @qa-sdk/sim-scenarios start -- audit entry --span-id ...
```

### Audit CLI

```bash
pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id <root-span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id <root-span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit entry --span-id <span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id <root-span-id> --graph-id <graph-id>
```

용도:

- `audit trace`
  - 전체 nested audit tree를 본다.
- `audit first-failure`
  - deny/error의 첫 실패 지점을 본다.
- `audit entry`
  - 특정 failure span을 단건 재생한다.
- `audit context`
  - trace + latest graph snapshot + retention insight를 한 번에 본다.

## 3. Audit-Only Workflow

적용 시나리오:

- `scenario-2-project-create`
- `scenario-3-self-dept-approval`
- `scenario-4-cross-dept-deny`
- `scenario-5-three-stage-approval`
- `scenario-8-pubsub-invalidation`

기본 순서:

```bash
pnpm --filter @qa-sdk/sim-scenarios run scenario-4-cross-dept-deny

# run 출력의 operator hint 사용
pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id <root-span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id <root-span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit entry --span-id <span-id>
```

판단 포인트:

- deny 시나리오:
  - `firstFailure.outcome=deny`
  - `denyReason` 존재
  - trace 내부 deny check 존재
- allow 시나리오:
  - `firstFailure = null`
  - check entry가 모두 allow

## 4. Graph Lifecycle Workflow

적용 시나리오:

- `scenario-6-delegated-resource`

기본 순서:

```bash
pnpm --filter @qa-sdk/sim-scenarios run scenario-6-delegated-resource

# run 출력의 operator hint 사용
pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id <root-span-id> --graph-id <graph-id>

# 필요시 retention housekeeping
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --graph-id <graph-id> --keep-latest 1 --with-insight
```

`audit context`에서 확인할 것:

- `trace`
  - delegated access가 실제 allow 되었는가
- `graphSnapshot`
  - latest snapshot에 delegate principal이 들어있는가
- `graphRetentionInsight`
  - prune/sweep event가 ingest에 남았는가

## 5. Token / Refresh Workflow

적용 시나리오:

- `scenario-7-bitmap-refresh`

기본 순서:

```bash
pnpm --filter @qa-sdk/sim-scenarios run scenario-7-bitmap-refresh

# run 출력의 operator hint 사용
pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id <pre-expiry-root>
pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id <post-refresh-root>
```

판단 포인트:

- refresh 전 trace:
  - 기존 token으로 정상 접근했는가
- refresh 후 trace:
  - 새 token으로 재인증 접근이 성공했는가

## 6. Retention Workflow

수동 운영:

```bash
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --keep-latest 1
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --graph-id <graph-id> --keep-latest 1
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --graph-id <graph-id> --keep-latest 1 --with-insight
```

직접 조회:

```bash
curl "http://localhost:3200/v1/insights/graph-retention?limit=20" | jq .
curl "http://localhost:3200/v1/insights/graph-retention?graph_id=<graph-id>" | jq .
```

이벤트 키:

- `sim.graph_retention.sweep`
- `sim.graph_retention.graph_pruned`
- `sim.graph_retention.failed`

## 7. 선택 기준

- `rootSpanId`만 있으면:
  - `audit trace` / `audit first-failure`
- `rootSpanId + graphId`가 있으면:
  - `audit context`
- retention 실행 직후면:
  - `housekeeping graph-retention --with-insight`
- 특정 failure span까지 있으면:
  - `audit entry`

## 8. 운영자 요약

```text
1. 시나리오를 실행한다.
2. 출력의 operator.N 줄을 그대로 사용한다.
3. graph 시나리오는 audit context를 먼저 본다.
4. deny 시나리오는 first-failure -> entry 순으로 내려간다.
5. retention 후에는 ingest insight로 event가 남았는지 확인한다.
```
