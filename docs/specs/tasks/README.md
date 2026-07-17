---
def:
  id: task-index
  type: knowledge
  knowledge_kind: guide
  tier: layout
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [roadmap, task-index]
  links:
    - target: gate-system
      type: refs
    - target: query-system
      type: refs
    - target: pipeline-system
      type: refs
    - target: permission-system
      type: refs
    - target: weighted-index-system
      type: refs
    - target: task-infra-debug-store
      type: refs
    - target: task-infra-sql-adapters
      type: refs
    - target: task-service-gate
      type: refs
    - target: task-service-query
      type: refs
    - target: task-spec-partial-binder
      type: refs
    - target: task-spec-permission-engine
      type: refs
    - target: task-test-api-payload
      type: refs
    - target: task-test-backup
      type: refs
    - target: task-test-bigint
      type: refs
    - target: task-test-gpu-fallback
      type: refs
    - target: task-test-permission-code
      type: refs
    - target: task-test-schema-sync
      type: refs
    - target: task-test-wasm-js
      type: refs
    - target: task-unit-1-async-worker
      type: refs
sources:
  - docs/specs/gate/gate-system.md
  - docs/specs/query-system/query-system.md
  - docs/specs/pipeline-system/pipeline-system.md
  - docs/specs/permission/permission-system.md
  - docs/specs/weighted-index-system.spec.md
---

# 작업 태스크 인덱스

> runtime-flows.spec.md 심볼 기반 구현 태스크 + 테스트/스펙 보강 태스크.

## 목적 ^purpose

runtime flow 기반으로 파생된 구현 task의 현재 위치를 안내한다. 구현 완료 항목은 각 system/spec 문서와 source/test 경로가 SSOT이고, 이 인덱스는 잔여 작업과 과거 task 기록을 분리해 찾기 쉽게 유지한다.

## 실행 순서 (테스트·스펙 보강 → 인프라 → 서비스)

### Phase 1 — 테스트 보강 (독립, 순서대로 실행)

| # | 태스크 | 대상 | 상태 |
|---|---|---|---|
| 1 | ~~[test-bigint.md](test-bigint.md)~~ | BigInt B-1~B-3 | ✅ 완료 |
| 2 | ~~[test-permission-code.md](test-permission-code.md)~~ | permission-code.ts 5 exports | ✅ 완료 |
| 3 | ~~[test-api-payload.md](test-api-payload.md)~~ | api-payload.ts batch 검증 | ✅ 완료 |
| 4 | ~~[test-schema-sync.md](test-schema-sync.md)~~ | schema-sync.ts 동기화 | ✅ 완료 |
| 5 | ~~[test-backup.md](test-backup.md)~~ | backup.ts export/import | ✅ 완료 |
| 6 | ~~[test-wasm-js.md](test-wasm-js.md)~~ | weighted-wasm JS 래퍼 | ✅ 완료 |
| 7 | ~~[test-gpu-fallback.md](test-gpu-fallback.md)~~ | weighted-gpu fallback | ✅ 완료 |

### Phase 2 — 스펙 보강 (테스트 후 정확한 스펙 작성)

| # | 태스크 | 대상 | 상태 |
|---|---|---|---|
| 8 | ~~[spec-permission-engine.md](spec-permission-engine.md)~~ | permission-engine 전체 (패키지 인덱스 + 4건 스펙) | ✅ 완료 |
| 9 | ~~[spec-partial-binder.md](spec-partial-binder.md)~~ | weighted-index/partial-binder 스펙 | ✅ 완료 |

### Phase 3 — 인프라 + 서비스 (Phase 1-2 이후)

| # | 태스크 | 대상 흐름 | 선행 | spec.todo | 상태 |
|---|---|---|---|---|---|
| 10 | ~~[infra-debug-store.md](infra-debug-store.md)~~ | D3 | 없음 | 신규 | ✅ 완료 |
| 11 | ~~[infra-sql-adapters.md](infra-sql-adapters.md)~~ | S4 | 없음 | H-1~H-3 | ✅ 완료 |
| 12 | ~~[unit-1-async-worker.md](unit-1-async-worker.md)~~ | A2→A4 | 없음 | 신규 | ✅ 완료 |
| 13 | ~~[service-gate.md](service-gate.md)~~ | S2, A4 | 없음 | E-1~E-4 | ✅ 완료 |
| 14 | ~~[service-query.md](service-query.md)~~ | S2, A5 | gate | F-1~F-5 | ✅ 완료 |
| 15 | [unit-2-pipeline.md](../pipeline-system/unit-2-pipeline.md) | A1, A5, A6 | unit-1 | I-1~I-6 | ✅ 완료 |
| 16 | [unit-3-monitoring.md](unit-3-monitoring.md) | A6 조회 | unit-2 | 신규 | 후속 검토 |

## 의존 그래프

```
Phase 1 (테스트 — 각각 독립, 병렬 가능)
  #2 permission-code  #3 api-payload  #4 schema-sync  #5 backup  #6 wasm  #7 gpu

Phase 2 (스펙 — Phase 1 이후)
  #8 perm-codec-system → #9 partial-binder-spec

Phase 3 (인프라 + 서비스)
  #10 debug-store ──────────────────────────────────── (독립)
  #11 sql-adapters ──┬──────────────────────────────── (독립)
                     │
  #12 async-worker ──┼─→ #15 pipeline ─→ #16 monitoring
                     │         ↑
  #13 gate-service ──┘         │
  #14 query-service ──(gate)───┘
```
