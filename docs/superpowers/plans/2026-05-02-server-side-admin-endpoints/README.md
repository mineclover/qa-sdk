# Server-side Admin Endpoints — Implementation Plan Set

> spec `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md`을 구현하기 위한 plan. **시나리오 9~17 e2e PASS prerequisite** 충족이 본 sub-project의 가치.

## Plan 인덱스

| Plan | Stage | 줄수 | 핵심 산출물 |
|---|---|---|---|
| [00-overview.md](./00-overview.md) | — | 200 | 전체 토폴로지 + 4 PR 시퀀스 + DoD |
| [A-stage-1a-shared-and-decisions.md](./A-stage-1a-shared-and-decisions.md) | 1a | 1099 | 신규 패키지 2 (sim-internal-network, sim-decision-view) + DecisionRingBuffer + decision query endpoints 3종 |
| [A-stage-1b-admin-and-fault.md](./A-stage-1b-admin-and-fault.md) | 1b | 1055 | alerts/audit/catalog query 3 + admin/fault (FaultKind 2종 확장) + admin/compose + admin/scale 3 + #21 routing payload 정합 |
| [B-stage-2-gateway.md](./B-stage-2-gateway.md) | 2 | 694 | gateway sticky-consistency endpoint + StickyDecisionTracker |
| [C-stage-3-auth-api.md](./C-stage-3-auth-api.md) | 3 | 720 | auth-api bitmap version endpoint 2종 + BitmapVersionService |
| [D-stage-4-approval-api.md](./D-stage-4-approval-api.md) | 4 | 933 | approval-api outbox admin endpoint 2종 + N-replica dispatch 시뮬 |

**총 plan 분량**: 4701줄.

## Stage → PR 매핑

| Stage | PR | 의존 | 병렬 가능 |
|---|---|---|---|
| 1a | PR-A1 | spec only | — |
| 1b | PR-A2 | Stage 1a (ring buffer + view DTO + InternalIpGuard) | 1a 완료 후 |
| 2 | PR-B | Stage 1a (sim-internal-network Hono middleware) | 1b·3·4와 병렬 |
| 3 | PR-C | Stage 1a (sim-internal-network NestJS Guard) | 1b·2·4와 병렬 |
| 4 | PR-D | Stage 1a (sim-internal-network NestJS Guard) | 1b·2·3와 병렬 |

**critical path**: 1a → 1b·2·3·4 (병렬)

## 핵심 결정 요약

| 영역 | 결정 | 출처 |
|---|---|---|
| 범위 | 4 영역 16 endpoint + #21 actor + FaultKind 2종 확장 (audit-recorder/catalog HTTP는 별도 sub-project) | spec §1 |
| 인증 | internal IP 검증 (외부 IP → 404 silent) — gateway escape hatch 패턴 재사용 | spec §3 |
| 응답 source | controller 자체 ring buffer (in-memory, 최근 N=100 cycles) | spec §5 |
| 응답 shape | view DTO 분리 — `packages/sim-decision-view/` SSOT, producer + consumer 공유 | spec §4 |
| 테스트 | 3 layer (unit + integration NestJS Test + contract sim-handles ↔ endpoint) | spec §10 |
| error | RFC 7807 표준 (`type`/`title`/`status`/`detail`/`instance`) | spec §11 |

## Definition of Done

- [ ] PR-A1 · PR-A2 · PR-B · PR-C · PR-D 모두 main 머지
- [ ] 각 PR의 unit + integration + contract test PASS
- [ ] sim:smoke:full Stage 5 (sim-handles ↔ endpoint contract) 추가 — 모든 contract 통과
- [ ] (사용자 환경) 시나리오 9~17 e2e PASS → enterprise-pm canary cycle DoD #2 OK 전환
- [ ] follow-up sub-projects 등록: audit-recorder operator-actions endpoint, catalog HTTP endpoint, 운영급 admin 인증

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-02 | 초기 작성 — 5 stage plan + overview + README = 7 review 단위 |
