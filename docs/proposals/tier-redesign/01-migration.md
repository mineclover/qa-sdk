---
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: migration-guide
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/tier-redesign/`의 일부. 아직 정규 스펙이 아닙니다.
> 본 제안이 **accepted**로 승격되면 규칙은 `docs/specs/` 정규 트리로 이식됩니다.
>
> 이전 문서: [00-design](./00-design.md) · 다음 문서: [03-decisions](./03-decisions.md)
>
> **D-17 Pivot 반영**: FSM tier 제거됨. 상태 관리는 [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) 참조.

# STC — 선행 마이그레이션 가이드

## 목적 ^purpose

STC 좌표계(Component / Entry / System / Layout — **4 tier**)가 `deterministic-label-stability` 포함 후속 안정화 작업의 **선행 조건**이라는 결정을 명시하고, 1,046개 문서의 재분류와 도구 전환을 단계별로 수행하기 위한 실행 가이드를 제공한다. 본 가이드는 설계(STC design plan)와 구현(개별 도구/스킬 코드) 사이의 중재 문서다.

## 선행 결정 근거

1. **어휘 일관성** — stability spec 작성 시 Component/System 언어가 확정되지 않으면 code-level 결정이 doc-level 구조와 충돌한다. 특히 stability 결정 2C(`currentState` enum + gateEvidence)는 STC의 Component State + meta-semantic lifecycle 참조 구조로 매핑됨 (D-17).
2. **좌표계 재설계 비용의 단발성** — 1,046 문서의 level→tier 전환은 한 번에 끝내는 편이 점진적 재분류보다 낮은 비용이다.
3. **후속 안정화 작업의 의존성** — CLI surface, service integration, persistence는 모두 안정된 System/Layout 경계를 전제한다. STC가 이 경계의 정의 언어다.
4. **옵션 2(병렬)의 어휘 불일치 기간** 회피 — stability 결정 memo가 과거 어휘로 고정되면 이후 재작성이 필요하다.

## 영향 범위

### 문서 스키마
- `def.level` 필드 → `def.tier` 필드 (교체)
- `def.depth` 필드 → 재정의 또는 제거 판단
- `def.aspect` 유지 (중복 감지 축의 일부)
- `def.layer` 유지

### LinkType
- 기존: `contains` / `depends_on` / `implements` / `refines` / `constrains` / `traces_to`
- 신규: `refs` (Layout이 System을 배치할 때) — 기존 `contains`와 구분 필요
- System은 System을 `contains`하지 않는다 (독립성 원칙)

### 도구
- `qa-sdk def sync` — tier 필드 수집 + 분류 검증
- `qa-sdk def validate` — (tier, scope, layer, aspect) 좌표 유일성 검증
- 신규 명령: `qa-sdk def tier classify`, `qa-sdk def tier suggest`
- skill: `def-level` → `def-tier`로 이관 (별도 skill 또는 갱신)

### 문서
- 1,046개 기존 문서의 tier 재분류
- `docs/skills/`의 level 언급 위치 갱신
- `docs/specs/definition-catalog/` 및 각 서비스 spec의 계층 표현 재검토

## 단계별 실행 계획

### Phase 0 — 설계 결정 고정 (선행)

**산출물**: [03-decisions.md](./03-decisions.md) (Phase 0 결정 메모 — 원래 이름 `semantic-topological-coordinate-decision.memo.md`는 docs/superpowers/specs/에 있던 시점 이름. proposal 이관 시 `03-decisions.md`로 개명)

- STC 채택 확정과 근거 기록
- level→tier 전환 룰 확정 ([00-design.md](./00-design.md) §4 표 기반)
- `refs` LinkType 도입 여부 확정
- `depth` 필드 운명 확정 (유지 / 재정의 / 제거)

**D-17 Pivot 확정 (2026-04-18)** — 근거: [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)
- STC는 **4 tier** (Component / Entry / System / Layout) — FSM tier 제거
- 상태 관리는 meta-semantic 참조: System의 `lifecycle_ref.state_component` + `lifecycle_ref.pipe_refs`
- State enum은 **Component tier**로 분리 (code enum의 SSOT)
- Lifecycle 전이 규칙은 **meta-semantic** 문서 참조 (PipeTransitionScope / Data IR.lifecycle / TransitionDef)
- `def validate` 검증: `lifecycle_ref.state_component` 실존, `pipe_refs` 각 항목 meta-semantic 내 유효

**완료 조건**: memo 작성 + stability-plan에서 cross-ref 가능 + `lifecycle_ref` schema 확정 + Pilot(Phase 3) 검증 가능

### Phase 1 — 스키마 + 도구 준비

#### Phase 1.A — 선행 조사 (Phase 1.B 전 필수)

의존 순서대로 수행. 결과는 memo 또는 evidence JSON으로 보존.

1. **`depth` 필드 사용처 전수 조사** (D-6 영향)
   - `docs/**/*.md` frontmatter의 `depth:` 사용 빈도
   - `depth`를 쿼리/필터/도구가 참조하는지 (grep 대상: `def audit`, skills, scripts)
   - 결과물: `phase-1a-depth-usage-report.md`
   - **의존**: 없음 (독립)

2. **Layout-like `contains` 실사용 사례 조사** (D-4 영향)
   - 현재 `contains` 링크 중 "Layout이 System을 포함"에 해당하는 패턴
   - 자동 감지 기준: `level: group` + 하위가 `module` System일 때
   - 결과물: `phase-1a-layout-contains-report.md` (전환 대상 수 포함)
   - **의존**: 없음 (독립)

3. **Meta-operational 문서 정책 결정** (D-2 확장)
   - `CLAUDE.md`, `.claude/skills/`, `docs/skills/` 등이 tier 체계 적용 대상인지
   - 결정 결과를 D-2 확장 memo로 작성
   - **의존**: 없음 (독립)

4. **자동 분류 룰 초안 작성** (Phase 2 준비)
   - 우선순위 6단계 룰을 실행 가능한 분류기로 정의 (의사결정 트리)
   - 기존 level/scope/aspect 조합 → tier 제안 매핑 테이블
   - **의존**: D-2 확장 결정(3번)이 먼저

#### Phase 1.B — 스키마/도구 구현 (Phase 1.A 완료 후)

의존 순서:

1. **frontmatter zod 스키마 확장** — `tier` 필드 추가 (optional)
   - **의존**: Phase 1.A 결과 (depth/operational 정책 반영)

2. **`refs` LinkType 스키마/validation/DB 지원** — D-4 구현
   - **의존**: 1번 (스키마 인프라 공유)

3. **`lifecycle_ref` schema 검증 로직** — D-17 구현
   - System 문서의 `lifecycle_ref.state_component`가 실존 Component 문서 참조
   - `lifecycle_ref.pipe_refs`의 각 항목이 meta-semantic 내 유효 (pipe 문서 존재 + transitionId 일치)
   - State enum Component의 `states[]` ↔ code enum/타입 일치 (D-9 계승)
   - **의존**: 1번

4. **`def tier classify <path>` 명령** — 자동 분류 실행기
   - Phase 1.A의 분류 룰을 CLI로 노출
   - **의존**: 1번, Phase 1.A 4번

5. **`def validate` 중복 좌표 감지 경고 추가**
   - **의존**: 1번

6. **`def sync`에 `tier` 필드 저장 + 마이그레이션 스크립트**
   - **의존**: 1번

7. **최상위 분류(Design vs Knowledge) 검증 룰 추가 (`def audit`/`def validate`)** — D-19 구현
   - `type: design` (또는 하위 호환을 위한 `type: spec`)인데 설계 확장자(`.spec`, `.rule` 등)가 아니면 경고/에러
   - `type: knowledge`인데 `knowledge_kind` 필드가 없으면 에러
   - Design/Spec 문서에 `knowledge_kind` 사용 시 에러
   - **의존**: 1번

**병행 유지**: `level` 필드는 **deprecated로 표시**하되 계속 동작. 기존 문서는 변경 없이 validate 통과.

**완료 조건**:
- 새로 만드는 문서는 tier 필수
- 기존 문서는 tier 없어도 동작 (warning)
- `def tier classify` dry-run 가능
- Phase 1.A 리포트 3개 + 분류 룰 초안 1개 존재

**실행 흐름 다이어그램** (critical path 3갈래):

```
Phase 1.A (병렬 가능):
  [depth 조사] ──┐
  [contains 조사] ──┼─→ [분류 룰 초안]
  [operational 정책] ─┘        │
                               ↓
Phase 1.B critical path:
  1. [zod 스키마]  (모든 것의 루트)
       ↓
       ├──→ 2. [refs LinkType] → 3. [lifecycle_ref 검증]
       │       (의존 그래프 branch A)
       │
       ├──→ 4. [classify 명령] → 6. [sync 저장]
       │       (의존 그래프 branch B)
       │
       ├──→ 5. [validate 경고]
       │      (의존 그래프 branch C, 독립)
       │
       └──→ 7. [Design/Knowledge 분류 검증]
              (의존 그래프 branch D, 독립)
```

**구현 주의사항 (CLI 제약)**:

- **CLI tsup 번들 제약**: 새 명령 (`def tier classify` 등) 추가 시 static import만 허용 (dynamic import 금지) — [CLAUDE.md § CLI tsup 번들 제약](../../../../CLAUDE.md) 참조
- **async createRuntimeStores**: ingest-server 연계 호출 시 `await` 필수
- 신규 명령은 `packages/cli/src/commands/` 아래 배치, `dist/index.js`로 번들

### Phase 2 — 자동 분류 + 수동 검토 리포트

**산출물**:
- 전체 1,046 문서의 tier 제안 JSON (`docs/specs/definition-catalog/tier-classification.evidence.json` 등)
- 모호 케이스 목록 (예: Layout vs System 경계가 불명확한 문서)
- 분류 충돌 리포트 (예: 같은 좌표 충돌 예상)

**단계 특성**: **관측만**. 실제 frontmatter는 수정하지 않는다.

**완료 조건**:
- 자동 분류 커버리지 ≥ 80% — **근거**: 본 목표는 DKG CON-004(`classificationRate >= 80%`, `CLAUDE.md § DKG Constraints` 참조)를 **참조 지표**로 삼음. 두 체계는 직접 연결되지 않고 독립 분류축이지만, 대규모 자동 분류의 **운영 가능 임계점**으로 80%는 공통 기준. 50~79% 구간은 Exit Criteria에 룰 보강 후 재실행 조건 명시 (03-decisions.md § Exit Criteria)
- 수동 검토 대상이 목록화되어 있음

### Phase 3 — Pilot 영역 전환

**선정 기준**: 
- 규모가 중간 (20~50 문서)
- STC 모든 tier를 포함할 것 (Layout/System/Component/Entry 최소 1건). 상태 관리 System은 meta-semantic 참조 포함
- 후속 작업의 의존성이 높을 것

**권장 Pilot**: `docs/specs/definition-catalog/` (스스로 좌표계를 정의하는 영역 — 자기 참조로 검증 가능)

**산출물**:
- Pilot 영역 전체 tier 확정
- Layout 재귀 동작 검증 (Layout이 System 배치 + 새 Entry derive)
- 긴장점 발견 시 설계 수정 반영 (design plan 업데이트)

**완료 조건**:
- Pilot 영역의 `level` → `tier` 전환 완료
- `def validate` 경고 0건
- System 간 `contains` 없음 확인

### Phase 4 — 전체 전환 (4A + 4B 분할)

Phase 3 Pilot 학습을 전체 적용한 뒤 error 승격을 단행하기 위해 Phase 4를 **두 단계로 분할**. false positive 폭증 Exit Criteria 트리거를 피하기 위한 분할.

#### Phase 4A — 전체 문서 tier 전환 (warning 유지)

**산출물**:
- 나머지 1,000+ 문서 tier 확정
- 각 영역 Layout 문서 도입 (있어야 할 곳에)
- `docs/skills/` 내 level 언급 갱신
- CLAUDE.md의 분해 레벨 섹션 → tier 체계로 교체

**순서**: 의존 그래프 상단부터 (system-root, docs-control-plane 등) → 개별 서비스 → 개별 leaf

**검증**: `def validate`는 여전히 **warning 수준**. error 승격은 Phase 4B로 연기.

**완료 조건 (4A)**:
- 모든 문서에 tier 필드 존재
- `def validate` warning 0건 (error는 아직 활성화 전)
- Phase 3 Pilot 학습을 전체 적용 완료 확인 (체크포인트)

#### Phase 4B — warning → error 승격

**조건**: Phase 4A 완료 후 **2~4주간 observation 기간** 경과 + warning false positive 비율 확인

**산출물**:
- `def validate` warning → error 전환 (D-7.4 승격 시점)
- `level` 필드가 없는 문서 자동 거부
- System-contains-System 금지 / `lifecycle_ref` 참조 유효성 등 error

**Exit Criteria 트리거**: Phase 4B 진입 시 false positive > 10% 측정되면 4A로 롤백, 추가 warning 학습 필요.

**완료 조건 (4B)**:
- `def validate` 전면 통과 (error 포함)
- false positive 비율 < 5%
- 중복 좌표 경고 0건

### Phase 5 — 정착 + 정리

**산출물**:
- `level` 필드 제거 (스키마에서 삭제)
- `depth` 필드 운명 반영 (제거 또는 재정의)
- 도구/스킬의 level 참조 완전 제거
- STC를 전제로 한 새 convention spec (`tier-convention.spec.md` 등)

**완료 조건**:
- `level` 없는 문서가 validate 통과
- 새 문서는 tier 필수, level 불가

## 중간 호환성 (Phase 1~4 동안)

| 상태 | 기존 문서 (level만) | 전환 중 (둘 다) | 전환 완료 (tier만) |
|------|-------------------|----------------|------------------|
| Phase 1 | 통과 (warning) | 통과 | 통과 |
| Phase 2 | 통과 (warning) | 통과 | 통과 |
| Phase 3 | 통과 (warning) | 통과 | 통과 |
| Phase 4 | 경고 → error 전환 | 통과 | 통과 |
| Phase 5 | 불가 | 불가 | 통과 |

Phase 4 중간 시점에 error 전환이 이뤄지므로, 그 전에 Phase 3의 Pilot 학습이 전체 적용된 상태여야 한다.

## Stability 작업 재개 조건

[`deterministic-label-stability.plan`](../../specs/definition-catalog/deterministic-label-stability.plan.md)은 다음 조건을 만족하면 재개 가능하다.

1. **Phase 3 완료** — Pilot 영역(`docs/specs/definition-catalog/`) 전환 완료. stability 관련 모든 문서가 tier 체계로 존재.
2. **STC 언어 고정** — Phase 0 memo가 4 tier + meta-semantic 위임 규칙을 확정 (D-17).
3. **Layout vs System 경계** 확정 — `docs-control-plane`이 System인지 Layout인지 결정되어야 stability spec의 scope가 명확해짐.

재개 시:
- stability plan의 frontmatter를 tier 체계로 업데이트
- stability 결정 1A(content-derived URN)는 유지 — STC와 독립
- stability 결정 2C는 STC Component State + meta-semantic lifecycle 참조로 재표현 (D-17)
- stability 결정 3B는 meta-semantic의 Data IR.lifecycle 또는 PipeTransitionScope 출력으로 매핑

## 위험과 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| Pilot에서 설계 결함 발견 | design plan 수정 필요, Phase 2 재실행 | Phase 3 완료 기준에 "긴장점 발견 시 설계 수정 반영" 명시 |
| 자동 분류 커버리지 < 80% | 수동 검토 비용 증가 | Phase 2 산출물에서 모호 케이스 카테고리별 집계, 룰 보강 |
| stability 작업 지연 | 다른 후속 작업(CLI surface, service integration) 연쇄 지연 | Phase 3까지는 **6주 내 완료** 목표. 초과 시 옵션 2(병렬)로 전환 검토 |
| 기존 level 의존 도구 누락 | 마이그레이션 완료 후에도 동작 |Phase 1에서 `level` 참조 전수 조사 (grep 레포트) |
| Layout 재귀가 실제로는 복잡한 링크만 양산 | STC의 이점 희석 | Phase 3 Pilot에서 실제 Layout 문서 1개 이상 작성 + 재귀 검증 |

## 비목표

- 본 가이드는 STC **설계 결정을 하지 않는다**. 설계는 [00-design.md](./00-design.md)와 [03-decisions.md](./03-decisions.md)가 담당한다.
- 본 가이드는 stability 구현을 **포함하지 않는다**. stability는 재개 조건 충족 후 자기 plan을 따른다.
- 본 가이드는 개별 도구의 코드 수정 방법을 **처방하지 않는다**. 그것은 각 Phase의 구현 PRD가 담당한다.
- 본 가이드는 `depth` 필드의 최종 운명을 **결정하지 않는다** — Phase 0 memo에서 결정한다.

## 다음 산출물

1. `semantic-topological-coordinate-decision.memo.md` — Phase 0의 근거 기록
2. Phase 1 구현 PRD — 스키마/도구 변경
3. `stability-plan`의 frontmatter 업데이트 — 본 가이드를 `depends_on`으로 추가
