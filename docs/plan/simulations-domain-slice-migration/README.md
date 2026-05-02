# simulations/enterprise-pm Domain Slice 마이그레이션 — Frame

## 목적

`simulations/enterprise-pm` 의 22개 sub-domain을 `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/` 의 Domain Slice Architecture 컨벤션에 맞게 재구성한다. 작업을 팀 에이전트로 병렬 실행할 수 있는 frame 을 정의한다.

## 배경

- `simulations/enterprise-pm` 는 NestJS + Drizzle 기반 마이크로서비스 시뮬레이션이지만 `current/` 가 정의한 슬라이스 경계(`domain/application/infrastructure/presentation/metadata`), 책임 위상(`*.entity.ts`, `*.use-case.ts`, `*-transaction.port.ts` 등), command/query 분리, outbox/transaction port, OM seed 콜로케이션, 표준 logger/error 페이로드 중 어느 것도 따르지 않는다.
- 격차 상세는 직전 리뷰 결론(2026-04-27 대화)에 기록되어 있다.
- 단일 에이전트가 22개 슬라이스를 직렬 처리하면 캘린더 시간이 과하다. 병렬 실행으로 단축한다.

## 비-목표

- 시뮬레이션이 아닌 실제 서비스 컨벤션 변경
- `architecture-samples/domain-slice-monorepo` 자체 리팩터
- `current/` 문서 재작성 (문서가 SSOT, 코드를 맞춘다)

## 병렬화 모델 (옵션 D — 하이브리드)

```text
Phase 0  Foundation        직렬, 1 에이전트  공유 port/error/logger kit + 슬라이스 registry 패턴
Phase 1  Reference Slice   직렬, 1 에이전트  pm-api/assignment 를 gold standard 로 구현
Phase 2  Parallel Slices   병렬, N 에이전트  나머지 22 슬라이스, 각자 독립 디렉터리
Phase 3  Integration       직렬, 1 에이전트  manifest 갱신, OpenAPI merge, CI gate
```

직렬 phase 가 두 번 발생하는 이유:
- Phase 0: shared port interface 가 정해져야 Phase 1, 2 모두 같은 추상에 의존 가능.
- Phase 1: 실제로 동작하는 reference 슬라이스가 있어야 Phase 2 에이전트들이 "복제 후 변형" 패턴으로 안전하게 작업.
- Phase 3: 병렬 작업이 끝난 뒤 manifest/contracts/CI 를 한 번에 합산.

## 파일 소유권 규칙 (no-overlap)

Phase 2 의 각 에이전트는 정확히 한 슬라이스를 소유한다. 슬라이스 = `services/<svc>/src/<domain>/<slice>/`.

| 영역 | Phase 2 에이전트가 만지는가 |
|---|---|
| `services/<svc>/src/<domain>/<slice>/**` | ✅ 소유 (모두 쓰기 가능) |
| `contracts/openapi/src/domains/<slice>/spec.yaml` | ✅ 소유 |
| `services/<svc>/src/<domain>/<slice>/metadata/openmetadata.seed.json` | ✅ 소유 |
| `services/<svc>/drizzle/<dialect>/<slice>.sql` | ✅ 소유 (마이그레이션 추가만) |
| `services/<svc>/src/<domain>/<domain>-slices.registry.ts` | ❌ Phase 0 에서 미리 슬롯 채움 |
| `services/<svc>/src/<domain>/<svc>-db.module.ts` | ❌ Phase 0 또는 Phase 3 |
| `services/<svc>/src/<domain>/factory.ts`, `port-contract.test.ts`, `shared/*.ts` | ❌ Phase 1 에서 한 번 정리 |
| `simulations/enterprise-pm/packages/sim-domain-slice-kit/**` | ❌ Phase 0 에서만 작성 |
| `scenarios/src/architecture/architecture-manifest.ts` | ❌ Phase 3 |
| `contracts/openapi/src/openapi.yaml`, `profiles/local.yaml` | ❌ Phase 3 |

## 슬라이스 인벤토리 (22)

| Service | Slice | 마이그레이션 비고 |
|---|---|---|
| pm-api | **assignment** | Phase 1 reference slice (신규 생성) |
| pm-api | project | 기존 ProjectService → 슬라이스 변환, policy lifecycle 보존 |
| pm-api | task | 기존 TaskService → 슬라이스 변환 |
| pm-api | member | 기존 MemberService → 슬라이스 변환 |
| approval-api | budget | 기존 + access service 동반 |
| approval-api | expense | 기존 |
| approval-api | resource | 기존 |
| approval-api | timeoff | 기존 |
| auth-api | user | 기존 |
| auth-api | role | 기존 |
| auth-api | role-assignment | 기존 |
| auth-api | department | 기존 |
| auth-api | authenticate | command-only 슬라이스 (entity 없음) |
| auth-api | bitmap | 캐시/조회 슬라이스 |
| document-api | document | 기존 |
| document-api | comment | 기존 |
| document-api | version | 기존 |
| notification-api | notification | 기존 |
| notification-api | subscription | 기존 |
| reporting-api | report | 읽기 전용 — read model 슬라이스로 재포지셔닝 |
| reporting-api | metric | 읽기 전용 — read model 슬라이스 |
| reporting-api | density | 읽기 전용 — read model 슬라이스 |
| audit-browser-api | audit-explorer | BFF 슬라이스로 재포지셔닝 |
| audit-browser-api | graph-explorer | BFF 슬라이스로 재포지셔닝 |

총 23개 (assignment + 22). gateway, metrics-collector 는 도메인 슬라이스 대상 아님 (인프라 서비스).

## 단계별 진입 / 종료 조건

| Phase | 진입 조건 | 종료 조건 |
|---|---|---|
| 0 | — | `sim-domain-slice-kit` 패키지 빌드 통과, registry 슬롯 22개 + assignment stub 생성, `qa-scaffold catalog` 가 새 template 인식 |
| 1 | Phase 0 종료 | `pm-api/src/pm/assignment/` 슬라이스가 `qa-scaffold validate` 통과, 5계층 테스트 모두 통과, manifest test 가 가리키는 경로 실재 |
| 2 | Phase 1 종료 | 22개 슬라이스 각각이 `qa-scaffold validate <slice>` + 슬라이스 단위 vitest 통과 |
| 3 | Phase 2 종료 | architecture-manifest.test 가 fileExists 검증 포함 통과, OpenAPI merge gate 통과, def-gate 에 새 gate 등록 |

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| `phase-0-foundation.md` | 공유 kit, registry 패턴, 슬라이스 디렉터리 템플릿 |
| `phase-1-reference.md` | architecture-samples/assignment → pm-api/assignment 포트 작업 |
| `phase-2-parallel.md` | 22 슬라이스, slice spec sheet 템플릿, 에이전트 프롬프트 템플릿 |
| `phase-3-integration.md` | manifest, OpenAPI merge, CI gate, current/ 문서 갱신 |
| `lessons-learned.md` | Phase 0~3 + 후속 작업 회고 — process gap, 적용된 개선, 잔여 backlog, 메트릭 |

## 후속 작업 (Phase 3 종료 후)

Phase 3 종료 시점부터 누적된 follow-up 작업. 상세는 [`lessons-learned.md`](./lessons-learned.md) 참조.

| ID | 영역 | 상태 | 메모 |
|---|---|---|---|
| F1 | validator port 검사 substring → AST | done | commit `155e448e` |
| F2 | validator 추가 substring rule AST 강화 | done | 동일 회귀 패턴 차단 |
| B7 | 5 슬라이스 토폴로지 metadata 24 슬라이스 부착 | done | commit `7ed87cc9` |
| B9 | validator 5 토폴로지 first-class 인식 | done | commits `60f19529`, `68c93f12` |
| B6 | bitmap 슬라이스 process.env → forRoot config | done | commit `e47282e0` |
| A2 | dead factory.ts / shared/ 정리 | done | commit `71e6244c` |
| C10 | SubscriptionUserQueryPort production adapter | done | commit `9faa04a1` |
| C11 | C10 의 ^method 마커 등록 | done | commit `11481a5a` |
| E15 | outbox alias re-export 16 줄 dedup | done | commit `37de1ec2` |
| D13 | sub-agent-verify-discipline skill | done | [`docs/skills/sub-agent-verify-discipline.md`](../../skills/sub-agent-verify-discipline.md) |
| D14 | simulations production taxonomy 면제 결정 | done | lessons-learned §4 |
| G1 | BFF prefix 라우팅 governance + gateway 충돌 일부 해소 | partial | commit `bde538cd` |
| C12 | 미proxy slice routes | open | 사용자 결정 대기 |

## 진행 방식

본 plan 커밋 이후 별도 승인 없이 Phase 0 → 3 를 순차/병렬로 실행한다. Phase 2 의 병렬 dispatch 시점에 슬라이스 spec sheet 를 동적으로 생성하여 각 에이전트에 전달한다.

## Sub-Agent Dispatch 규율

Phase 1 / Phase 2 / Phase 3 에서 sub-agent 를 호출할 때는 **반드시** 다음 가이드를 따른다 (false-claim 사례 재발 방지).

- `docs/skills/sub-agent-verify-discipline.md` — verify-before-complete 룰, prompt 템플릿, caller spot-check 절차
- 검증 명령은 stdout last ~20 lines 를 sub-agent 보고에 그대로 포함. "통과" / "ok" 같은 자기 평가 단어 금지
- vitest 통과 ≠ tsc 통과 — `pnpm --filter <pkg> build` 별도 강제
- 상위 에이전트는 phase advance 전 spot-check 1-2 개 명령을 직접 재실행해 일치 확인
