---
def:
  id: domain-hierarchy-service-todo-review
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
date: 2026-04-21
part_of: domain-hierarchy
role: review
---

# Service TODO/Plan Inventory — 서비스별 백로그 상태 리뷰

## §1 Executive Summary

레지스트리된 1,248개 문서 중 `*.todo.md` / `*.plan.md` 확장자를 가진 문서는 총 **38건**이다. 내역은 다음과 같다.

| 유형 | 활성 | 아카이브 | 합계 |
|------|------|---------|------|
| `.todo.md` | 10 | 6 | **16** |
| `.plan.md` | 21 | 1 | **22** |
| **합계** | **31** | **7** | **38** |

핵심 관찰:

- **운영 가능 스케일**: 1,248개 중 38개만 계획/할일 문서다 (3%). 나머지 1,210개는 spec/rule/cases/test 등 확정 산출물. 백로그 과밀 상태 아님.
- **서비스 집중도**: 계획/할일의 ~78%가 5개 서비스에 몰려 있다 — `event-vocab-system` (6 plans), `definition-catalog` (6 docs), `operational-ontology` (4 docs), `system` (5 docs), `authorization-ontology` (3 docs).
- **Lifecycle 편향**: 활성 문서 31건 중 30건이 `draft`, 1건만 `approved` (`cli-command-registry-plan`). 승급 단계에 있는 문서가 거의 없다 → 프로덕션 게이트 전 대기 상태가 많음.
- **Staleness 없음**: 모든 파일의 git mod 날짜가 2026-04-19 이후. 30일 이상 방치된 문서는 **0건**. 이는 archive된 6건도 최근에 격리된 결과.
- **주의 집중 대상**: `event-vocab-system` (roadmap·layering·usecases·mapping·adoption·seed0 6개 plan 동시 진행, todo 없음) 와 `definition-catalog` (label-registry·docs-control·addressing 3개 플로우 평행)가 현재 설계 밀도가 가장 높은 서비스.

## §2 서비스별 TODO/Plan 상태

docs/ 디렉토리 경로를 서비스 경계로 사용한다 (`deriveDomainRoot` 파생은 self-root가 대다수라 실질적 그룹핑에 부적합).

### 2.1 event-vocab-system (6 plans / 0 todos)

| doc_id | lifecycle | git-last | 비고 |
|--------|-----------|---------|------|
| `event-taxonomy-roadmap-plan` | draft | 2026-04-21 | entry-point, 3층 분리 이행 로드맵 |
| `event-taxonomy-layering-plan` | draft | 2026-04-21 | vocabulary↔interpretation↔adoption 3층 설계 |
| `event-taxonomy-usecases-plan` | draft | 2026-04-20 | 검증 시나리오 |
| `event-mapping-pack-plan` | draft | 2026-04-20 | event→prefix 매핑 pack 도입 |
| `service-event-adoption-plan` | draft | 2026-04-20 | 서비스별 채택 모델 |
| `event-seed-materialization-phase0-plan` | draft | 2026-04-20 | shopping-web 하드코딩 제거 (Phase 0) |

- **active focus**: Phase 0 (seed hardcode 제거). roadmap 문서가 entry-point 태그 부착.
- **blockers**: 없음. todo가 없는 이유는 롤아웃 스크립트가 아직 archive로 이동됨 (`event-taxonomy-rollout-todo`) — 설계는 충분히 모였지만 실행 todo가 아직 현역에 없다.
- **다음 작업**: Phase 0 plan을 todo로 분해해 실행 단계로 전환.

### 2.2 definition-catalog (2 todos / 4 plans)

| doc_id | type | lifecycle | 체크리스트 진척 |
|--------|------|-----------|----------------|
| `deterministic-label-registry-fsm-todo` | todo | draft | 0/6 ("현재 실제 소비자 요구 없어 대기") |
| `docs-control-plane-todo` | todo | draft | 0/5 |
| `deterministic-label-registry-extraction-plan` | plan | draft | 3단계 PRD 분할 제안 |
| `deterministic-label-registry-fsm-plan` | plan | draft | FSM 설계 |
| `deterministic-label-stability-plan` | plan | draft | 좌표 안정성 증명 방법 결정 |
| `docs-control-plane-plan` | plan | draft | 후속 순서·근거 |
| `definition-addressing-plan` | plan | draft | id↔address 병행 전환 |

- **active focus**: deterministic-label-registry 군 (3 plans) — 라이브러리 추출 경로 미확정.
- **blockers**: `deterministic-label-architecture` (linked spec)이 `draft`. 설계가 움직이는 중이라 todo 진행 불가 상태.
- **다음 작업**: stability-plan 결론 먼저 → extraction-plan 후속.

### 2.3 operational-ontology (2 todos / 2 plans)

| doc_id | type | lifecycle | 체크리스트 진척 |
|--------|------|-----------|----------------|
| `operational-ontology-registry-allocation-todo` | todo | draft | **78/80** (97%) |
| `programming-artifact-ontology-context-simulation-todo` | todo | draft | **28/31** (90%) |
| `programming-artifact-ontology-todo` | todo | draft | **34/37** (91%) |
| `operational-ontology-registry-allocation-plan` | plan | draft | — |
| `programming-artifact-ontology-context-simulation-plan` | plan | draft | — |
| `programming-artifact-ontology-plan` | plan | draft | — |

- **active focus**: 3개 todo 모두 거의 완료 상태 (~90%+). 빠르게 마감할 수 있음.
- **잠재적 blocker**: 연결된 spec (`operational-ontology-registry-allocation`, `programming-artifact-ontology-system`)이 모두 `draft` lifecycle. todo 완료 뒤 spec 승격이 필요.
- **다음 작업**: 남은 2~3개 체크리스트 항목 마무리 → spec 승격 → todo archive.

### 2.4 docs/specs/system (1 todo / 4 plans)

| doc_id | type | lifecycle | 비고 |
|--------|------|-----------|------|
| `work-lifecycle-todo` | todo | draft | 0/3, linked spec `work-lifecycle` **approved** |
| `work-lifecycle-plan` | plan | draft | 기계화 순서 로드맵 |
| `pm-taxonomy-plan` | plan | draft | 상태 관리 taxonomy 초안 |
| `work-topic-schema-plan` | plan | draft | work_topic schema 설계 |
| `document-addressing-contract-plan` | plan | draft | 문서 교집합 계약 승격 |

- **active focus**: work-lifecycle 계열 3문서 + pm-taxonomy.
- **blockers**: `work-lifecycle` spec은 이미 `approved` 상태인데 todo는 0/3. spec과 todo의 drift 가능성 — 실제로 구현이 완료됐다면 todo가 obsolete일 수 있다.
- **다음 작업**: work-lifecycle-todo 검토 후 3개 항목 수행 여부 확정 (진행/보류/삭제).

### 2.5 authorization-ontology (1 todo / 2 plans)

| doc_id | type | lifecycle | 체크리스트 진척 |
|--------|------|-----------|----------------|
| `authorization-management-hardening-todo` | todo | draft | 11/28 (39%) |
| `authorization-management-roadmap-plan` | plan | draft | entry-point |
| `authorization-ontology-operational-pack-plan` | plan | draft | — |

- **active focus**: proxy/application/Cerbos/permission-engine 통합 하드닝. 진행 중.
- **linked spec**: `authorization-management-usecases`, `authorization-management-usage-rule` 모두 `approved`. `authorization-ontology-system`만 `draft`.
- **다음 작업**: 남은 17개 체크리스트 진행.

### 2.6 infra-engine (2 todos / 0 plans)

| doc_id | type | lifecycle | 체크리스트 진척 |
|--------|------|-----------|----------------|
| `infra-engine-todo` | todo | draft | **20/29** (69%) |
| `infra-auth-integration-todo` | todo | draft | 0/3 |

- **active focus**: 파이프라인 안정화 (infra-engine-pipeline spec은 이미 approved). 백필 단계.
- **blockers**: 없음. auth-integration은 시작 전 단계.
- **다음 작업**: infra-engine-todo의 남은 9개 → 이후 auth-integration 착수.

### 2.7 bdd-system (1 todo / 0 plans)

| doc_id | type | lifecycle | 체크리스트 진척 |
|--------|------|-----------|----------------|
| `bdd-contract-system-todo` | todo | draft | 0/11 |

- **active focus**: Phase 1 (read-only, compile preview) 완료, Phase 2 실행 대기.
- **linked spec**: `bdd-contract-system`·`bdd-contract-schema`·`bdd-contract-cli` 모두 **approved**. Phase 2 실행 전 구조는 확정됨.
- **다음 작업**: Phase 2 write/apply·test materialization 착수.

### 2.8 ingest (1 todo)

- `ingest-store-drivers-todo` (draft, 0/7). linked spec `ingest-runtime-operations` approved. drive 미구현 현황 추적.

### 2.9 cli (1 plan, approved)

- `cli-command-registry-plan` — 전체 38건 중 유일한 **approved** lifecycle. 메타 전환 작업 완료에 가까움.

### 2.10 archive (6 docs)

모두 `docs/archive/`로 격리됨 (대부분 완료 또는 무효화):

| doc_id | note |
|--------|------|
| `spec-code-reference-rollout` | 유일한 `archived` lifecycle |
| `cli-minor-gaps-todo` | 체크리스트 0건 (Gap 없음) |
| `clickhouse-analytics-todo` | 체크리스트 0건 |
| `event-taxonomy-rollout-todo` | 27/27 완료 |
| `redis-cache-pipeline-todo` | 체크리스트 0건 |
| `rlsc-text-occupancy-todo` | 29/29 완료 |

→ archive된 todo들은 lifecycle이 여전히 `draft`인 경우가 있다 (`event-taxonomy-rollout-todo` 등). frontmatter 동기화 드리프트 의심, 별도 cleanup 필요.

## §3 Cross-cutting Patterns

### 3.1 Stale — 해당 없음

모든 파일이 2026-04-19 이후 수정됐다. 현재 시점(2026-04-21)에서 30일 이상 방치된 todo/plan 은 **0건**. git-tracked 기준으로는 staleness 문제 없음.

### 3.2 Lifecycle Drift

- **30/31** 활성 문서가 `draft`. `approved`는 `cli-command-registry-plan` 하나만. 승격 절차가 todo/plan 단계에서는 사실상 운영되지 않고 있다.
- archive 폴더 문서의 lifecycle이 여전히 `draft`인 경우가 있음 (`clickhouse-analytics-todo`, `redis-cache-pipeline-todo` 등) → archive 이동 시 frontmatter도 `archived` 또는 `deprecated`로 함께 바꿨어야 함. **`feedback_file-db-sync-discipline.md`** 경고 반영.

### 3.3 Spec-Todo 편차 (obsolete 의심)

다음 todo들은 연결된 spec이 `approved`임에도 lifecycle이 `draft` 유지:

- `work-lifecycle-todo` ↔ `work-lifecycle` (approved), 체크리스트 0/3
- `bdd-contract-system-todo` ↔ `bdd-contract-*` (approved), 체크리스트 0/11
- `infra-engine-todo` ↔ `infra-engine-pipeline` (approved), 체크리스트 20/29
- `infra-auth-integration-todo` ↔ `infra-auth-integration` (approved), 체크리스트 0/3
- `ingest-store-drivers-todo` ↔ `ingest-runtime-operations` (approved), 체크리스트 0/7

→ spec은 approved인데 todo가 0% 진행인 항목은 **obsolete 가능성** 또는 **spec 승격이 todo보다 앞선 drift**다. 수동 검토 필요.

### 3.4 Blocked (spec draft로 인한 대기)

- `deterministic-label-registry-fsm-todo` (0/6) — 연결 spec `deterministic-label-architecture` draft. 설계 미확정.
- `operational-ontology-registry-allocation-todo` (78/80) — 연결 spec `operational-ontology-registry-allocation` draft. todo 완료 → spec 승격 쌍으로 움직여야 함.
- `programming-artifact-ontology-*-todo` — 연결 spec `programming-artifact-ontology-system` draft. 동일 패턴.

### 3.5 Orphan Plan (todo 없이 plan만)

- event-vocab-system: 6 plan, 0 active todo
- system: 4 plan (work-lifecycle-plan 제외)
- authorization-ontology: 2 plan, 1 todo

→ plan 단계에서 멈춰 있고 실행 단계 분해가 아직 todo로 내려오지 않았다. 전환 시점 평가 필요.

## §4 Recommended 다음 작업

우선순위 1 (빠른 마감, ROI 최고):

- **operational-ontology** — todo 3개 평균 ~93% 완료. 마지막 체크리스트 항목만 처리하면 spec 승격까지 chain reaction 가능.
- 근거: 완료율 매우 높음 + linked spec이 draft라 todo 완료가 spec 승격의 전제조건. 1~2 세션 내 완결 기대.

우선순위 2 (drift 정리, 위생):

- **docs/archive/** 내 6개 todo의 frontmatter lifecycle을 `draft` → `archived`/`deprecated`로 동기화. archive 이동만 되고 메타데이터는 남은 상태.
- **spec-approved + todo-draft 그룹**의 5개 todo (work-lifecycle, bdd-contract-system, infra-engine, infra-auth-integration, ingest-store-drivers)를 개별 검토해 진행/보류/archive 결정.

우선순위 3 (설계 밀도 해소):

- **event-vocab-system**: plan 6개가 동시 진행 중 — Phase 0 (`event-seed-materialization-phase0-plan`)부터 todo로 분해해 실행 단계 진입.
- **definition-catalog**: deterministic-label-* 3 plan의 결론 (stability-plan) 선행 필요. 그 뒤 extraction·fsm 순.

우선순위 4 (기획 심화):

- `authorization-management-hardening-todo` (11/28, 39%) — 꾸준히 진행하되 Big Bang 작업이 아님. 상시 백로그로 유지.

**첫 착수 제안**: **operational-ontology**. 이유는 (1) 3개 todo 합산 92%+ 완료 (2) 단일 세션으로 완결 가능 (3) spec 승격 chain 유발 (4) draft spec lifecycle 정상화 기여.

## §5 Methodology

### 5.1 데이터 소스

- `data/definition-service.sqlite` 의 `documents` 테이블에서 `source_path LIKE '%.todo.md' OR '%.plan.md'`로 38건 추출.
- CLI `qa-sdk def list --type=todo/plan --limit=500` 과 동등한 집합 (EXT_TYPE_FLAGS 매핑, `packages/cli/src/commands/def.ts` L168).

### 5.2 서비스 매핑 기준

- 1차 시도: `qa-sdk def context <doc> | grep 도메인 루트` 로 `deriveDomainRoot` 파생 값 수집. → 결과: 32/38이 `self` (자신이 domain-tier root). 서비스 경계 그룹핑에 부적합.
- 2차 채택: **`source_path` 의 디렉토리 세그먼트** (`docs/specs/<service>/...`)를 서비스 경계로 사용. 경로 자체가 저자가 선택한 소유 서비스를 반영한다.

### 5.3 진척도 측정

- 체크리스트 진척 = `^- \[x\]` 줄 수 / `^- \[` 줄 수. 전체 todo 본문 기준.
- 일부 todo는 checklist 없이 서술형 (e.g. `docs-control-plane-todo`). 이 경우 "0 체크" 로 표기했으나 실제 완료도는 본문 해석 필요.

### 5.4 Lifecycle·drift 판정

- `lifecycle` 은 frontmatter 필드를 SQLite에 동기화한 값 사용.
- "spec approved + todo 0%" 패턴을 **drift 후보**로 분류. 기계적 결론이 아니라 검토 trigger다.

### 5.5 Staleness 측정

- `git log -1 --format=%ai <file>` 의 authored date 사용. 커밋되지 않은 작업 파일 (3건: `bdd-contract-system.todo.md`, `work-lifecycle.*.md`, `work-topic-schema.plan.md`)은 날짜 공란으로 표기, 활성 작업으로 간주.

### 5.6 한계

- domain_root 파생이 self로 자주 해소되어 서비스별 집계에 사용하지 못했다. 향후 `deriveDomainRoot` 가 leaf/module 문서에서 디렉토리 기반 fallback을 제공하면 정확도가 올라갈 것.
- 체크리스트 진척은 구조적 지표이지 실제 구현 품질과 직교하지 않는다. 본문의 `보류 중` 표기 등 qualitative cue는 별도 해석.
- "의도하지 않은 drift" 와 "의도된 obsolete" 를 자동으로 구분하지 못한다. 수동 검토 필수.
