# Auth Model Implementation Backlog — Plans

`docs/proposals/auth-model-implementation-backlog/README.md`의 미구현 6개 항목과 확장 작업(PG 이행, 시뮬 프로젝트)을 phase별 plan으로 분해한 디렉토리.

## Phase 진행 순서

각 phase는 의존 그래프상 직전 phase 완료 후 시작.

| Phase | Plan | 상태 |
|---|---|---|
| 1 | [01-audit-db-otel.md](./01-audit-db-otel.md) — §1 DrizzleAuditRecorder + OtelAuditRecorder | 작성 완료 |
| 1 | [02-ingest-audit-versioning.md](./02-ingest-audit-versioning.md) — §4 P1~P3 (key_observations + address_context) | 작성 완료 |
| 1 | [03-coordinate-storage-validation.md](./03-coordinate-storage-validation.md) — §6 def validate 자동화 | 작성 완료 |
| 2 | (미작성) — SQLite/D1 → PostgreSQL 이행 | brainstorm 필요 |
| 3 | (미작성) — §3 RLS enforcement (PG 위에서) | Phase 2 후 |
| 4 | (미작성) — Enterprise ERP + PM 시뮬 프로젝트 | brainstorm + spec 필요 |
| 5 | (미작성) — §2 Bitmap pipeline + §5 Marginal density | Phase 4 후 |

## Phase 1 내부 의존

`02 → 03` 순서 권장: §4가 ingest-server의 `key_observations`/`key_observation_prefixes`를 `(prefix_id, version, address)` 복합 PK로 정리한 뒤 §6의 자동 검출이 위반 0으로 통과한다. §4 미적용 시 §6의 통합 테스트가 정상적으로 위반을 검출 → §4를 먼저 끝내거나 임시 exempt 주석으로 우회 가능.

`01`은 `02/03`과 독립. 병렬 머지 가능.

## 실행

각 plan은 자체 task 분해와 commit 단위를 포함한다. 실행 방식 두 가지:

1. **Subagent-Driven**: superpowers:subagent-driven-development — task별 fresh subagent 디스패치 + 단계별 review
2. **Inline Execution**: superpowers:executing-plans — 현 세션에서 batch 실행

선택은 plan 머리말 참조.

## 다음 phase 준비

Phase 2부터는 brainstorming이 선행 — 각 항목의 task 분리 시 수행.
