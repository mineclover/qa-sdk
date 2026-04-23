# Auth Model Backlog — Follow-up TODO

2026-04-22 · Phase 1~4 + 보강 + Phase 3 RLS 완료 후 남은 작업.

설계·핵심 구현은 production-ready 수준. 본 todo는 통합 검증·운영 보강·spec extension에 해당하는 후속 작업.

---

## P0 — 분산 통합 검증 (사용자 환경 필수)

### TODO-001 — 실 docker compose smoke 실행

**상태**: Plan 14b의 `smoke.sh` 작성 완료, 샌드박스 docker 미존재로 실행 못함

**할 일**:
```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm sim:smoke         # docker compose up + 9 health poll + scenarios run --all + density
# 또는
pnpm sim:smoke:keep    # 컨테이너 유지하고 수동 디버깅
```

**검증 항목**:
- [ ] qa-sdk-db (5434) + sim-redis (6379) + 9 sim 서비스 모두 healthy
- [ ] 8 시나리오 전체 PASS (in-process가 아닌 실 HTTP)
- [ ] gateway → 비즈니스 API → auth-api JWT 검증 chain 실 동작
- [ ] OTEL traceparent 모든 서비스 span 연결
- [ ] audit-recorder PG에 entries 영속
- [ ] scenarios CLI `density` 명령으로 prefix별 axes 측정 결과 수집

**진입점**: `simulations/enterprise-pm/scripts/smoke.sh`

**리스크**: `qa-sdk/sim-base:latest` 이미지 미존재 (Plan 09c defer). docker build 우선.

---

### TODO-002 — Redis pub/sub invalidation 실 통합 검증

**상태**: Plan 12b가 BitmapInvalidationPublisher/Subscriber 구현, in-process에서는 mock

**할 일**: 실 Redis 부팅 후 admin이 role 변경 → 다른 서비스 LRU cache flush 실증

**검증 항목**:
- [ ] auth-api에서 RoleAssignment.assign/revoke 시 publish 발생
- [ ] 다른 서비스의 BitmapInvalidationSubscriber가 메시지 수신
- [ ] LRU cache의 `userId:prefix:version` entry 실제 evict
- [ ] 후속 API 호출 시 fresh bitmap fetch 발생

**진입점**: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/integration.test.ts`의 실 Redis 모드

---

## P1 — 시나리오 정합성 강화

### TODO-003 — scenario 4 denyReason 의도 vs 실제 정렬

**상태**: scenario 4가 PASS하지만 expected `not_in_scope` (Pass 2 RLS-style scoping) → 실제 `not_owner` 또는 `bitmap_bit_not_set`로 완화

**할 일**: BudgetAccessService의 deny 분기를 명확히 정리:
- bob이 alice 부서 budget 승인 시도 → 어느 단계에서 어떤 denyReason으로 거절되어야 하는가?
- Pass 1 (bitmap)에서 거절 시 deny path 끝 — Pass 2 도달 안 함
- Pass 1 통과 + Pass 2에서 cross-dept 검증해 deny → `cross_department_requires_approver_role` 명확

**진입점**:
- `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget-access.service.ts`
- `simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.ts`

**검증**: scenario 4 assert를 실제 의도된 denyReason 1개로 좁히기

---

### TODO-004 — DELEGATED authorization-graph 본격 구현

**상태**: scenario 6 PASS. 현재는 sim이 `AuthorizationGraphStore` contract 위에 `InMemoryAuthorizationGraphStore` adapter를 얹어 delegated snapshot을 저장한다. 운영용 persistent graph store adapter는 후속.

**할 일**:
- persistent `AuthorizationGraphStore` adapter 추가
- DELEGATED 리소스의 graphRootId → delegatee 탐색을 snapshot graph traversal로 승격
- `evaluator.evaluateDelegated`가 sim wrapper가 아닌 공용 graph query surface로 동작
- scenario 6에서 frank(컨설턴트)가 alice 프로젝트 접근 시 graph 조회 검증

**진입점**: `packages/permission-engine/src/access-checker/checker.ts`의 DELEGATED branch
**스펙**: `docs/specs/authorization-ontology/authorization-ontology-resource-lifecycle.spec.md` §DELEGATED

---

## P2 — Phase 5 spec extension

### TODO-005 — registry-service marginal-density API 추가

**상태**: Plan 14a defer. sim-reporting-api의 `/density`만 구현됨.

**할 일**: `packages/registry-service`에 `/api/event-catalog/taxonomy/marginal-density` endpoint 추가

**스펙**: `docs/specs/event-vocab-system/event-taxonomy-marginal-density.plan.md`

**검증**:
- [ ] 모든 catalog의 prefix·version별 marginal density 조회 가능
- [ ] sim-reporting-api와 cross-check (동일 결과)
- [ ] CI gate에 underutilized < 0.1, saturated > 0.9 threshold 적용 가능

---

### TODO-006 — Phase 1 §1 audit-recorder Phase 3/4 (retention + UI)

**상태**: Plan 01에서 명시 defer ("retention 배치, monitor-web trace explorer는 시뮬 데이터 확보 후 별도 plan")

**할 일**:
- `audit-recorder-store`에 retention archiver (hot 30d / warm 90d execution only / cold 1y)
- `authorization-monitor-web` 패키지 또는 audit-browser-api 확장으로 trace explorer UI
- deny 원인 자동 하이라이트
- privacy scrubbing 훅 (target_id PII)

**트리거**: 시뮬 트래픽이 운영 수준 이상 누적된 시점

---

## P3 — 코드 hygiene

### TODO-007 — pre-existing 회귀 정리

**할 일**:
- `packages/cli/src/commands/docs-source-map-coverage.test.ts` 3건 fail → 최신 spec 기반으로 수정
- `viz-core` typecheck error (`ContractRef.type` 누락) → spec과 정합 맞추기
- 본 backlog 작업 외 이슈, 별도 plan으로 처리 가능

---

### TODO-008 — commit boundary leak 방지

**상태**: 04~05 시리즈에서 다른 agent의 staged 변경이 commit에 휩쓸려 들어감 (3+ 사례)

**할 일**: agent dispatch 시 작업 디렉토리 격리 또는 작업 전 `git status` 확인 + clean working tree 강제

**진입점**: 향후 dispatch prompt에 "git status 후 unstaged 변경 있으면 stop" 명시

---

### TODO-009 — Plan-writing 시 의존 검증 강화

**상태**: Plan 13이 Plan 11/12 미구현 인프라 전제로 작성됨 → 6 보강 plan 추가 필요

**할 일**: Plan 작성 시 다음 사전 점검 단계 추가:
- 호출하는 endpoint·module·export가 의존 plan에 명시됐는지
- 의존 plan의 실제 출력물(파일 + class + signature)이 본 plan 가정과 일치하는지
- 없으면 의존 plan 보강 plan을 먼저 작성

**진입점**: `writing-plans` skill 또는 brainstorming skill에 "dependency validation" 단계 추가 검토

---

## P4 — 운영 보강 (시뮬 데이터 누적 후)

### TODO-010 — 부하 시나리오 (Phase 4 brainstorm Q6 옵션 D)

**상태**: 디자인 §6에서 명시 defer

**할 일**: 100+ user 동시 액션 시뮬 → marginal density 정밀 측정 + bitmap pipeline 부하 검증

**진입점**: `simulations/enterprise-pm/scenarios/src/scenarios/load-*.ts` 신규

---

### TODO-011 — 외부 협업자 ACL 시나리오 (Q2 옵션 D)

**상태**: brainstorm에서 defer ("ACL은 §3 RLS 후속 단계")

**할 일**: contractor/vendor가 일부 project에 read-only 접근 — DELEGATED + ACL 패턴

**의존**: TODO-004 (DELEGATED graph 본격 구현)

---

## P5 — 문서·관리

### TODO-012 — backlog README의 진행 매트릭스 갱신

**상태**: Plan 14b가 일부 갱신했지만 본 todo 추가 후 재반영 필요

**할 일**: `docs/proposals/auth-model-implementation-backlog/README.md`에:
- 6 Phase 모두 완료 표시
- 후속 todo 링크 추가
- 다음 세션 인수인계 갱신

---

## 우선순위 요약

| 우선순위 | 항목 | 트리거 |
|---|---|---|
| P0 | TODO-001 docker smoke | 즉시 (사용자 환경) |
| P0 | TODO-002 Redis 통합 | TODO-001 후 |
| P1 | TODO-003 scenario 4 정렬 | scenario 깊이 강화 필요 시 |
| P1 | TODO-004 graph 본격 | DELEGATED 사용 사례 발생 시 |
| P2 | TODO-005 registry density API | Phase 5 진입 시 |
| P2 | TODO-006 audit Phase 3/4 (retention/UI) | 운영 데이터 누적 후 |
| P3 | TODO-007 pre-existing 정리 | 별도 hygiene 세션 |
| P3 | TODO-008 commit boundary leak | 다음 agent 작업 전 |
| P3 | TODO-009 plan-writing 강화 | meta-skill 개선 시 |
| P4 | TODO-010 부하 시나리오 | 운영 측정 필요 시 |
| P4 | TODO-011 외부 협업자 ACL | 비즈니스 요구 시 |
| P5 | TODO-012 README 갱신 | 다음 세션 시작 시 |

---

## 즉시 다음 단계 (사용자 권장)

```bash
# 1. Docker 환경 확인 + sim-base 이미지 빌드
docker --version
cd /Users/junwoobang/workflow/qa-sdk

# 2. 인프라 + 시뮬 통합 부팅
pnpm sim:smoke

# 3. 실패 시 로그 확인
docker compose -f simulations/enterprise-pm/docker-compose.sim.yaml logs

# 4. 결과 보고 → TODO-001 체크리스트 업데이트
```

본 todo 진행 후 체크박스 업데이트 + 새 발견 항목 append. backlog README와 동기 유지.
