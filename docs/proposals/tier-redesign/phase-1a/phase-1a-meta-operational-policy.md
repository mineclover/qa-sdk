---
def:
  id: tier-redesign-phase-1a-phase-1a-meta-operational-policy
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: phase-1a-evidence
supersedes: -
superseded_by: -
---

# Phase 1.A — Meta-operational 문서 정책 조사

> 근거: 독립 에이전트 전수 조사 (2026-04-18). specs/ 바깥 경계 문서 116개 분류.

## 요약

specs/ 바깥 경계 문서는 **116개 · 6 카테고리**로 분류된다. 대부분 frontmatter 미사용 또는 `type: knowledge` 최소 메타데이터만 보유. tier 축이 의미 없는 운영/지시/task 성격. **권고: D-2 기본(specs/ 한정)을 유지 + "meta-operational exempt by design" 명시적 선언**으로 경계를 성문화.

## A. 경계 문서 목록 (116건, specs/ 제외)

| 카테고리 | 파일 수 | 대표 경로 | 현재 frontmatter |
|---------|--------|----------|----------------|
| Root docs | 5 | `CLAUDE.md`, `AGENTS.md`, `README.md` | 거의 없음 |
| docs/ 최상위 | 17 | `definition-system-philosophy.md`, `architecture-decisions.md`, `CONVENTIONS.md` | `type: knowledge` 8건 |
| docs/skills/ | 11 | 운영 플레이북 (workflow 가이드) | `name` / `description` 만 |
| skills/ SSOT | 28 | `skills/*/SKILL.md` | 없음 |
| tasks/ | 47 | PRD 26건 + archive 21건 | `[PRD]` 마크만 |
| .claude/ | 8 | memory / settings / skills 미러 | 없음 |

**참고**: `docs/specs/` ~1,064건은 조사 범위 외 (D-2 기본 정책으로 tier 적용 확정).

## B. 성격 분류

| 카테고리 | 주 독자 | 재분해 대상 | scope/aspect 의미 | tier 축 적합성 |
|---------|-------|-----------|------------------|--------------|
| Root docs | LLM + 사람 | 아니오 (atomic 지시) | 없음 | ✗ 없음 |
| docs/ 최상위 | 사람 + LLM | 일부 (철학 chain) | 약함 | ✗ knowledge로 충분 |
| docs/skills/ | LLM + 사람 | 아니오 (선형 workflow) | 없음 | ✗ 운영 plays |
| skills/ SSOT | LLM | 아니오 (atomic operation) | 없음 | ✗ task catalog |
| tasks/ PRD | LLM + 사람 | 아니오 (self-contained feature) | 약함 | ✗ time-bound |
| .claude/ | harness | 아니오 (session state) | 없음 | ✗ metadata |

## C. 옵션 비교

| 옵션 | 적용 범위 | 구현 비용 | 일관성 | 운영 부담 | 판정 |
|------|---------|--------|-------|---------|------|
| 1. 전면 적용 | 모든 문서 tier | **매우 높음** | 매우 높음 | 매우 높음 | ✗ 불권장 |
| 2. **specs/ 한정 (현행)** | docs/specs/만 | **낮음** | 중간 | **낮음** | ✓ **권장** |
| 3. skills/ Layout 편입 | specs/ + docs/skills/ | 중간 | 중간 | 중간 | ✗ Layout 본의와 부조화 |
| 4. meta-operational tier 신설 | 운영 문서 전용 5번째 tier | 높음 | 높음 | 높음 | ✗ D-17 직후 tier 증가는 신호 악화 |

**옵션 1 불권장**: Root docs/PRD는 architecture tier와 직교성 없음. 지속 결정 오버헤드 커짐.
**옵션 3 불권장**: Layout tier 본의는 "여러 System 배치"인데 docs/skills/는 workflow 순서 — 의미 부조화.
**옵션 4 불권장**: D-17에서 FSM tier 제거한 직후 tier 증가는 일관성 신호를 해침. lifecycle/role 필드로 충분.

## 권고 (D-2 확장 결정문 초안)

**D-2-Extended: Operational Meta-documents Exempt by Design**

> tier 필드는 `docs/specs/` 내 `type: spec` 문서에만 **필수**. 아래 6 카테고리는 설계상 tier 적용 대상이 **아니며 (exempt by design)**, 기존 분류축(lifecycle / role / type: knowledge 등)으로 충분히 표현된다.

| # | 카테고리 | 근거 |
|---|---------|------|
| 1 | Root project docs (`CLAUDE.md`, `AGENTS.md`, `README.md`) | 프로젝트 지시/초기화. Architecture composition 대상 아님 |
| 2 | Knowledge docs outside specs/ (`docs/*.md` — type: knowledge) | D-2 기본. 철학/ADR/패턴은 tier 계층 불필요 |
| 3 | Operational playbooks (`docs/skills/*`) | workflow 플레이북. "언제 어떤 skill을 쓸지" 의사결정 가이드 |
| 4 | Skill execution definitions (`skills/*/SKILL.md`) | task/operation catalog. SSOT는 메타데이터(name/description)만 보유 |
| 5 | Task/roadmap records (`tasks/**`) | time-bound PRD. lifecycle → archive로 종료, architecture 아님 |
| 6 | System configuration (`.claude/**`, settings) | 메타데이터 자체. tier 개념 미적용 |

**검증**: `def validate`는 위 카테고리의 tier missing을 **pass** (기본) 또는 warn(선택). error 승격 금지.

**가역성**: high — 정책 선언만, 기존 문서 변경 불필요.

**03-decisions.md 반영 위치**: D-2 본문 하단 "D-2-Extended" 섹션으로 추가.

## 미확실 / 후속 조사 필요

1. **docs/ 최상위 type 통일** — 현재 `type: knowledge` 8건 / 없음 9건. Phase 1.B 또는 별도 docs 정규화 단계에서 통일 권고
2. **tasks/ PRD의 formal type** — `type: task` 신규 도입 vs 기존 형식 유지. 영향 작음, lifecycle 추적 개선 시 검토
3. **`.claude/memory` 정식 분류** — 완전 exempt vs `type: metadata`. 현재는 exempt 권장 (도구 간섭 최소화)
