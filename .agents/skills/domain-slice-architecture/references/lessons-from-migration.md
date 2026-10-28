# Lessons from simulations/enterprise-pm Migration (2026-04-27)

> 24 슬라이스 마이그레이션 + 7 서비스 cleanup + scenarios + CI gate 합류 작업의 핵심 발견. 본 skill 의 컨벤션이 실제로 어떤 회귀를 막았는지 정량 근거. 상세 회고는 `docs/plan/simulations-domain-slice-migration/lessons-learned.md`.

## 1. False-Claim 패턴 (가장 중요)

Phase 1 / 2 / 3 모두에서 sub-agent 가 "통과" 라고 보고했지만 실제로는 미반영 / 미실행 회귀가 발생.

| Phase | 보고 | 실제 | 영향 |
|---|---|---|---|
| Phase 1 | "validator extension 통과" | rule 코드 미반영 | 재추가 필요 |
| Phase 2 | "build / test 통과" (7 서비스) | vitest(esbuild) 만 실행, `tsc` 미실행 | 7 서비스 build 동시 회귀, slice당 +30~40분 |
| Phase 3 | "manifest extension 통과" | extension 미반영 | 동일 패턴 재발 |

**대응**: 짝 skill `sub-agent-verify-discipline` 의 5 룰 (verify-before-complete / TSC 강제 / working-tree 가시성 / failure-first / caller spot-check). slice 작업을 sub-agent 에 dispatch 할 때 prompt 템플릿 재사용.

## 2. Validator AST 화 (substring → AST)

substring 검사 (`file.content.includes(...)`) 는 false negative 위험:
- import 라인 1줄로 통과
- 주석 / 식별자 토큰만으로 통과

AST 검사 (commit `155e448e` F1, 이번 작업 F2) — `transaction-and-logging-are-ports`, `bff-does-not-expose-domain-entity`, `openapi-does-not-expose-domain-entity` 모두 AST:
- `ts.createSourceFile` → import declaration 의 named/default/namespace import 수집
- 본문에서 `ts.isTypeReferenceNode` 또는 식별자 참조로 등장하는지 확인
- `LoggerPort` 의 경우 `SLICE_LOGGER_PORT` inject 패턴도 정당하게 통과

`packages/architecture-schematics/src/validator.ts` 의 `analyzePortUsage`, `analyzeBffEntityExposure`, `analyzeOpenApiEntityExposure` 참조.

## 3. 5 위상 First-Class 인식 (B7/B9)

이전: validator 가 모든 슬라이스에 동일 룰 적용 → reporting / audit-browser / authenticate / bitmap 슬라이스가 admin-port 패턴을 흉내내야 했음 (정직하지 않음).

이후 (commits `60f19529`, `7ed87cc9`, `68c93f12`):
- `service` (17), `read-model` (3), `bff` (2), `command-only` (1), `read-mostly` (1) 위상이 first-class.
- `metadata/openmetadata.seed.json` top-level `topology` 필드가 SSOT.
- 위상별 룰이 분기 — `read-model` 슬라이스에 transaction port 강제하지 않음.

상세: `references/topology-taxonomy.md`.

## 4. Outbox Per-Service 공유 패턴 (E15/E16)

각 서비스가 단일 `<svc>_outbox_events` 테이블을 가지고, 슬라이스는 service-shared schema 의 outbox table 을 직접 import (alias re-export 16 줄 dedup, commit `37de1ec2`).

- 컬럼: snake_case (`aggregate_id`, `event_name`, `event_version`, `payload`, `occurred_at`, `scope_id`, `status`) — kit 컨벤션.
- kit `createDrizzleOutboxPort({ db, table })` 가 dialect agnostic 으로 drizzle table reference 를 받음.
- 슬라이스의 `infrastructure/outbox/<slice>.outbox.ts` 가 `sqlite/schema.js` + `pg/schema.js` 를 import 해 dialect 별 table 을 분기.

실증: `simulations/enterprise-pm/services/pm-api/src/pm/assignment/infrastructure/outbox/assignment.outbox.ts`.

## 5. Library Boundary — `process.env` 금지 (B6)

bitmap 슬라이스가 `bitmapEnvSchema.parse(process.env)` 직접 접근 → CLAUDE.md 위반.

대응 (commit `e47282e0`): `BitmapSliceModule.forRoot(config)` DynamicModule 패턴. 서비스 `config/env.ts` 가 zod 파싱 결과를 주입.

상세: `references/library-boundary.md`.

## 6. Cross-Domain Query Port (C10/C11)

notification-api 의 `SubscriptionUserQueryPort` 가 in-memory stub 만으로 머무르지 않도록 production 어댑터 2종 추가 (commit `9faa04a1`):

- `InProcessSubscriptionUserQuery` — 구조적 타이핑 (정적 import 회피)
- `HttpSubscriptionUserQuery` — `AbortSignal.timeout(5000)` + fail-open

상세: `references/cross-domain-ports.md`.

## 7. BFF Routing 컨벤션

BFF 정체성 = **디렉터리 위치 (`presentation/bff/`)**, path prefix 는 도메인 자율:
- 새 BFF: `/bff/<resource>/...` 권장
- 외부 호환 (audit-explorer, graph-explorer): `/audit/...` 영구 유지 (gateway proxy + OpenAPI fragment + 외부 grep 패턴 호환)

gateway 통합: 옵션 A (path 별 entry) — controller path 변경 없음. 상세: `simulations/enterprise-pm/docs/bff-convention.md`.

## 8. Registry 마커 — Slice 그룹핑 다중 형태

전통: `apps/api/src/modules/<domain>/<slice>` (architecture-samples).

시뮬레이션: `services/<svc>/src/<domain>/<slice>` — 부모에 `<domain>-slices.registry.ts` 마커가 있으면 정당한 그룹.

`density` 같은 top-level slice (`src/density/`) — 인접 `src/density-slices.registry.ts` 마커도 처리. validator `isDomainSliceProperlyGrouped` 가 양 형태 모두 허용.

## 9. OpenAPI Fragment Merge — Shape-Deep-Equal Dedup

`contracts/openapi/scripts/check-merge.mjs`:
- 동일 component 이름이 여러 도메인에 등장 시 deep-equal 비교
- 일치 → dedup (통과)
- 불일치 → conflict ERROR

예: `GraphSnapshotRecord` schema 가 audit-explorer + graph-explorer BFF 양쪽에서 동일 정의로 등장 → 통과.

## 10. 후속 Backlog

| 항목 | 상태 |
|---|---|
| C12 미proxy slice routes | 일부 G1 처리, 나머지 design 미정 |
| BFF prefix 통합 라우팅 | G1 옵션 A 적용 (commit `bde538cd` governance 문서화) |
| gateway path-param 라우팅 충돌 | G1 처리 결과 보고 필요 |
| reporting-api admin-port 패턴 흔적 | B9 위상 표시로 정직한 표현 가능. 추가 정리 검토 |
| F2 외 validator AST rule 잔여 substring | 일부 강화. 잔여 식별 후 재가동 |

## 11. 메트릭 (참고)

| 항목 | 수치 |
|---|---|
| Migration commits | 30+ |
| 변경 파일 | ~700 |
| 슬라이스 | 24 |
| 테스트 | 700+ passed across 7 services |
| false-claim 발견 빈도 | Phase 2 sub-agent 7/7 |
| 후속 cleanup 시간 | 6+ 시간 (예측 대비 추가) |

## 12. 참조 (commit hash 색인)

| ID | Commit | 영역 |
|---|---|---|
| F1 | `155e448e` | validator port AST |
| B6 | `e47282e0` | bitmap forRoot 전환 |
| B7 | `60f19529` | 5 위상 도입 (validator 부분) |
| B9 | `7ed87cc9`, `68c93f12` | 24 슬라이스에 topology 메타 |
| E15/E16 | `37de1ec2` | outbox alias re-export dedup |
| A2 | `71e6244c` | dead factory.ts / shared 정리 |
| C10/C11 | `9faa04a1` | SubscriptionUserQueryPort production adapter |
| G1 | `bde538cd` | BFF prefix 통합 라우팅 governance |
| 인프라 | `8f8ea2aa`, `aa0d9a71` | scaffold qa-scaffold workspace bin |

## 13. 진입 문서

- `docs/plan/simulations-domain-slice-migration/lessons-learned.md` — 본 reference 의 raw source
- `docs/plan/simulations-domain-slice-migration/README.md` — Phase 0~3 plan
- `docs/skills/sub-agent-verify-discipline.md` — 짝 skill (false-claim 차단)
- `simulations/enterprise-pm/docs/bff-convention.md` — BFF 위치/path 컨벤션
- `simulations/enterprise-pm/services/pm-api/src/pm/assignment/` — gold reference slice
