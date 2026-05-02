# Plan B — Core mechanics (단계 3·5·6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan A에서 깔린 식별자 grammar와 read replica 토대 위에, 카나리·스케일링이 의존하는 핵심 메커니즘 3가지(서비스 버전 카탈로그, outbox 다중 dispatcher 안전성, bitmap 캐시 정합성 회복)를 구현한다.

**Architecture:** 본 plan은 spec set의 단계 3·5·6을 구현한다. 단계 3은 카나리 토폴로지(`02`)의 catalog version axis 통합 — 빌드 파이프라인이 catalog를 입력으로 사용하게 만들고 controller가 승격 시 호출할 transitionState API를 노출한다. 단계 5는 인프라 보강(`04 §2`)의 outbox SKIP LOCKED + idempotency_key — replica N개 환경에서 중복 발행 0을 보장한다. 단계 6은 인프라 보강(`04 §3`)의 bitmap TTL + version-check 3단계 — Redis pub/sub 메시지 유실 시에도 정합성을 회복한다.

**Tech Stack:** TypeScript ES2023, tsup ESM+CJS dual, pnpm workspace, vitest, Drizzle ORM (catalog), PostgreSQL 16 (`FOR UPDATE SKIP LOCKED`), Redis 7 (pub/sub + LRU 캐시), Plan A의 sim-identifier-grammar.

**Spec 인용 위치:** `docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md` §2, §5 + `04-scaling-infra.md` §2, §3.

---

## File Structure (전체 인덱스)

상세 File Structure 표는 각 단계 절(### 단계 3 / 단계 5 / 단계 6)에 인라인으로 들어 있다. 본 인덱스는 어떤 패키지·서비스가 변경되는지 한눈에 보여준다.

| 단계 | 신규 패키지/파일 | 주요 변경 |
|---|---|---|
| 3 | `packages/sim-service-catalog/` (신규) + `simulations/enterprise-pm/contracts/service-version.catalog.ts` (신규) + `scripts/sim-build.sh` 통합 + `scripts/validate-catalog.ts` (신규) | catalog version axis 등록, 빌드 파이프라인이 catalog 입력 사용 |
| 5 | `sim.outbox_consumer_log` 테이블 마이그레이션 + outbox dispatcher 코드 | `FOR UPDATE SKIP LOCKED` + idempotency_key 첨부 + DLQ 격리 |
| 6 | `sim-bitmap-cache` 패키지 코드 변경 + `/metrics` counter | TTL + version-check 3단계 + pub/sub 격하 |

---

## 단계 인덱스

| 단계 | 파일 | 줄수 |
|---|---|---|
| 3 | [sim-service-catalog 패키지](./B-stage-3-sim-service-catalog.md) |      976 |
| 5 | [outbox SKIP LOCKED + idempotency](./B-stage-5-outbox-lock.md) |      718 |
| 6 | [bitmap TTL + version-check](./B-stage-6-bitmap-cache.md) |      612 |

---

## Self-Review Checklist

Plan B 작성 후 작성자가 직접 점검한다.

**1. Spec coverage**
- [ ] `02-canary-topology.md` §2.1, §2.2, §2.3, §5의 모든 산출물이 단계 3 task에 매핑되었는가?
- [ ] `04-scaling-infra.md` §2.1 ~ §2.4의 SQL/TS 코드가 단계 5 task에 인용되었는가?
- [ ] `04-scaling-infra.md` §3.1 ~ §3.5의 BitmapCacheEntry, getBitmap, pub/sub evict, /metrics counter가 단계 6 task에 매핑되었는가?

**2. Placeholder 스캔**
- [ ] "TBD/TODO/implement later" 등 부재 (`grep -n "TBD\|TODO\|FIXME" docs/superpowers/plans/2026-04-28-canary-scaling/B-core-mechanics.md`)

**3. Type 일관성**
- [ ] Plan A의 grammar `buildIdempotencyKey`(#12), `buildBitmapCacheKey`(#11), `buildServicePrefix`(#1), `buildVersionTag`(#2)가 Plan B에서 import되어 raw 보간 0건인가?
- [ ] sim-service-catalog API 함수명(`getServiceVersionTag`, `transitionState`, `getCurrentTopology`)이 Plan B 안에서 동일하게 사용되는가?

**4. 명령 실행 가능성**
- [ ] 모든 `pnpm --filter ...` 명령이 실제 패키지명을 사용하는가?
- [ ] 모든 SQL이 PostgreSQL 16에서 동작하는 표준 문법인가?

---

## Definition of Done (단계 3·5·6 통합 완료 정의)

- [ ] `pnpm --filter sim-service-catalog test` PASS
- [ ] `pnpm sim:catalog:validate` 4-way 정합성 PASS (catalog ↔ docker-compose image ↔ .env.sim ↔ 실제 file 존재)
- [ ] outbox dispatcher 단위 테스트 PASS — 락 경합 시 처리 row 집합 disjoint, 중복 발행 0건
- [ ] retry_count > 5 → DLQ 격리 동작 (단위 테스트로 검증)
- [ ] bitmap cache 단위 테스트 PASS — pub/sub drop + version bump 시점에 fallthrough → refresh 회복
- [ ] `bitmap_cache_lookup_total{result="hit|miss|version_mismatch"}` counter `/metrics`에 노출
- [ ] 기존 시나리오 1~8 무회귀

---

## 다음 Plan과의 관계

- **Plan C (단계 7·8)**: 본 plan의 sim-service-catalog로 빌드 파이프라인이 catalog version을 입력으로 사용한다 (`scripts/sim-build.sh` 통합 결과). 본 plan의 idempotency_key는 approval-api v1/v2 양쪽에서 outbox publish 시 사용된다.
- **Plan D (단계 9)**: controller가 본 plan의 catalog `transitionState` 호출로 카나리 승격을 트리거한다. controller가 `getCurrentTopology(prefix)`로 현재 v1/v2 상태를 sync한다.
- **Plan E (단계 11)**: 시나리오 #15 (`outbox-multi-dispatcher-lock`)이 본 plan의 단계 5 결과를 직접 검증한다. 시나리오 #16 (`bitmap-cache-version-fallback`)이 본 plan의 단계 6 결과를 검증한다.
