# Plan C — Canary delivery (단계 7·8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카나리 트래픽 분할의 단일 책임 지점인 gateway를 구현하고, 카나리 대상 서비스인 approval-api를 v1/v2 동시 배포 가능 형태로 분리하며, BFF/reporting을 read replica로 라우팅한다.

**Architecture:** 본 plan은 spec set의 단계 7·8을 구현한다. 단계 7은 카나리 토폴로지(`02 §3`)의 gateway 변경 — RoutingTable 메모리 store, sticky-by-user 결정, escape hatch, version stamp, controller 푸시용 `/admin/routing` API. 단계 8은 카나리 토폴로지(`02 §1·§4`) + 인프라 보강(`04 §4.2·§4.3`)의 approval-api 변경 — v1/v2 빌드 산출물 분리, version stamp/schemaHash 첨부, BFF/reporting의 READ_DATA_SOURCE 마이그레이션, ESLint 룰로 write/read 라우팅 강제.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify (approval-api), Hono (gateway), Drizzle ORM, ESLint custom rule, Plan A·B의 grammar/catalog/createDualConnection.

**Spec 인용 위치:** `docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md` §1·§3·§4 + `04-scaling-infra.md` §4.2·§4.3.

---

## File Structure (전체 인덱스)

| 단계 | 변경 영역 | 주요 변경 |
|---|---|---|
| 7 | `simulations/enterprise-pm/services/gateway/src/` | RoutingTable + sticky + escape hatch + version stamp + `/admin/routing` |
| 8 | `simulations/enterprise-pm/services/approval-api/` + docker-compose + BFF/reporting slice | v1/v2 빌드 분리, schemaHash 첨부, READ_DATA_SOURCE 마이그레이션, ESLint 룰 |

상세 File Structure 표는 각 단계 절에 인라인.

---

## 단계 인덱스

| 단계 | 파일 | 줄수 |
|---|---|---|
| 7 | [gateway routing/sticky/version-stamp](./C-stage-7-gateway.md) |      897 |
| 8 | [approval-api v1/v2 + DataSource 분리](./C-stage-8-approval-api-v1v2.md) |      949 |

---

## Self-Review Checklist

**1. Spec coverage**
- [ ] `02-canary-topology.md` §3.1~§3.4의 라우팅 흐름·테이블·sticky·escape hatch가 단계 7 task에 모두 매핑되었는가?
- [ ] `02-canary-topology.md` §1의 docker-compose v1/v2 entry가 단계 8 task에 매핑되었는가?
- [ ] `02-canary-topology.md` §4.1~§4.3의 version stamp·schemaHash·v2 의도적 차이 fixture가 단계 8 task에 매핑되었는가?
- [ ] `04-scaling-infra.md` §4.3의 BFF/reporting 라우팅이 단계 8 task에 매핑되었는가?

**2. Placeholder 스캔**
- [ ] 부재 (`grep -n "TBD\|TODO\|FIXME" docs/superpowers/plans/2026-04-28-canary-scaling/C-canary-delivery.md`)

**3. Type 일관성**
- [ ] Plan A grammar `buildHttpHeader`(#4), `buildVersionTag`(#2), `buildSchemaHash`(#6), `buildImageTag`(#3)가 Plan C에서 import되어 raw 보간 0건인가?
- [ ] Plan A `createDualConnection` (Task 4.3)이 BFF/reporting에서 사용되는가?
- [ ] Plan B `getServiceVersionTag` (Task 3.2)가 빌드 스크립트에서 사용되는가?
- [ ] gateway의 RoutingTable 인터페이스 필드(`revision`, `stable`, `candidate`, `weight`, `stickyKey`)가 Plan C 안에서 일관된가?

**4. 명령 실행 가능성**
- [ ] approval-api Dockerfile이 build-arg `SERVICE_VERSION`을 받는가?
- [ ] docker-compose의 sim-approval-api-v1/v2 service entry가 정상 파싱되는가?

---

## Definition of Done (단계 7·8 통합 완료 정의)

- [ ] gateway 단위 테스트 PASS — sticky 결정, escape hatch, version stamp, `/admin/routing` revision check
- [ ] gateway 부팅 후 controller 미가동 상태에서도 v1=stable / weight=0으로 fallback 동작
- [ ] approval-api v1·v2 두 이미지가 다른 SIM_SERVICE_VERSION으로 빌드 산출됨
- [ ] 응답 헤더 + outbox event payload + audit entry에 `serviceVersion` stamp 일관성 (단위 테스트)
- [ ] outbox event publish 시 schemaHash 결정성 (같은 shape 100회 → 같은 hash)
- [ ] BFF/reporting slice 모두 READ_DATA_SOURCE 사용 (ESLint custom rule PASS)
- [ ] v2 의도적 차이 fixture 3종(happy/schema-break/audit-anomaly)이 빌드 flag로 토글 가능
- [ ] sim:up 후 sticky 사용자별 일관성 수동 smoke OK (동일 user_id 100회 요청 → 모두 같은 버전)
- [ ] 기존 시나리오 1~8 무회귀

---

## 다음 Plan과의 관계

- **Plan D (단계 9)**: controller가 본 plan의 gateway `/admin/routing` POST API로 weight를 push한다. controller가 본 plan의 approval-api v2 schemaHash를 ingest로 검증한다 (compatibility 카테고리 verdict).
- **Plan E (단계 11)**: 시나리오 9 (`canary-happy-promote`), 10 (`canary-rollback-compatibility`), 11 (`canary-rollback-audit-spike`)이 본 plan의 v1/v2 분리 + version stamp + schemaHash + 의도적 차이 fixture를 직접 검증한다. 시나리오 14 (`read-replica-lag-fallback`)이 본 plan의 BFF read DataSource 라우팅을 검증한다.
