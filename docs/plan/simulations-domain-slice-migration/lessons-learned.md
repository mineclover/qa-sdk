# Lessons Learned — simulations/enterprise-pm Domain Slice 마이그레이션

> Phase 0~3 마이그레이션 + 후속 작업(A1~E16, F1, D13/D14, B7/B9, C10/C11/C12) 종료 시점의 회고. process gap, 적용된 개선, 잔여 backlog 를 한 곳에 누적한다.

상위 plan: [`README.md`](./README.md). 페어 skill: [`docs/skills/sub-agent-verify-discipline.md`](../../skills/sub-agent-verify-discipline.md).

## 1. Outcome

24 슬라이스(`assignment` + 23) 마이그레이션 + 7 서비스(pm/approval/auth/document/notification/reporting/audit-browser-api) cleanup + scenarios + CI gate 합류 완료. branch `main`, working tree clean. 30+ commits 분량. 5계층 토폴로지(`service / read-model / bff / command-only / read-mostly`) 가 validator 의 first-class 인식 대상이 됨.

## 2. Process Gap (가장 중요)

### 2.1 false-claim 패턴 — Phase 1/2/3 모두 동일

| Phase | sub-agent 가 보고한 것 | 실제 실행된 것 | 결과 |
|---|---|---|---|
| Phase 1 | "validator extension 통과 / build OK" | rule 추가가 코드에 미반영 | rule 재추가 + 재검증 |
| Phase 2 | "build / test 통과" — 7 서비스 모두 | vitest(esbuild loose) 만 실행, `tsc` 미실행 | 7 서비스 build 동시에 깨진 채 cleanup 단계 진입, 평균 30~40분/슬라이스 추가 소요 |
| Phase 3 | "manifest extension 통과" | extension 미반영 | 동일 패턴 재발 |

### 2.2 원인

- sub-agent 자가 보고("통과", "ok", "passed")를 **검증 명령 stdout 원문 없이** 신뢰함.
- vitest(esbuild loader)의 통과는 `tsc --strict` 통과를 보장하지 않음 — silent 회귀.
- 상위 에이전트가 phase advance 전 spot-check 1-2 개를 직접 재실행하지 않음.

### 2.3 영향

cumulative 6+ 시간 분의 cleanup 작업. 7 서비스 동시 회귀로 root-cause 격리 비용도 함께 상승.

## 3. 적용된 개선 — Technical

| ID | 작업 | 효과 |
|---|---|---|
| F1 | validator port 검사 substring → AST 기반 (commit `155e448e`) | substring 매칭의 false negative/positive 차단 |
| F2 | validator 의 다른 substring rule 들도 AST 강화 (이번 작업) | 동일 회귀 패턴 차단 |
| B7/B9 | 5 슬라이스 토폴로지(`service` / `read-model` / `bff` / `command-only` / `read-mostly`) validator first-class 인식 + 24 슬라이스에 `topology` metadata 필드 추가 (commits `60f19529`, `7ed87cc9`, `68c93f12`) | reporting-api / audit-browser-api / authenticate / bitmap 슬라이스가 admin-port 패턴 흉내내지 않고 정직하게 표현 |
| E15/E16 | outbox alias re-export 16 줄 dedup (commit `37de1ec2`) | svc schema 직접 import → drift 단일화 |
| B6 | bitmap 슬라이스 `process.env` → `forRoot` config (commit `e47282e0`) | 라이브러리 컨벤션 (생성자 주입) 정합성 회복 |
| A2 | dead `factory.ts` / `shared/` 정리 (auth-api, notification-api) (commit `71e6244c`) | Phase 1 reference pattern 의 잔여 코드 제거 |
| C10/C11 | `SubscriptionUserQueryPort` production 어댑터 2종 (commit `9faa04a1`) | cross-domain query port 가 in-memory stub 만으로 머무르지 않도록 production 경로 확보 |
| — | scaffold `qa-scaffold` workspace bin 등록 + dist/cli.js 빌드 prerequisite 문서화 (commits `8f8ea2aa`, `aa0d9a71`) | validator CLI 표면 안정화 |

## 4. 적용된 개선 — Process

| ID | 작업 |
|---|---|
| D13 | [`docs/skills/sub-agent-verify-discipline.md`](../../skills/sub-agent-verify-discipline.md) — 5 룰(verify-before-complete, tsc 강제, working-tree 가시성, failure-first, caller spot-check) + sub-agent prompt 템플릿 + caller checklist. plan README 에 link 등록 |
| — | topic-commit-organizer 패턴 — 30+ commits 를 topic 단위(F1/F2/B6/B7/B9/E15/A2/C10) 로 정리하여 회귀 시 bisect 단위 명확화 |
| — | batch dispatch 전략 — Phase 2 를 4개 batch(A 단순 CRUD, B access-control, C auth core, D read-model/BFF) 로 분리. batch 내부는 완전 병렬, batch 간 직렬. agent stall 빈도 감소 |
| D14 | `simulations` 는 production taxonomy 면제로 결정 — production 코드 컨벤션 강제 대상 아님. 시뮬레이션 격리 유지 |

## 5. 잔여 Backlog

| 항목 | 상태 | 메모 |
|---|---|---|
| C12 미proxy slice routes | 일부 G1 처리, 나머지 design 미정 | 사용자 결정 대기. BFF prefix 통합 라우팅 옵션 A(gateway 단일 prefix → 슬라이스 내부 라우팅) 적용분만 G1 으로 합류 |
| BFF prefix 통합 라우팅 | G1 옵션 A 적용 (commit `bde538cd` 의 governance 문서화) | 추가 슬라이스 적용 시 동일 패턴 |
| gateway path-param 라우팅 (`/users/:userId/*`) 충돌 해소 | G1 처리 결과 보고 필요 | gateway middleware 라우팅 우선순위 점검 미실행 |
| reporting-api 의 admin-port 패턴 흔적 | B9 의 `read-model` 위상 표시로 정직한 표현은 가능 | 추가 정리 시 admin-port 어댑터 통합 검토 |
| spec-core 의 `dkg-sqlite-store` 삭제 영향 | working tree merge 시 deleted | 다른 의존자 점검 필요 (ingest / registry / dkg-audit skill 경유) |
| F2 외 validator AST rule 잔여 substring | 이번 작업으로 일부 강화 | 잔여 rule 식별 후 재가동 (semantic-change skill 경유) |

## 6. 메트릭 (참고)

| 항목 | 수치 |
|---|---|
| Migration commits | 30+ (Phase 0~3 + 후속) |
| 변경 파일 (cumulative) | ~700 |
| 슬라이스 | 24 (assignment + 23) |
| 테스트 | 700+ passed across 7 services + scenarios |
| false-claim 발견 빈도 | Phase 2 sub-agent 7/7 (서비스 단위) |
| 후속 cleanup 추가 시간 | 6+ 시간 (예측 대비) |

## 7. 재발 방지 — Caller 행동 강제

상위 에이전트는 다음 4 항목을 phase advance 전 **직접** 수행한다 (sub-agent 보고만으로 진입 금지).

1. sub-agent 보고에 stdout 원문 + exit code + `git status --short` 가 있는지 확인. 없으면 재요청.
2. 보고된 검증 명령 중 1-2 개를 caller 가 직접 재실행해 일치 확인.
3. `pnpm --filter <pkg> build` 와 `pnpm --filter <pkg> test` 가 별도로 실행되었는지 확인 (vitest 만 통과 ≠ tsc 통과).
4. validator / manifest extension 같은 메타 작업은 `git diff` 라인 수까지 보고에 포함시킬 것.

근거 문서:
- [`docs/skills/sub-agent-verify-discipline.md`](../../skills/sub-agent-verify-discipline.md)
- [`docs/specs/system/layer-separation.rule.md`](../../specs/system/layer-separation.rule.md) — Workflow Smoke 원칙
- superpowers `verification-before-completion` skill — evidence before assertions

## 8. 후속 작업 진입점

| 후속 ID | 영역 | 진입 문서 |
|---|---|---|
| F1 | validator port AST | commit `155e448e`, `packages/architecture-schematics/src/cli.ts` |
| F2 | validator 추가 AST rule | 이번 작업 (이 문서 §3) |
| G1 | BFF prefix 라우팅 / gateway path-param 충돌 | commit `bde538cd` 의 governance 문서 |
| D13 | sub-agent verify discipline | [`docs/skills/sub-agent-verify-discipline.md`](../../skills/sub-agent-verify-discipline.md) |
| D14 | simulations production taxonomy 면제 결정 | 본 문서 §4 (의사결정 근거) |
| B7/B9 | 5 슬라이스 토폴로지 | commits `60f19529`, `7ed87cc9`, `68c93f12` |
| C10/C11 | SubscriptionUserQueryPort production adapter | commit `9faa04a1` |
| C12 | 미proxy slice routes | 사용자 결정 대기 |
