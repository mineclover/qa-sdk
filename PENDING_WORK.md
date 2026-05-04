# Pending Work — 2026-05-04

PR #9/#10 충돌 해결 + dirty tree 복구 후 정리. Origin/main 현재 HEAD: `82c5498f`.

## 1. PRD US-006 갱신 + US-007~012 진행 [Task #79]

**상태**: 코드는 main에 있으나 PRD JSON 미반영.

- `tasks/prd-rlsc-screen-analysis-perspective-packages.json`
- US-006 (Perspective Package Skeleton): commit `76072d64`로 main에 있음, JSON `passes: false` 그대로
- US-007 (Move Perspective Viewer Implementation) 부터 작업 가능
- US-008 ~ US-012 미진행

**조치**: US-006 `passes: true`/`completionNotes` 갱신 후 US-007 진입.

## 2. Lint debt sweep PR 정리 [Task #80]

**상태**: 5 commits 누적 (브랜치 `fix/ci-lint-error-sweep`, 워크트리 `.worktrees/lint-sweep`), push/머지 안됨.

| Commit | 내용 |
|---|---|
| `47882af3` | core 타입 어노테이션 보정 (array→Set auto-fix 후속) |
| `76977bc0` | unicorn 8 errors (length-check, spread, thenable) |
| `b03ab0cf` | vi.mocked() → typed cast (8 errors) |
| `79f7507d` | jest test rules per-file pattern (15 errors) |
| `60bcf8ae` | oxlint auto-fixes (33 errors, 214 warnings) |

**조치**: 변경 검토 후 main에 직접 push (PR #9 패턴). 또는 격리 PR 신설.

## 3. GET /admin/outbox/dispatch?ids=... 라이브 검증 [Task #81]

**상태**: code merged (`80971384`), 미테스트.

- sim-base 재빌드 완료
- sim-approval-api-v1/v2 재시작 미실행
- scenario 15 e2e 차단됨

**조치**:
```bash
docker compose -f simulations/enterprise-pm/docker-compose.sim.yaml --env-file simulations/enterprise-pm/.env.sim up -d --build sim-approval-api-v1 sim-approval-api-v2
# insert 5 events
curl -X POST -H "X-Forwarded-For: 10.0.0.1" -H "Content-Type: application/json" --data '{"events":[...5...]}' http://localhost:4600/admin/outbox/insert
# query state
curl -X GET -H "X-Forwarded-For: 10.0.0.1" "http://localhost:4600/admin/outbox/dispatch?ids=id1,id2,id3,id4,id5"
# scenario 15
SIM_SCENARIO_INPROC=1 ... pnpm --filter @qa-sdk/sim-scenarios start run scenario-15-outbox-multi-dispatcher-lock --mode in-process
```

## 4. 시나리오 9~17 sim-handles drift [Task #82]

**상태**: PR #7/#80971384 후 잔여. 각 sim-handle 응답 shape 정합 필요.

- catalog-store: `{v3, v4}` 기대 vs 실제 `{stable, candidate, retired}` shape
- 각 시나리오 setup() 단계에서 handle 호출 정합 깨짐

**조치**: catalog-store handle 재설계 (numeric value → version tag mapping endpoint 추가 또는 handle transform)

## 5. 시나리오 1~8 HTTP mode 디자인 [Task #83]

**상태**: 미시작.

- 각 시나리오가 `globalThis.__simHandle` 의존 (auth-api in-process Nest Test 전용)
- HTTP mode 미지원 (cli `--mode http` 옵션 있으나 시나리오 코드는 in-process 전제)

**조치**: HTTP wrapper bootstrap 디자인 — 시나리오 9~17 wireSimHandles 패턴 참고.

## 6. 로컬 브랜치/워크트리 정리 [Task #84]

**머지된 로컬 브랜치 (정리 가능)**:
- `temp/pnpm-fix-clean` — 직접 push의 임시 브랜치
- `feat/rlsc-perspective-package` — 직접 push (`82c5498f`)
- `fix/sim-e2e-audit-recorder` — PR #6 머지
- `fix/sim-validate-catalog-env-default` — PR #5 머지
- `feat/sim-audit-recorder-endpoint` — PR #7 머지
- `fix/sim-approval-api-error-logging` — PR #8 머지
- `feat/sim-approval-outbox-dispatch-get` — 직접 push
- `fix/ci-pnpm-action-duplicate-version` — PR #9 closed (cherry-pick 대체)
- `fix/ci-sim-domain-slice-gate-scaffold-prebuild` — PR #10 closed (cherry-pick 대체)

**워크트리**:
- `.worktrees/sim-admin-endpoints` — 작업 완료, 정리 가능
- `.worktrees/lint-sweep` — Task #80 처리 후 정리
- `.worktrees/sim-canary-stage-1` — 옛 작업, 검토 후 정리

## 7. Docker 컨테이너 health [Task #85]

**Unhealthy 컨테이너 2건**:
- `infra-engine-qa-sdk-db-replica-1` — 2시간 unhealthy. replication 검증 차단
- `enterprise-pm-qa-sdk-ingest-1` — 15시간 unhealthy. ingest 흐름 차단

**Healthy**:
- `infra-engine-qa-sdk-db-1` ✅
- `sim-redis` ✅
- `sim-canary-controller` ✅
- 나머지 11 sim 서비스 — Up but no healthcheck or healthy

**조치**: 각 unhealthy 로그 분석 + 의존 서비스 영향 평가.

## 참조

- 이전 사이클 PR 목록: #2 (admin endpoints) / #3 (build hygiene) / #4 (plan literal cleanup) / #5 (validate-catalog + sim-base Dockerfile) / #6 (e2e audit-recorder) / #7 (POST /v1/decisions) / #8 (drizzle 1.0 + logger + insertedAtMs)
- PR #9/#10 dirty tree 사고: PR #9 sub-agent가 main repo 격리 안 한 채 작업 → 100 파일 풀리퀘스트. cherry-pick으로 직접 push 처리.
