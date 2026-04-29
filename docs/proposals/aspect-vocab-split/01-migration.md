---
def:
  id: aspect-vocab-split-01-migration
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: implementation
  links:
    - target: aspect-vocab-split-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-vocab-split
role: migration
---

# Aspect Vocabulary Split — 롤아웃 계획 (Phase B-0 ~ B-4)

## 목적 ^purpose

[00-design.md](./00-design.md) 에서 제안한 aspect 분할을 **비파괴적·가역적 단계** 로 쪼개어 실행한다. 각 단계는 (a) 목적, (b) 작업 내용, (c) 성공 기준, (d) 롤백 경로, (e) 의존 조건을 가진다. Phase B-1 이후는 사람 승인 의존이며 중단/연기 가능.

"B-" prefix 는 도메인 계층 Phase 5 와의 구분용 (A=A/M/C/D 분류, B=aspect vocabulary split RFC 고유 phase).

## 단계 요약

| 단계 | 목적 | 타입 | 가역성 | 의존 |
|---|---|---|---|---|
| B-0 | vocabulary/taxonomy 확장 (non-breaking) | code | 완전 | — |
| B-1 | HIGH confidence 마이그레이션 | doc | 링크 원복 가능 | B-0 |
| B-2 | MED confidence 마이그레이션 | doc | 링크 원복 가능 | B-1 |
| B-3 | LOW confidence / exception 처리 | doc + decision | 링크 원복 가능 | B-2 |
| B-4 | (optional) 레거시 aspect deprecation | code | 복합 | B-3 |

## Phase B-0 — Vocabulary Addition (non-breaking)

### 목적 ^b0-purpose

새 aspect 값을 코드에 선언하고 유효 scope 매핑을 확장한다. **문서는 건드리지 않는다**. 이 단계 이후 기존 문서는 모두 그대로, 새 값만 선택 가능.

### 작업 내용 ^b0-work

1. `packages/definition-catalog/src/vocabulary.ts` — `DEF_ASPECT`:
   - `entries` 에 17 개 신규 값 추가 (단 `dkg_data` 는 00-design §D 의견에 따라 **제외** 권장 → 16 개 추가로 최종 조정 가능)
   - `capacity: 64 → 128`
   - `ko` 한글 매핑 테이블에 각 신규 값의 한국어명 추가 (예: `codegen_func: "코드생성기능"`, `taxonomy_data: "분류체계데이터"`)
2. `packages/definition-catalog/src/taxonomy.ts` — `VALID_SCOPE_ASPECTS`:
   - `feature` 키에 `codegen_func`, `harness_func`, `gate_func`, `analyzer_func`, `encoding_func`, `domain_service_func`, `nesting_func` 추가
   - `flow` 키에 `lifecycle_flow`, `ingest_flow`, `pipeline_flow`, `gate_flow`, `definition_mgmt_flow` 추가
   - `interface` 키에 `decode_contract`, `gate_contract`, `query_contract`, `browser_contract`, `pipeline_contract` 추가
   - `data` 키에 `taxonomy_data`, `coordinate_model_data` 추가
3. `DEFINITION_TAXONOMY` 의 각 scope 블록에도 신규 aspect description 추가
4. (선택) `docs/specs/definition-catalog/definition-taxonomy.spec.md` 본문에서 aspect 목록을 enumerate 한 표가 있다면 동기화. 단 본 RFC 는 스펙 프론트매터/본문 수정 금지 대상이므로 **별도 후속 작업**으로 분리.

### 성공 기준 ^b0-success

- `pnpm --filter definition-catalog build` 성공
- `pnpm --filter definition-catalog test` 성공 (특히 `validateScopeAspect` 테스트 — 새 값이 전부 valid 한지)
- `pnpm exec qa-sdk def sync` 성공 후 `def validate` errors=0 유지 (문서 미변경)
- Capacity guard 경고 없음 (capacity 128, entries 40, headroom 88)

### 롤백 ^b0-rollback

- vocabulary/taxonomy 커밋 1건 revert. 파일 2개 수정만으로 복구 완료.

### 의존 ^b0-dependencies

없음. 본 단계는 단독 실행 가능.

## Phase B-1 — HIGH Confidence Migration

### 목적 ^b1-purpose

[02-impact.md](./02-impact.md) 의 HIGH 등급 문서 **47 건** 을 새 aspect 로 점진 이동. 각 target aspect 는 독립 배치로 나누어 실행.

### 진행 순서 (dup-coord 영향 큰 순)

1. **B-1a: `func_def` 배치** (HIGH 21 건, 7 dup-coord 그룹)
   - 예상 dup-coord 감소: 7 → 0 (func_def 키 기준)
   - 대상 그룹: definition-catalog-spec (7) / system-libraries (3) / partial-binder (4) / decision-standard (3) / scope-nesting (3) / registry-system mediation (3) / store-adapter-parity (2)
2. **B-1b: `process_flow` 배치** (HIGH 11 건, 3 dup-coord 그룹)
   - 예상 dup-coord 감소: 3 → 0 (system-libraries `layout:flow` 그룹은 B-3 의 sibling 조치 별도)
3. **B-1c: `api_contract` 배치** (HIGH 10 건, 2 dup-coord 그룹)
   - 예상 dup-coord 감소: 2 → 0 (registry-system 그룹은 registry-system 자체가 fallback 유지로 1 개 남지만 고립이므로 dup-coord 키에서는 제거)
4. **B-1d: `domain_data` 배치** (HIGH 5 건, 1 dup-coord 그룹)
   - 예상 dup-coord 감소: 1 → 0 (definition-catalog-spec 흡수 4 멤버 이동)

### 작업 방법 (문서당) ^b1-method

- `.spec.md` / `.plan.md` 등의 frontmatter `def.aspect` 필드만 수정
- 변경 후 `pnpm exec qa-sdk def sync` 실행
- dup-coord 수 확인: `pnpm exec qa-sdk def audit | grep duplicate-coordinate`
- 한 배치(예: B-1a) 완료 후 audit 재검증. 예상치와 실제치가 다르면 중단하고 원인 추적.

### 성공 기준 ^b1-success

- 각 배치 완료 후 `def validate` errors=0
- dup-coord 건수가 예상 감소량 내로 감소
- `invalid-scope-aspect` 에러 없음
- 마이그레이션 문서의 incoming link(`depends_on`/`implements`/`refines`/`contains`) 전수 정상 유지 (링크는 doc id 기반, aspect 에 의존 없음 — R1 검증)

### 롤백 ^b1-rollback

- 배치 단위로 `git revert` 가능. 문서 frontmatter 만 수정되므로 롤백 비용 낮음.

### 의존 ^b1-dependencies

- B-0 완료 필수 (vocabulary 확장 없이는 validator 가 새 aspect 를 reject 한다).

## Phase B-2 — MED Confidence Migration

### 목적 ^b2-purpose

MED 10 건은 "두 개 이상의 신규 aspect 가 모두 합리적" 이거나 "분할 대상 값 중 어느 것에도 완벽히 맞지 않지만 fallback 보다는 구체화가 낫다" 는 경계 사례. 개별 승인 후 이동.

### 작업 방법 ^b2-method

- MED 리스트 ([02-impact.md](./02-impact.md) confidence=med) 를 리뷰 세션에서 1 건씩 검토
- 리뷰어가 aspect 선택 (또는 fallback 유지 선택) → 결정을 02-impact.md 에 기록
- 선택된 값으로 frontmatter 수정 후 sync

### 성공 기준 ^b2-success

- 각 MED 문서마다 리뷰어 결정 기록 (log 또는 02-impact.md 갱신)
- `def validate` errors=0
- 결정 중 "fallback 유지" 라고 판단된 문서는 aspect 미이동 — 이 경우 dup-coord 가 남아도 의도적 상태 기록

### 롤백 ^b2-rollback

- 문서 단위 revert.

### 의존 ^b2-dependencies

- B-1 완료 권장 (HIGH 이동 후에 MED 의 dup-coord 잔여 상태를 정확히 파악 가능)

## Phase B-3 — LOW Confidence / Exception

### 목적 ^b3-purpose

LOW 2 건(decision-service-system, definition-service-system) 및 특수 케이스 처리.

### 특수 케이스

1. **LOW 문서 2 건**: "서비스 전체" vs "서비스의 주 기능" 사이 모호. 사람이 최종 결정.
2. **dkg-system 그룹 (3 멤버)**: 00-design §D 에서 `dkg_data` 가 동일 값에 재수렴함으로 제외 결정. 대안:
   - (i) layout 승격 — dkg-system 을 `tier: layout` 으로, skill-catalog/state-store 는 자식으로 유지
   - (ii) sibling 계층화 — skill-catalog/state-store 를 dkg-system 의 `contains` 자식으로 명시
   - Phase 5c 후속 작업 (본 RFC 범위 밖) 으로 이관 기록
3. **system-libraries / system-infra 그룹 (2 멤버, layout 티어)**: 00-design §B 의 Option-B 권장 — system-libraries 를 aspect `process_flow` → `relation` 으로 이동. `relation` aspect 는 flow scope 의 기존 값이며 의미상 "라이브러리 간 의존 관계" 에 적합.
4. **viz 그룹 (component aspect)**: 본 RFC 범위 밖. Phase 5c §"3+ 멤버 그룹" 으로 환원.

### 작업 방법 ^b3-method

- 각 특수 케이스에 대해 결정 기록 → 실행
- dkg-system 그룹은 별도 PR 로 처리 권장

### 성공 기준 ^b3-success

- `def validate` errors=0
- dup-coord 건수가 최종 안정 상태 도달 (목표: ≤ 5, 대개는 viz 그룹과 사람이 유지 판단한 cluster)

### 롤백 ^b3-rollback

- 케이스별 독립 revert.

### 의존 ^b3-dependencies

- B-2 완료 권장.

## Phase B-4 — Legacy Aspect Deprecation (optional)

### 목적 ^b4-purpose

모든 HIGH/MED 마이그레이션이 완료된 후, 기존 `func_def`/`process_flow`/`api_contract`/`domain_data` 가 여전히 다수 문서에서 fallback 으로 쓰이고 있다면 현상 유지. 만약 마이그레이션이 진행되어 fallback 사용이 <30% 수준까지 축소되면 deprecated 처리 검토.

### 옵션

1. **영구 fallback 유지** (권장, 00-design Q1)
   - 추가 작업 없음. fallback 의 존재가 taxonomy 의 완전성을 보장.
2. **Soft-deprecation**
   - `DEF_ASPECT` 엔트리에 `deprecated: true` 플래그 추가 (축 정의 인터페이스 확장 필요)
   - Validator 가 deprecated aspect 사용 문서에 warning 발생
   - 신규 문서는 세분화된 값 사용하도록 유도

### 작업 방법 (옵션 2 선택 시) ^b4-method

- `vocabulary.ts` 의 축 정의 인터페이스에 `deprecatedEntries: readonly string[]` 필드 추가
- `validate.ts` 에 deprecated aspect 사용 감지 루프 추가
- 코드 LOC 변화: ~20 추정
- 이름 제거는 **절대 금지** — 기존 ingest 된 문서가 참조할 수 있음

### 성공 기준 ^b4-success

- 기존 문서 검증에 regression 없음
- 신규 deprecation warning 만 추가

### 롤백 ^b4-rollback

- 코드 1 커밋 revert. 축 데이터는 변경되지 않음.

### 의존 ^b4-dependencies

- B-2 완료.
- 사람 승인 — 본 단계는 **실행하지 않을 수 있다**.

## Phase C — Schema Hierarchy 전환 (향후 별도 RFC)

### 목적 ^c-purpose

Phase A (flat 확장) / B-0~B-4 (migration) 완료 후, vocabulary 의 flat aspect 집합이 안정화되면 **schema 기반 계층** 으로 전환한다. 본 Phase 5b RFC 는 Phase C 를 **예고만** 하며, 실제 실행은 별도 RFC 에서 다룬다.

### Phase C 개시 트리거

다음 조건이 **모두** 만족될 때 Phase C 를 개시한다.

- **aspect 수 ≥ 40** — 현재 23 + 본 RFC 제안 17 = 40 (Phase B-0 완료 시 이미 달성 예정)
- **rollup 쿼리 요구 ≥ 5회** — CLI (`def audit --rollup-aspect X`), dashboard filter, DKG 브릿지 등에서 flat 열거로 해결 불가능한 요구가 5회 이상 누적
- **UX 한계 도달** — `def list --aspect` 자동완성에서 40+ flat 값 열거가 사용자 피드백상 실용 한계로 판명

세 조건이 모두 충족되기 전에는 Phase C 를 개시하지 않는다 — YAGNI.

### 전환 순서 (예정)

1. **Schema 확장** — `aspects` 테이블에 `parent_id` 컬럼 추가 (nullable).
2. **Migration 스크립트** — Phase B-0 에서 선언한 `ASPECT_PARENTS` map 을 SQL INSERT 로 bulk populate. 이 단계의 **전면 성공** 이 Phase C 의 핵심. map 선언이 B-0 에 있으므로 migration 은 코드 추출 + SQL generation 으로 기계적.
3. **Validator 규칙 확장** — aspect 조회 시 parent chain traversal 지원. `validateScopeAspect` 가 부모 체인에서도 유효 조합 검증 가능.
4. **Frontmatter 문법** (선택) — 기본 표기는 불변 (`aspect: codegen_func`). 컴포지트 표기 (`aspect: func_def > codegen`) 는 대안으로만 검토 — 미채택 시 유저-facing 변경 없음.
5. **Rollup API 공식화** — `getAspectFamily(aspect): string[]` 가 `[aspect, ...descendants]` 반환. Phase B-0 의 `deriveAspectParent` helper 는 역방향 (자식→부모) 이므로 정방향 helper 를 Phase C 에서 추가.
6. **레거시 deprecation 정책 확정** — Phase B-4 의 deprecation 정책 계승. 부모 이름 (`func_def`, `process_flow`, `api_contract`, `domain_data`) 은 **영구 유지** — rollup 루트로 사용되므로 제거 불가.

### Reversibility

Phase C 는 역행 가능:

- `parent_id` 컬럼 제거 + `ASPECT_PARENTS` map 복원 (원본은 vocabulary.ts 에 영속 유지).
- 유저 입력 형식 (frontmatter `aspect: codegen_func`) 은 변하지 않으므로 **유저-facing breaking change 없음**.
- validator 는 map fallback 으로 롤백.

### 비용 추정

| 항목 | 작업 | 예상 공수 |
|---|---|---:|
| Schema migration | parent_id 추가 + bulk populate SQL | 1-2 일 |
| Validator/CLI 업데이트 | parent chain traversal, rollup API | 2-3 일 |
| 문서/테스트 | 회귀 테스트, spec 동기화 | 1 일 |
| **합계** | | **4-6 일** |

### 본 RFC (Phase 5b) 와의 관계

- **Phase 5b RFC 범위** — Phase A (flat 확장) + Phase B-0~B-4 (migration). **ASPECT_PARENTS map 을 Phase B-0 에 포함** 시켜 Phase C 준비를 완료한다.
- **Phase C 는 별도 RFC** — Phase C 개시 시점이 도래하면 `docs/proposals/aspect-hierarchy-schema/` (가칭) 에서 schema migration 을 다룬다. Phase C RFC 는 본 RFC 의 map 을 입력으로 받아 SQL 을 생성한다.
- **A→B-0→C 체인 보장** — 본 RFC 의 명명 컨벤션 (00-design §"명명 컨벤션") 이 Phase C 전환의 기계적 기반이다. 명명 컨벤션 위반 값이 Phase B 이후 추가되면 Phase C migration 이 수동 개입을 요구한다.

## 검증 체크리스트 (모든 단계 공통)

각 단계 완료 후 실행:

```
pnpm --filter definition-catalog build
pnpm --filter definition-catalog test
pnpm exec qa-sdk def sync
pnpm exec qa-sdk def validate
pnpm exec qa-sdk def audit | grep -E "duplicate|errors|warnings"
```

기대 결과:
- errors=0 (모든 단계에서 유지)
- warnings 는 단계별로 점감
- dup-coord 감소가 예상치와 ±1 오차 이내

## 위험 체크포인트

| 위험 | 감지 방법 | 대응 |
|---|---|---|
| 새 aspect 가 VALID_SCOPE_ASPECTS 누락 | `def validate` → `invalid-scope-aspect` 에러 | B-0 즉시 수정 |
| 문서 이동으로 incoming link 깨짐 | `def audit` → `broken-link` 에러 | R1 위험 부재 확인. 링크는 doc id 기반. |
| capacity 경고 | build 시 `nextPowerOf2` 검증 실패 | B-0 에서 capacity 128 로 확장 필수 |
| HIGH 이동 후 dup-coord 감소 부족 | audit 집계가 예상치와 다름 | 배치 중단, 원인 진단 (다른 그룹 영향 여부) |

## 참조

- [00-design.md](./00-design.md) — 제안 분할 상세
- [02-impact.md](./02-impact.md) — 문서별 매핑
- `packages/definition-catalog/src/vocabulary.ts`
- `packages/definition-catalog/src/taxonomy.ts`
- `packages/definition-catalog/src/validate.ts` — `validateScopeAspect`
