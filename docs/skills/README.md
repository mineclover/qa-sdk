---
name: skills-readme
description: "레포 안의 skill 운영 가이드와 skill-catalog 스펙의 진입점. 어떤 guide를 먼저 읽고 어떤 skill spec으로 내려갈지 안내한다."
---

# Skills Guide Index

이 저장소에서 `skill`은 두 종류의 실행 단위를 가리킬 수 있다. 혼용하지 않고 아래 용어를 사용한다.

| 용어 | 뜻 | 소유 위치 | 직접 수정 여부 |
|---|---|---|---|
| **Agent Skill (에이전트 실행 스킬)** | Codex/Claude가 읽어 작업 절차를 수행하는 instruction bundle | `skills/<name>/SKILL.md` | 예 — repo SSOT |
| **Skill runtime copy (실행 복제본)** | 선택한 Agent Skill을 프로젝트 호스트 검색 위치에 전파한 사본 | `.agents/skills/`, `.claude/skills/` | 아니오 — `sync-skills.sh`로만 갱신 |
| **Project skill selection (프로젝트 선택)** | 루트에 기본 노출할 스킬의 이름 목록 | `scripts/project-skills.txt` | 예 — repo SSOT의 설치 범위를 선택 |
| **DKG Operation (DKG 작업)** | DKG 그래프를 조회·변경·분석하는 코드 기반 `SkillDef` 연산 | `packages/dkg`의 SkillDef/구현 | 예 — 해당 코드와 계약을 수정 |
| **CLI command (CLI 명령)** | 사람이 호출하는 실행 표면. Agent Skill과 DKG Operation을 포함해 호출할 수 있음 | `packages/cli/src/commands/` | 예 — 명령 계약을 수정 |
| **Skill playbook (운영 플레이북)** | 어떤 Agent Skill·DKG Operation·CLI 명령을 어떤 순서로 쓸지 설명 | `docs/skills/` | 예 — 사람용 운영 절차를 수정 |
| **Skill catalog entry (스킬 카탈로그 엔트리)** | 위 실행 단위의 목적·관계·피드백을 definition graph에 기록 | `docs/specs/skill-catalog/` | 예 — 메타 스펙을 수정 |

`tool`은 이들을 뭉뚱그려 부르는 말로만 쓴다. 실행 주체를 정확히 말해야 할 때는 반드시 **Agent Skill**, **DKG Operation**, 또는 **CLI command**를 사용한다.

### 저장소 문서 경계

| 디렉토리 | 목적 | 수정하면 바뀌는 것 |
|---------|------|-----------------|
| `skills/` | **Agent Skill 실행 정의** — repo SSOT | 에이전트가 실행하는 프롬프트·트리거·절차 |
| `docs/skills/` | **Skill playbook** — 운영 플레이북 | 사람이 읽는 사용 순서·선택 기준 |
| `docs/specs/skill-catalog/` | **카탈로그 스펙** — 문서 시스템 내 메타데이터 | 목적·맥락·관계·피드백 규칙 |

### 판단 기준

- Agent Skill 동작을 바꾸고 싶다 → `skills/*/SKILL.md` 수정
- Skill playbook의 사용법·조합·선택 기준을 바꾸고 싶다 → `docs/skills/*.md` 수정
- DKG Operation 동작을 바꾸고 싶다 → 해당 `SkillDef`와 구현·계약을 수정
- 실행 단위 간 관계·목적·피드백 규칙을 바꾸고 싶다 → `docs/specs/skill-catalog/*.md` 수정

### 조회 원칙

- 사용자는 Agent Skill을 직접 `skills/*/SKILL.md`로 조회하지 않는다.
- 먼저 `qa-sdk` 명령 진입점 또는 `cli-command-group` 문서를 통해 어떤 표면을 써야 하는지 찾는다.
- `SKILL.md`는 실행 정의 SSOT이지만, 운영/탐색의 1차 진입점은 아니다.

### SSOT 정합성 게이트

스킬을 추가하거나 수정하면 다음 순서로 원본과 실행 위치를 확인한다.

```bash
corepack pnpm skills:check
./scripts/sync-skills.sh --dry-run
./scripts/sync-skills.sh
```

`skills:check`는 모든 `SKILL.md`의 표준 frontmatter, 디렉터리 이름, 본문 크기, 로컬 Markdown 링크를 검사한다. 동기화는 `scripts/project-skills.txt`로 선택한 디렉터리 전체를 `.agents/skills/`(Codex / Antigravity)와 `.claude/skills/`(Claude Code)에 복제한다. `references/`와 `agents/`도 함께 전달하며 사용자 전역에는 쓰지 않는다.

기본 선택은 `arch-governance`, `bdd-contract`, `domain-slice-architecture`, `project-closure-review`, `semantic-change`, `spec-lifecycle` 6개와 문서 검토에 필요한 `def-doctor`, `def-context`, `def-validate` 3개다. 나머지 27개 정의는 `skills/`에 보존하고 필요한 작업에서만 선택한다.

```bash
./scripts/sync-skills.sh --skill e2e-test --skill test-split
# 작업 종료 후 기본 9개로 복원
./scripts/sync-skills.sh
# 동기화 계약 회귀 검사 (격리 임시 repo/HOME 사용)
node --test --test-force-exit scripts/sync-skills.test.mjs
```

`--target codex`와 `--target antigravity`는 공유 프로젝트 경로 `.agents/skills/`를, `--target claude`는 `.claude/skills/`만 갱신한다. 전역/전체 스킬 배포 옵션은 제공하지 않는다. 잘못된 선택이나 검색·백업 루트 심볼릭 링크는 쓰기 전에 거부한다. dry-run은 디렉터리도 만들지 않는다.

업데이트하거나 해제하는 repo-owned 실행 복제본은 `.skill-sync-backups/<run-id>/`의 원래 상대경로에 이동해 보관한다. 복구 시 해당 백업을 원래 프로젝트 경로로 되돌릴 수 있다. `skills/`에 없는 다른 소유자의 로컬 스킬과 `.claude/skills/*.md` legacy 문서는 건드리지 않는다. Claude의 전역 off 예외가 필요하면 실제 호스트가 지원하는 프로젝트 `skillOverrides`를 사용한다. 설치 경로의 정합성 검사는 호스트의 새 세션 발견 확인과 구별한다.

포맷 게이트는 추적 소스 전체를 기준으로 한다. `corepack pnpm format:check`는 생성물과 의존성을 제외한 전체 추적 코드·설정 파일을 검사하고, `corepack pnpm format:check:changed`는 현재 작업 트리의 변경 파일만 빠르게 검사한다. CI나 PR에서는 `corepack pnpm format:check -- --base origin/main`처럼 기준 브랜치를 지정할 수 있다. `corepack pnpm format`은 같은 추적 범위를 실제 정리한다. 문서와 셸 파일의 whitespace는 `git diff --check`로 확인한다.

현재 Agent Skill baseline은 `skills:check` 기준 **36 skills / 45 files**다. 이는 `packages/dkg`의 별도 `SkillDef` 카탈로그인 **40개 DKG Operation**과 다른 집합이므로 합산하지 않는다. Agent Skill의 repo SSOT는 계속 `skills/`이며, catalog entry는 `docs/specs/skill-catalog/`에서 관리한다.

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
- `skills/domain-slice-architecture/SKILL.md`
  Domain Slice Architecture의 데이터 모델, 계약, 로깅, CQRS/BFF, 트랜잭션, 테스트 경계를 재귀적으로 개선하는 실행 루프
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
- `skills/arch-governance/SKILL.md`
  계층 경계, API 영향도, package 사용성, 이벤트 signal 연결을 통합 점검
- `skills/project-closure-review/SKILL.md`
  root/submodule, generated artifact, 검증 결과, 커밋 경계를 작업 종료 단위로 정리
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
- `docs/skills/sub-agent-verify-discipline.md`
  sub-agent dispatch 시 verify-before-complete 룰 (stdout 원문 캡처 + spot-check). superpowers `verification-before-completion` / `dispatching-parallel-agents` 와 결합해 사용

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

## DKG Operation (`SkillDef`, 40개)

CLI에서 `dkg run skill-*`로 실행하는 DKG 그래프 자동화 연산이다. Agent Skill이 아니라 코드·입출력 계약을 가진 런타임 작업이며, 필요하면 Skill playbook이 여러 DKG Operation과 CLI command를 조합한다.

- `dkg skills` — 전체 목록
- `dkg skills <카테고리|키워드>` — 필터링 (예: `dkg skills chain`, `dkg skills checkout`)
- 상세 스펙: `docs/specs/dkg-system/dkg-skill-catalog-registry.spec.md`

## 읽는 순서

1. 작업 유형이 모호하면 이 문서에서 그룹을 고른다.
2. 운영 절차가 필요하면 `docs/skills/*.md` 플레이북을 읽는다.
3. 개별 DKG Operation을 직접 실행하려면 `dkg skills <keyword>`로 탐색한다.
4. 왜 해당 실행 단위를 써야 하는지, 어떤 피드백 규칙이 있는지 알고 싶으면 `docs/specs/skill-catalog/*.md`로 내려간다.
5. Agent Skill 실행 정의는 `skills/*/SKILL.md`가 소유하지만, 조회와 선택은 command entrypoint와 workflow 문서를 먼저 따른다.
6. 코드 파일과 문서 경계를 맞출 때는 `qa-sdk def find-by-file <파일경로[:symbol]>`를 쓴다. 이 명령은 DB의 `code_references`만 보고 결과를 낸다.
7. `code_references`는 문서 frontmatter `source:`와 코드 주석 `@def.boundary[#symbol]`, `@def.doc[#symbol]`를 `qa-sdk def sync`로 정규화해서 만든다. explicit mapping이 없으면 결과를 주지 않는다.
