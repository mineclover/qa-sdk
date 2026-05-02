# Plan A — Foundation (단계 1·2·4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** enterprise-pm 시뮬에 카나리/스케일링 컨트롤 플레인을 도입하기 위한 토대(host alias 제거, 식별자 합성 grammar, read replica 토폴로지)를 만든다.

**Architecture:** 본 plan은 spec set `docs/superpowers/specs/2026-04-28-canary-scaling/`의 단계 1·2·4를 구현한다. 세 단계는 의존성 그래프상 병렬 가능(단계 1 후 2와 4 동시 진행). 본 plan에서는 PR 단위를 보존한 채 한 plan에서 묶어 진행하지만, 각 단계 끝에서 단독 머지 가능하도록 task 경계를 잡는다.

**Tech Stack:** TypeScript (ES2023, NodeNext), tsup (ESM+CJS dual), pnpm 10.30.3 workspace, vitest + fast-check (property test), Zod 3, Drizzle ORM (catalog), PostgreSQL 16-alpine, Docker Compose, GitHub Actions.

**Spec 인용 위치:** `docs/superpowers/specs/2026-04-28-canary-scaling/{03,04,06}-*.md`


**범위:** 본 plan은 단계 1·2·4를 다룬다. 분할 review를 위해 단계별 파일로 분리되어 있다.

## 단계 인덱스

| 단계 | 파일 | 줄수 |
|---|---|---|
| 1 | [host.docker.internal 제거 + ingest 컨테이너화](./A-stage-1-host-and-ingest.md) |      273 |
| 2a-i | [skeleton + 식별자 #1~#5](./A-stage-2a-i-skeleton-and-grammar-1-5.md) | 1040 |
| 2a-ii | [식별자 #6~#10](./A-stage-2a-ii-grammar-6-10.md) | 731 |
| 2a-iii | [식별자 #11~#15](./A-stage-2a-iii-grammar-11-15.md) | 823 |
| 2b | [identifier-grammar vocab + lint + CI](./A-stage-2b-grammar-tooling.md) |      276 |
| 4 | [read replica + db-bootstrap dual](./A-stage-4-read-replica.md) |      458 |

## File Structure

본 plan에서 생성/수정되는 파일.

### 단계 1 — host.docker.internal 제거 + ingest 컨테이너화

| 종류 | 경로 |
|---|---|
| Create | `packages/ingest-server/Dockerfile` |
| Create | `packages/ingest-server/.dockerignore` |
| Modify | `simulations/enterprise-pm/docker-compose.sim.yaml` (qa-sdk-ingest service entry 추가, host.docker.internal alias 제거 또는 host-gateway opt-in) |
| Modify | `simulations/enterprise-pm/.env.sim.example` (host.docker.internal → qa-sdk-ingest, otel collector도 동일) |
| Modify | `simulations/enterprise-pm/scripts/sim-up.sh` (qa-sdk-ingest healthcheck 추가) |

### 단계 2 — sim-identifier-grammar 패키지 + identifier-gate CI

| 종류 | 경로 |
|---|---|
| Create | `packages/sim-identifier-grammar/package.json` |
| Create | `packages/sim-identifier-grammar/tsup.config.ts` |
| Create | `packages/sim-identifier-grammar/tsconfig.json` |
| Create | `packages/sim-identifier-grammar/vitest.config.ts` |
| Create | `packages/sim-identifier-grammar/src/index.ts` (모든 builder/parser re-export) |
| Create | `packages/sim-identifier-grammar/src/service-prefix.ts` |
| Create | `packages/sim-identifier-grammar/src/version-tag.ts` |
| Create | `packages/sim-identifier-grammar/src/image-tag.ts` |
| Create | `packages/sim-identifier-grammar/src/http-header.ts` |
| Create | `packages/sim-identifier-grammar/src/event-name.ts` |
| Create | `packages/sim-identifier-grammar/src/schema-hash.ts` |
| Create | `packages/sim-identifier-grammar/src/decision-id.ts` |
| Create | `packages/sim-identifier-grammar/src/cycle-id.ts` |
| Create | `packages/sim-identifier-grammar/src/pubsub-channel.ts` |
| Create | `packages/sim-identifier-grammar/src/cache-key.ts` |
| Create | `packages/sim-identifier-grammar/src/idempotency-key.ts` |
| Create | `packages/sim-identifier-grammar/src/replication-slot.ts` |
| Create | `packages/sim-identifier-grammar/src/label-key.ts` |
| Create | `packages/sim-identifier-grammar/src/decision-category.ts` |
| Create | `packages/sim-identifier-grammar/src/decision-signal.ts` |
| Create | `packages/sim-identifier-grammar/src/grammar-registry.ts` |
| Create | `packages/sim-identifier-grammar/tests/roundtrip.test.ts` (fast-check property) |
| Create | `simulations/enterprise-pm/contracts/header-vocabulary.catalog.ts` |
| Create | `simulations/enterprise-pm/contracts/event-vocabulary.catalog.ts` |
| Create | `scripts/lint-identifiers.ts` |
| Create | `.github/workflows/identifier-gate.yml` |
| Modify | `package.json` (root) — `sim:lint:identifiers` 스크립트 추가 |
| Modify | `pnpm-workspace.yaml` (자동 인식이지만 catalog에 ulid 등 추가 필요 시) |

### 단계 4 — read replica 컨테이너 + db-bootstrap 분리

| 종류 | 경로 |
|---|---|
| Modify | `packages/infra-engine/docker-compose.infra.yaml` (qa-sdk-db에 wal_level=replica + replicator role, qa-sdk-db-replica service entry 추가) |
| Create | `packages/infra-engine/init/qa-sdk-db-replication.sql` (replicator role + slot 생성) |
| Modify | `packages/db-bootstrap/src/connection.ts` (createDualConnection 신규) |
| Modify | `packages/db-bootstrap/src/index.ts` (재export) |
| Modify | `packages/db-bootstrap/src/env.ts` (writeUrl/readUrl env 키 schema 확장) |
| Modify | `simulations/enterprise-pm/.env.sim.example` (SIM_DB_WRITE_URL, SIM_DB_READ_URL) |
| Create | `packages/db-bootstrap/src/dual-connection.test.ts` |

## Self-Review Checklist

본 plan 작성 후 작성자가 직접 점검한다 (사용자 review 이전).

**1. Spec coverage**
- [ ] `06-roadmap.md` §1 단계 1 모든 산출물이 단계 1 task에 매핑되었는가?
- [ ] `03-identifier-grammar.md` §2.1 ~ §2.15의 15종 식별자가 단계 2 task에 모두 등장하는가? (Task 2.2/2.3/2.4 풀 작성, 2.5~2.16은 패턴 위임 명시)
- [ ] `04-scaling-infra.md` §4.1 ~ §4.5의 read replica·DataSource 분리가 단계 4 task에 매핑되었는가?
- [ ] `04-scaling-infra.md` §6 host.docker.internal 제거가 단계 1 task에 매핑되었는가?

**2. Placeholder 스캔**
- [ ] "TBD/TODO/implement later" 등 본 plan에 없는가? (`grep -n "TBD\|TODO\|FIXME" docs/superpowers/plans/2026-04-28-canary-scaling/A-foundation.md`)

**3. Type 일관성**
- [ ] `createDualConnection` 함수명/시그니처가 Task 4.3 ~ 4.6에서 동일한가?
- [ ] grammar #N 번호가 spec과 plan에서 일치하는가?

**4. 명령 실행 가능성**
- [ ] 모든 `pnpm --filter ...` 명령이 실제 패키지명을 사용하는가? (sim-identifier-grammar — unscoped name 일치)
- [ ] 모든 docker compose 명령이 정확한 yaml 경로를 사용하는가?

---

## 단계 1·2·4 완료 정의 (Definition of Done)

- [ ] 단계 1: `pnpm sim:up` 후 11 서비스 (qa-sdk-ingest 포함) 모두 healthy
- [ ] 단계 1: 기존 시나리오 1~8 PASS
- [ ] 단계 1: `grep host.docker.internal simulations/enterprise-pm/` 가 비어 있음 (extra_hosts 외)
- [ ] 단계 2: `pnpm --filter sim-identifier-grammar test` 모든 라운드트립 property test PASS (15종 식별자 X 200 cases)
- [ ] 단계 2: `pnpm sim:lint:identifiers` PASS
- [ ] 단계 2: GitHub Actions identifier-gate 워크플로 PASS
- [ ] 단계 4: `qa-sdk-db-replica`가 `pg_is_in_recovery() = t` 상태로 부팅
- [ ] 단계 4: primary에 INSERT한 row가 1초 안에 replica에서 SELECT 가능
- [ ] 단계 4: `pnpm --filter db-bootstrap test` 모든 테스트 PASS

---

## 다음 Plan과의 관계

- **Plan B (Core mechanics)**: 단계 3 (sim-service-catalog 패키지) — 본 plan의 sim-identifier-grammar #1·#2를 입력으로 service prefix를 catalog에 등록. 단계 5 (outbox SKIP LOCKED + idempotency) — 본 plan grammar #12 idempotency key 사용. 단계 6 (bitmap TTL/version-check) — 본 plan grammar #11 cache key 사용.
- **Plan C (Canary delivery)**: 단계 7 (gateway routing) — 본 plan grammar #4 HTTP header, #2 version tag 사용. 단계 8 (approval-api v1/v2) — 본 plan의 createDualConnection을 BFF/reporting slice에서 사용.
- **Plan D (Controller)**: 단계 9 controller — 본 plan grammar #7/#8/#14/#15 사용.
- **Plan E (Scenarios + closing)**: 모든 식별자 사용 + 본 plan에서 만든 identifier-gate, replication slot fixture 활용.
