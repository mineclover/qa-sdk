---
def:
  id: domain-hierarchy-phase5a-merge
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 5a — Class M 병합 실행

## 목적 ^purpose

Phase 5 redesign (2026-04-20-phase5-redesign.md) 의 Class M(진짜 내용 중복) 2쌍 — `motion-workspace-service ↔ motion-workspace-system`, `clickhouse-analytics-todo ↔ redis-cache-pipeline-todo` — 을 재검토하고 병합 가능한 쌍을 실제로 병합한다. 병합 불가(서로 다른 개념) 쌍은 Phase 5c(contains 재구성) 후보로 이관한다.

## 처리된 병합

### motion-workspace-service → motion-workspace-system (merged)

| 항목 | 값 |
|---|---|
| keeper | `motion-workspace-system` (`docs/specs/motion-workspace/motion-workspace-system.md`) |
| deprecated | `motion-workspace-service` (`docs/specs/motion-workspace/motion-workspace-service.md`) |
| 사유 | 좌표 동일(`system:feature::func_def`, root=`motion-workspace-service`). system 문서는 도메인 overview(library + client + service), service 문서는 service 패키지 내부 상세. service 상세는 별도로 존재하는 `motion-workspace-service-spec` (`docs/specs/motion-content/motion-workspace-service.spec.md`) 이 specification depth 로 보유. overview depth 에서 system 과 service 가 병존할 근거 없음. |
| 흡수된 본문 | service 문서의 `구성 ^overview` 목록(createApp, MotionWorkspaceController, MotionWorkspaceRepository, SQLiteRepository, WorkspaceWsHub, Health/Workspace routes, ErrorHandler) 과 `설계 결정 ^intent` 3건을 system 문서의 신규 `서비스 런타임 구성 ^overview` 및 `설계 결정 ^intent` 섹션으로 이관. |
| frontmatter 처리 | deprecated 문서: `lifecycle: approved → deprecated`, `superseded_by: motion-workspace-system` 추가, 기존 `contains: motion-workspace` + `depends_on: motion-workspace-system` 링크 제거, `traces_to: motion-workspace-system` 로 대체. |
| incoming link re-route | 1건 — `motion-workspace-client.md` frontmatter `depends_on: motion-workspace-service` → `depends_on: motion-workspace-system`. |
| 파일 존속 | deprecated 문서는 삭제하지 않음(내용 본문 → 파기 기록 + 신규 참조 가이드). |

#### 주의사항

- 초기 시도에서 keeper 문서에 `refines: motion-workspace-service-spec` 링크를 추가했으나, `motion-workspace-spec (→ motion-workspace-system 의존) → motion-workspace-service-spec (← motion-workspace-spec contains) → motion-workspace-system` 순환이 발생해 error 3건 발생. 해당 링크 제거하여 해소. 연관 스펙 참조는 본문 링크(markdown) 로만 표기.
- 패키지(`packages/motion-workspace-service/`) 및 서비스 런타임 코드는 그대로 유지. 문서 레이어만 재구성.

## 재검토로 보류한 쌍

### clickhouse-analytics-todo ↔ redis-cache-pipeline-todo (NOT merged)

| 항목 | 값 |
|---|---|
| 좌표 | `none:feature:operation:func_def` (둘 다 tier 없음, lifecycle=draft) |
| 파일 | `docs/archive/todo/clickhouse-analytics.todo.md`, `docs/archive/todo/redis-cache-pipeline.todo.md` |
| 재검토 결과 | **서로 다른 백엔드, 서로 다른 목적** — 병합 대상 아님. |
| 근거 | clickhouse todo 는 OLAP 분석 전용 `AnalyticsStore` 포트 설계(bulkInsert + 시계열/TopK/분포 쿼리), CRUD 포트와 분리. redis todo 는 L2 decode 결과 캐시 + 서비스 간 공유 + 무효화 전파로 완전히 다른 도메인. 코드 중복 0. |
| 현재 분류 | Phase 5 redesign 에서는 "Class M" 으로 표기되어 있었으나(plan 행 #24), 실제 재검토 시 "cross-scope 태그 추가하여 warning 억제" 로 기술됨. 이는 병합이 아니라 Class C/A 대응. |
| validator 현황 | 두 문서 모두 tier 가 없어 domain_root 가 self 로 파생됨(refines/depends_on 이 ingest-infra-system 을 가리키지만 non-domain tier 로 체인 중단). 현재 dup-coord 경고 대상에도 포함되지 않음 — 이미 문제 없음. |
| 권고 | Phase 5a 에서 처리하지 않고 Phase 5c 검토 항목으로 이관: (a) `store-adapter-parity` 를 parent 로 하는 `contains` 링크를 부모 측에 추가하여 명시적 계층화, 또는 (b) 구현 완료 시 `lifecycle: deprecated` 로 전이. 현 시점 dup-coord 미발생이므로 긴급 처리 불요. |

## 검증 결과

`pnpm exec qa-sdk def sync && pnpm exec qa-sdk def validate` 결과.

| 지표 | Before (병합 전) | After (병합 + 본 보고서 포함) | Delta |
|---|---|---|---|
| errors | 0 | 0 | 0 |
| warnings | 57 | 57 | 0 (실질 -1, 본 보고서 추가로 +1 상쇄) |
| duplicate-coordinate 그룹 | 34 | 33 | -1 |
| 문서 수 | 1158 | 1160 | +2 (phase5-redesign + phase5a-merge 리뷰 문서) |
| 링크 수 | 3000 | 3002 | +2 |

- 병합으로 사라진 dup-coord 그룹: `system:feature::func_def:motion-workspace-service`.
- 본 보고서는 Class C proposal cluster(`system:meta::proposal_design:domain-hierarchy-readme`) 에 합류 — 기존 16 → 17 멤버, 그룹 수는 변동 없음(이미 duplicate 상태였고 수용됨).
- 순환 참조/broken-link/missing 등 신규 에러 없음.
- Phase 5 redesign 문서가 기록한 baseline "36" 과 실제 DB 측정값 34 사이 차이는 Phase 4 이후 소규모 링크 정리가 반영된 결과로 추정. Phase 5a 이후 실측 기준 = 33.

## 다음 단계 연결

1. **Phase 5b** (Class D Diversify, 10 그룹): `definition-catalog-spec` 과흡수(7+6+4 그룹), `storage-system` 과흡수(4+4), `registry-system/gate-system` 서비스 경계 혼합. aspect 어휘 변경 RFC 또는 root 분리 선행.
2. **Phase 5c** (Class A Abstract, 20 그룹): `contains` 명시 + tier 승격. **재분류 추가**: `clickhouse-analytics-todo ↔ redis-cache-pipeline-todo` 쌍을 Class A 후보로 이관(store-adapter-parity 를 parent 로 하는 contains 구조 검토). 단, 현 시점 dup-coord 미발생으로 긴급도 낮음.
3. **Phase 5d** (Class C Co-locate, 4 그룹): proposal cluster validator 예외 또는 cross-scope 태그 전략.

## 산출물

- 변경된 문서 3건: `docs/specs/motion-workspace/motion-workspace-system.md` · `docs/specs/motion-workspace/motion-workspace-service.md` · `docs/specs/motion-workspace/motion-workspace-client.md`
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5a-merge.md`
- baseline/after validate 로그: `/tmp/phase5a-before.txt`, `/tmp/phase5a-after.txt`

## 참조

- [2026-04-20-phase5-redesign.md](./2026-04-20-phase5-redesign.md) — Class M 분류 근거
- [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md) §"무변화 그룹" — 2쌍 merge 후보 원자료
- [2026-04-20-phase4-impl.md](./2026-04-20-phase4-impl.md) — Phase 4 시점 스냅샷
