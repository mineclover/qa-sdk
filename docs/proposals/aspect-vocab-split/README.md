---
def:
  id: aspect-vocab-split-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: aspect-vocab-split-00-design
      type: refs
    - target: aspect-vocab-split-01-migration
      type: refs
    - target: aspect-vocab-split-02-impact
      type: refs
status: under-review
date: 2026-04-21
part_of: aspect-vocab-split
role: index
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/aspect-vocab-split/`. 아직 정규 스펙 아님 — vocabulary/ taxonomy 코드나 프론트매터는 본 제안 수락 전에는 수정하지 않는다.

# Aspect Vocabulary Split — Class D dup-coord 해소 RFC

## 배경

Phase 5d/5e 완료 시점(2026-04-20) 검증 상태: `errors=0`, `warnings=73`, `duplicate-coordinate=17`. 남은 17 그룹의 분포는 다음과 같다.

| aspect | 참여 dup-coord 그룹 수 | 현재 aspect 문서 수 |
|---|---:|---:|
| `func_def` | 7 | 288 |
| `process_flow` | 4 | 142 |
| `api_contract` | 3 | 100 |
| `domain_data` | 2 | 149 |
| `component` | 1 | 26 |

이 중 **16 그룹**이 Phase 5 redesign 이 Class D("Diversify") 로 분류한 사례 — 서로 다른 도메인이 동일한 coarse aspect 를 공유해 좌표가 충돌한다. Phase 5c/5d 에서는 layout 승격·boundary 재지정·proposal 면제로 해소 가능한 부분만 다루었고, Class D 는 "aspect 어휘 자체의 세분화" 를 요구하므로 별도 RFC 로 격리되어 남아 있다.

본 제안은 **Aspect 어휘의 부분적 분할** 을 통해 이 17 그룹 중 최소 12–14 그룹을 해소하고 taxonomy 를 더 정보량 높은 분류 체계로 진화시키는 방안을 제시한다.

## 핵심 주장

1. `func_def`/`process_flow`/`api_contract`/`domain_data` 는 기능/흐름/계약/데이터 의 **최상위 분류** 로만 유효하다. 같은 scope 안에서 실제 의미가 서로 다른 시스템들이 같은 aspect 로 수렴하는 것은 **분류 해상도가 부족** 하다는 신호다.
2. 해상도 증가는 값 치환이 아니라 **값 추가** 로 한다. 기존 값은 "fallback" 으로 잔존시켜 migration 가역성을 보장한다.
3. 기존 17 dup-coord 그룹의 멤버를 근거로 **필요한 만큼만** 쪼갠다. 투기적인 분할은 피한다.
4. 분할 자체는 **비파괴적** 이다. Phase B-0 은 vocabulary 확장만 수행하고 기존 문서에 손대지 않는다. 실제 문서 마이그레이션(Phase B-1~B-3) 은 선택 사항이며 단계적이다.
5. 신규 값은 `{role}_{parent-stem}` **명명 컨벤션** 을 준수한다 (예: `codegen_func` = role `codegen` × parent-stem `func` → parent `func_def`). 이 규율은 지금은 저자의 discipline 이지만, 향후 Phase C (schema 기반 hierarchy) 전환 시 **기계적 migration** 의 기반이 된다. 상세: [00-design.md §명명 컨벤션](./00-design.md).

## 단계적 접근 (A → B-0 → C)

본 RFC 는 **즉시 가치 실현 + 미래 유연성** 의 균형을 위해 다음 단계로 나뉜다.

| Phase | 본 RFC 범위? | 작업 | 목표 |
|---|---|---|---|
| **A. Flat addition** | ✅ | vocabulary 에 17 개 신규 aspect 추가 | non-breaking, 즉시 실행, dup-coord 해소 |
| **B-0. Parent map** | ✅ | `ASPECT_PARENTS` map + `deriveAspectParent` helper 추가 | 부모 조회 가능 + Phase C 준비 완료 |
| **B-1~B-4. Migration** | ✅ | HIGH/MED/LOW 문서 마이그레이션 + (선택) 레거시 deprecation | dup-coord 17 → ≤ 5 |
| **C. Schema hierarchy** | ❌ 별도 RFC | `aspects.parent_id` 컬럼 + bulk populate | native rollup 쿼리 |

Phase C 는 aspect 수 ≥ 40 + rollup 요구 ≥ 5회 발생 시 개시. 상세: [01-migration.md §Phase C](./01-migration.md).

대안 비교 (Flat vs Explicit Map vs Schema vs New Axis) 는 [00-design.md §대안 검토](./00-design.md) 표 참조.

## 제안 요약

| 대상 aspect | 참여 dup-coord 그룹 | 제안 신규 값 | 예상 마이그레이션 문서 수 |
|---|---:|---|---:|
| `func_def` | 7 | `codegen_func`, `harness_func`, `gate_func`, `analyzer_func`, `encoding_func`, `domain_service_func`, `nesting_func` (+ `func_def` fallback) | 약 25 HIGH / 2 MED |
| `process_flow` | 4 | `lifecycle_flow`, `ingest_flow`, `pipeline_flow`, `gate_flow`, `definition_mgmt_flow` (+ `process_flow` fallback) | 약 13 HIGH / 2 MED |
| `api_contract` | 3 | `decode_contract`, `gate_contract`, `query_contract`, `browser_contract`, `pipeline_contract` (+ `api_contract` fallback) | 약 12 HIGH / 3 MED |
| `domain_data` | 2 | `taxonomy_data`, `coordinate_model_data`, `dkg_data` (+ `domain_data` fallback) | 약 6 HIGH / 2 MED |

상세 근거와 각 후보의 의미 구분은 [00-design.md](./00-design.md) §"제안 분할" 에서 다룬다.

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | 배경, 제안 분할, 이름 컨벤션, 리스크, 오픈 질문 |
| [01-migration.md](./01-migration.md) | Phase B-0 ~ B-4 롤아웃 계획, 각 단계의 성공 기준과 롤백 |
| [02-impact.md](./02-impact.md) | 문서별 현재 aspect → 제안 aspect 매핑(17 dup-coord 그룹 전원 포함), confidence 등급 |

## 상태

- 2026-04-21: draft 작성 완료
- 다음 행동: 사람 리뷰 → Phase B-0 vocabulary 추가 승인 여부 판단
- 의존 문서:
  - `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md` (Class D 분류 근거)
  - `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5c-abstract.md` (사전 Class A 처리 내역)
  - `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5d-cleanup.md` (proposal 면제 선례)

## 범위 외

- `user_scenario` / `tech_constraint` / `system_data` / `prefix_schema` 등 다른 aspect 는 dup-coord 에 참여하지 않으므로 본 제안 범위 밖이다.
- `scope` 확장(예: `decode` scope 승격) 은 본 제안이 제시하지 않는다. Open Question Q3 에서 후속 주제로 기록.
- Validator 의 dup-coord 키 구조 자체는 유지한다(여전히 `tier:scope:layer:aspect:domain_root`).

## 참조

- `packages/definition-catalog/src/vocabulary.ts` — `DEF_ASPECT.entries` 확장 대상
- `packages/definition-catalog/src/taxonomy.ts` — `VALID_SCOPE_ASPECTS` 확장 대상
- `docs/specs/definition-catalog/definition-taxonomy.spec.md` — 신규 aspect 의 semantic definition 반영 대상
