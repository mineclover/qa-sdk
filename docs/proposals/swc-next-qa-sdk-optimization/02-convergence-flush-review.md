---
def:
  id: swc-next-qa-sdk-optimization-02-convergence-flush-review
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-29
part_of: swc-next-qa-sdk-optimization
role: audit
sources:
  - packages/ingest-server/src/lib/convergence-scheduler.ts
  - packages/ingest-server/src/lib/convergence-pipeline.ts
  - packages/ingest-server/src/server.ts
---

# Convergence 주기 flush (scheduler) 검토

## 목적 ^purpose

Track E(D-4)에서 runner 자체 timer를 지우고 `convergence-scheduler`만 남긴 뒤, 기본 주기 flush 간격이 60초에서 5분으로 바뀌었다. 현재는 5분을 유지한다(2026-10-29 결정). 이 문서는 scheduler가 왜 생겼는지, 제거할 경우 무엇이 빠지는지, 제거한다면 무엇으로 대체해야 하는지를 정리한다. 제거 여부는 결정 D-9로 남긴다.

## 1. 등장 배경 ^defines

- `convergence-scheduler.ts`와 runner 내부 `setInterval`(60초)은 **같은 커밋** `cc804f94`(2026-03-21, "MSA 아키텍처 + 관측 루프 …")에서 함께 들어왔다. 처음부터 같은 역할의 timer가 두 개였다.
- scheduler의 헤더 주석에 적힌 이유: "트래픽이 낮아 threshold에 못 미치는 시간대에도 convergence 분석이 실행되도록 보장. cleanup-scheduler와 동일한 패턴."
- 즉 scheduler는 **저트래픽일 때의 최대 지연 상한**을 보장하는 장치다. 별도의 설계 근거 문서는 없고, `docs/msa-architecture.md:173`에 "주기적 강제 flush (저트래픽 대응)"라는 한 줄만 있다.

## 2. 현재 flush 트리거 (Track E 이후)

| 트리거 | 위치 | 조건 |
|---|---|---|
| 건수 threshold | `ConvergencePipelineRunner.notifyCompletion` | 버퍼 trace 수 ≥ `CONVERGENCE_RECORD_THRESHOLD` (기본 100) |
| 메모리 cap | 같은 함수 | 버퍼 ≥ cap (10,000) |
| 주기 | `installConvergenceScheduler` | `CONVERGENCE_SCHEDULE_INTERVAL_MS` (기본 300,000ms)마다. 버퍼가 비어 있으면 `flush()`가 즉시 `null` |
| 종료 | runner `dispose()` | 잔여 버퍼 flush |

scheduler는 flush 정책을 runner 밖에서 시간으로 보완한다. 트리거 판단이 두 컴포넌트에 나뉘어 있다.

## 3. 제거하면 빠지는 것

- 버퍼가 threshold에 못 미치면 다음 trace가 충분히 쌓이거나 프로세스가 종료될 때까지 convergence가 돌지 않는다. 개발·데모처럼 트래픽이 적은 환경에서는 사실상 무기한 지연된다.
- CON-005 자동 observation, flow evidence, metric observation이 그만큼 늦어진다.
- 버퍼 메모리 상한(cap)은 유지되므로 메모리 문제는 없다.

## 4. 대안

| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| A. 유지 (현재) | 5분 interval scheduler | 변경 없음 | idle에도 timer가 돌고, 정책이 runner·scheduler 둘로 나뉨 |
| B. runner 내부 max-wait (권장 대체안) | 버퍼가 비어 있다가 첫 trace가 들어올 때 one-shot timer(`maxWaitMs`)를 걸고, flush하면 해제한다. scheduler 삭제 | flush 정책(건수·cap·최대 대기·종료)을 한 곳이 소유. idle일 때 timer 없음. 지연 상한 보장은 동일 | runner 테스트를 fake timer로 다시 써야 함 |
| C. 주기 flush 제거 | threshold·cap·종료·수동 트리거(API/CLI)만 남김 | 가장 단순 | 저트래픽 지연 상한 없음. 수동 트리거 endpoint를 새로 만들어야 함 |

제거한다면 **B**를 권장한다. 지연 상한이라는 scheduler의 존재 이유는 지키면서 timer를 하나로 줄인다.

## 5. 시점

G3(incremental convergence)은 trace 버퍼 대신 dirty set으로 재계산 범위를 정한다. 트리거 정책도 그때 다시 설계되므로, scheduler 제거는 **G3 착수 때 함께 결정**하는 것이 중복 작업이 적다. 그 전까지는 A(5분)를 유지한다.

## 6. 함께 발견한 문제 — worker 모드에는 convergence가 없다

- `startWorker()`(`server.ts:418~`)는 transition engine만 만들고 convergence pipeline·scheduler를 만들지 않는다.
- Track E 이후 queue 경로(`processPhaseTwoTask`)도 `runPostVerdictStages`를 호출하지만, worker 프로세스에는 `convergencePipeline`이 없으므로 convergence 알림이 일어나지 않는다.
- 따라서 `TASK_QUEUE_ENABLED=true`로 server와 worker를 나눠 배포하면 convergence가 실행되지 않는다. server 프로세스의 runner는 queue 경로에서 trace 완료를 통지받을 방법이 없다.
- 이 문제는 scheduler 유무와 무관하게 존재한다. G3에서 convergence를 worker 쪽으로 옮기거나(dirty set 기반 재계산과 함께), 완료 trace를 queue 이벤트로 server에 돌려주는 방식 중 하나를 택해야 한다. README 결정 D-9의 범위에 포함한다.
