---
def:
  id: skill-catalog-system
  address: def_document:v2:68645
  level: group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: claude-skill-group
      type: contains
    - target: automation-skill-group
      type: contains
    - target: ralph-tui-skill-group
      type: contains
    - target: dkg-skill-group
      type: contains
    - target: cli-command-group
      type: contains
    - target: infra-skill-group
      type: contains
    - target: governance-skill-group
      type: contains
sources:
  - scripts/sync-skills.sh
  - packages/cli/src/skills-workflows.test.ts
  - skills/def-context/SKILL.md
  - skills/arch-governance/SKILL.md
  - skills/project-closure-review/SKILL.md
---

## 목적 ^purpose

사용자가 시스템과 상호작용하는 Agent Skill, DKG Operation, CLI command를 experience 계층에서 관리한다.
각 catalog entry에는 코드에서 파생할 수 없는 의도·맥락·피드백 규칙을 기록한다.

## 구성 ^overview

- claude-skill-group: definition-catalog 중심 Agent Skill 16개 (legacy ID)
- automation-skill-group: 구현/테스트/문서 전환/운영 게이트/아키텍처 slice 보조 스킬 8개
- ralph-tui-skill-group: PRD/작업 생성용 ralph-tui 스킬 4개
- dkg-skill-group: DKG 그래프 자동화 40개 (read 5, write 5, analysis 27, chain 3)
- cli-command-group: CLI 명령 그룹 (def/dkg/flow/coord 4개)
- infra-skill-group: 로컬 인프라 배포/조회/export/status 스킬 4개
- governance-skill-group: 아키텍처/감사/semantic-change/작업 종료 거버넌스 스킬 4개

### 실행 정의 baseline

서로 다른 두 skill 집합을 같은 수로 세지 않는다.

| 원본 | 현재 수 | 확인 명령 | 의미 |
|---|---:|---|---|
| `skills/*/SKILL.md` | 36 skills / 45 files | `corepack pnpm skills:check` | Agent Skill 실행 정의 SSOT |
| `packages/dkg` SkillDef | 40 operations | `qa-sdk dkg skills` | DKG Operation 런타임 카탈로그 |

첫 행의 36개는 그룹별로 `claude 16 + automation 8 + ralph-tui 4 + infra 4 + governance 4`로 구성된다. 두 번째 행은 별도 런타임 카탈로그이므로 첫 행의 분모에 합산하지 않는다.

## 용어와 저장소 경계 ^boundary

표준 용어의 전체 정의는 [`docs/skills/README.md`](../../skills/README.md)를 따른다. 이 문서는 catalog 관점의 저장소 경계만 고정한다.

| 디렉토리 | 목적 | SSOT | 수정하면 바뀌는 것 |
|---------|------|------|-----------------|
| `skills/` | Agent Skill 실행 정의 | Agent Skill의 유일한 repo 원본 | 에이전트가 실행하는 프롬프트·트리거·절차 |
| `docs/skills/` | Skill playbook | 운영 절차의 소유 문서 | 사람이 읽는 사용 순서·선택 기준 |
| `docs/specs/skill-catalog/` | 카탈로그 스펙 | 문서 시스템 내 skill 메타데이터 | 목적·맥락·관계·피드백 규칙 (def frontmatter) |

### 판단 기준

- Agent Skill 동작을 바꾸고 싶다 → `skills/*/SKILL.md` 수정
- Skill playbook의 사용법·조합·선택 기준을 바꾸고 싶다 → `docs/skills/*.md` 수정
- DKG Operation 동작을 바꾸고 싶다 → 해당 `SkillDef`와 구현·계약을 수정
- 실행 단위 간 관계·목적·피드백 규칙을 바꾸고 싶다 → `docs/specs/skill-catalog/*.md` 수정

### 조회 원칙

- Agent Skill 조회는 command entrypoint를 통해 간접적으로 수행한다.
- `qa-sdk def ...`, `qa-sdk quality ...`, `qa-sdk dkg skills ...` 같은 명령 표면이 1차 진입점이다.
- `skills/*/SKILL.md`는 구현 SSOT이지만, 사용자와 운영자가 직접 뒤지는 탐색 표면이 아니다.

### 주의

- `skills/`와 `docs/skills/`는 이름이 비슷하지만 역할이 다르다. 전자는 Agent Skill 실행 정의, 후자는 Skill playbook이다.
- `docs/specs/skill-catalog/`은 Agent Skill과 DKG Operation을 모두 추적한다. 원본과 실행 모델이 다르므로 수량을 합산하거나 서로의 수정 대상으로 취급하지 않는다.
  - Agent Skill: `skills/*/SKILL.md`가 SSOT → 카탈로그는 메타데이터를 추적
  - DKG Operation: `SkillDef[]`와 구현이 SSOT → 카탈로그는 메타데이터를 추적
- `claude-skill-group`은 기존 definition graph ID다. 새 문장에서는 **Agent Skill group**이라 부르고, ID·경로·링크를 바꾸지 않는다.

## 피드백 루프 ^feedback

CLI 사용 패턴 → emitCliEvent → 소비율 분석 → skill 문서의 ^feedback 규칙 갱신
- dormant skill (사용률 < 5%) → 폐기 검토 또는 접근성 개선
- hot skill (사용률 > 50%) → 자동화/단축키 후보
- error rate 높은 skill → ^caveat 보강
