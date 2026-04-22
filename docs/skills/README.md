---
name: skills-readme
description: "레포 안의 skill 운영 가이드와 skill-catalog 스펙의 진입점. 어떤 guide를 먼저 읽고 어떤 skill spec으로 내려갈지 안내한다."
---

# Skills Guide Index

"skill"이 들어간 디렉토리가 3개 있다. 각각 목적이 다르다.

| 디렉토리 | 목적 | 수정하면 바뀌는 것 |
|---------|------|-----------------|
| `skills/` | **실행 정의** — Claude/Codex skill의 SSOT | 에이전트가 실행하는 프롬프트·트리거·절차 |
| `docs/skills/` | **사용 가이드** — 운영 플레이북 | 사람이 읽는 사용 순서·선택 기준 |
| `docs/specs/skill-catalog/` | **카탈로그 스펙** — 문서 시스템 내 메타데이터 | 목적·맥락·관계·피드백 규칙 |

### 판단 기준

- skill 동작을 바꾸고 싶다 → `skills/*/SKILL.md` 수정
- skill 사용법·조합·선택 기준을 바꾸고 싶다 → `docs/skills/*.md` 수정
- skill 간 관계·목적·피드백 규칙을 바꾸고 싶다 → `docs/specs/skill-catalog/*.md` 수정

### 조회 원칙

- 사용자는 skill을 직접 `skills/*/SKILL.md`로 조회하지 않는다.
- 먼저 `qa-sdk` 명령 진입점 또는 `cli-command-group` 문서를 통해 어떤 표면을 써야 하는지 찾는다.
- `SKILL.md`는 실행 정의 SSOT이지만, 운영/탐색의 1차 진입점은 아니다.

## 계층(L1-L4) 관점 skill navigation

계층 모델 SSoT: `docs/specs/system/layer-separation.rule.md` (L1 data / L2 validator / L3 workflow / L4 tooling).

### 처음 시작 (onboarding)

1. `qa-sdk def doctor` — 통합 진단. 모든 layer 한번에 확인 (Core/Domains/Aspects/Annotations 4 섹션 = 계층 4개 대응).
2. `qa-sdk def audit --by-domain` — 서비스 도메인 인벤토리 (L3).
3. `qa-sdk def topdown <root>` — 도메인 드릴다운 (L3).
4. `qa-sdk def context <doc>` — 개별 문서 정합성 확인 (L3 + L2 파생).

### Layer 별 작업

- **L1 Data** — frontmatter + 링크: `def-new`, `def-link`, `def-tier`, `def-split`, `def-level`
- **L2 Validator** — validateGraph + 불변식: `def-validate`, `aspect-parents` invariant tests
- **L3 Workflow** — CLI + 사용자 경험: `def-explore`, `def-topdown`, `def-audit`, `def-context`, `def-doctor`, `def-boundary`, `def-bottomup`
- **L4 Tooling** — `@def.boundary` 주석 + 외부 도구: 전용 skill 없음 (`link-type-usage.rule.md` 와 `def-validate` 의 `invalid-code-boundary` / `ambiguous-code-boundary` 진단 참조)

### Structural change

- `semantic-change` (필수) — L1/L2/L3/L4 cascade 체크리스트. 좌표/링크 semantic 변경 시 Option B 재발 방지.
- 관련 rule:
  - `docs/specs/system/layer-separation.rule.md` — 4-layer 책임 모델
  - `docs/specs/system/change-simulation-precedence.rule.md` — Phase 0 시뮬레이션 선행
  - `docs/specs/system/link-type-usage.rule.md` — 9 종 linkType 결정 매트릭스
  - `docs/specs/system/validator-suppression-tags.rule.md` — 억제 수단 전수

## 주요 진입점

### 운영 플레이북

- `docs/skills/automation-workflows.md`
  `bdd-contract`, `e2e-test`, `gform-parser`, `spec-lifecycle`, `event-taxonomy-gate` 사용 순서
- `skills/event-taxonomy-gate/SKILL.md`
  registry event taxonomy의 migrate/check/assert 운영 게이트
- `skills/dkg-audit/SKILL.md`
  `dkg audit-events`, 로컬 `~/.qa-sdk/state.sqlite`, 중앙 ingest forwarding 점검
- `docs/skills/ralph-tui-workflows.md`
  `ralph-tui-prd` → `create-json/beads/beads-rust` 선택 기준
- `docs/skills/system-review.md`
  self-check / converge / metrics / overview 종합 점검
- `docs/skills/definition-boundary-workflow.md`
  boundary / boundary-context 기준의 문서 경계 정리와 영향 범위 읽기
- `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`
  programming artifact ontology 작업 전 context 확인 순서와 handoff 규칙
- `skills/def-entry-sync/SKILL.md`
  기능 추가 뒤 root entry 문서와 skill index를 같이 갱신하는 체크리스트
- `qa-sdk def body <문서ID>`
  boundary/context 요약만으로 부족할 때 최신 본문 전체 확인
- `docs/specs/definition-catalog/definition-mgmt-verification-loop.spec.md`
  build / sync / validate / audit / quality / vitest 회귀의 표준 검증 루프
- `skills/def-doctor/SKILL.md`
  definition-catalog 통합 헬스체크 — onboarding 및 pre-commit 시 가장 먼저 실행하는 진입점 (`qa-sdk def doctor`)
- `skills/semantic-change/SKILL.md`
  좌표/링크 semantic 변경 체크리스트 — Option B 사례를 재사용 가능한 4-계층 검증 절차로 고정
- `docs/specs/system/layer-separation.rule.md`
  L1 data / L2 validator / L3 workflow / L4 tooling 4 계층 책임 + workflow smoke 원칙 (Phase 3b Option B 재발 방지)
- `docs/specs/system/change-simulation-precedence.rule.md`
  구조 변경 시 Phase 0 시뮬레이션 선행 규율 — semantic-change Step 2 의 근거
- `docs/specs/system/validator-suppression-tags.rule.md`
  validator 경고 억제 수단 전수 목록 — def-validate / def-audit 의 suppression 판단 근거
- `docs/specs/definition-catalog/definition-frontmatter-metadata-system.spec.md`
  frontmatter metadata option catalog — `tier/type/owner_system/scope/aspect/depth/lifecycle/links/source` 같은 option 하나하나의 의미와 검증 소유자
- `docs/skills/decide.md`
  decision-flow 실행 절차

### Skill Catalog

- `docs/specs/skill-catalog/skill-catalog-system.md`
  전체 그룹 구조
- `docs/specs/skill-catalog/claude-skill-group.md`
  definition-catalog 계열
- `docs/specs/skill-catalog/automation-skill-group.md`
  테스트/파서/문서 전환 자동화
- `docs/specs/skill-catalog/infra-skill-group.md`
  로컬 인프라 배포/조회/export/status
- `docs/specs/skill-catalog/governance-skill-group.md`
  semantic-change와 DKG audit 같은 구조 거버넌스
- `docs/specs/skill-catalog/ralph-tui-skill-group.md`
  ralph-tui PRD/작업 생성

## DKG Skill (39개)

CLI에서 `dkg run skill-*`로 실행하는 DKG 그래프 자동화 도구. 운영 플레이북의 각 단계를 개별 skill로 직접 실행할 수 있다.

- `dkg skills` — 전체 목록
- `dkg skills <카테고리|키워드>` — 필터링 (예: `dkg skills chain`, `dkg skills checkout`)
- 상세 스펙: `docs/specs/dkg-system/dkg-skill-catalog-registry.spec.md`

## 읽는 순서

1. 작업 유형이 모호하면 이 문서에서 그룹을 고른다.
2. 운영 절차가 필요하면 `docs/skills/*.md` 플레이북을 읽는다.
3. 개별 단계를 skill로 직접 실행하려면 `dkg skills <keyword>`로 탐색한다.
4. 왜 그 skill을 써야 하는지, 어떤 피드백 규칙이 있는지 알고 싶으면 `docs/specs/skill-catalog/*.md`로 내려간다.
5. 실제 실행 정의는 `skills/*/SKILL.md`가 소유하지만, 조회와 선택은 command entrypoint와 workflow 문서를 먼저 따른다.
6. 코드 파일과 문서 경계를 맞출 때는 `qa-sdk def find-by-file <파일경로[:symbol]>`를 쓴다. 이 명령은 DB의 `code_references`만 보고 결과를 낸다.
7. `code_references`는 문서 frontmatter `source:`와 코드 주석 `@def.boundary[#symbol]`, `@def.doc[#symbol]`를 `qa-sdk def sync`로 정규화해서 만든다. explicit mapping이 없으면 결과를 주지 않는다.
