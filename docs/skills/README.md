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

## 주요 진입점

### 운영 플레이북

- `docs/skills/automation-workflows.md`
  `e2e-test`, `gform-parser`, `spec-lifecycle` 사용 순서
- `docs/skills/ralph-tui-workflows.md`
  `ralph-tui-prd` → `create-json/beads/beads-rust` 선택 기준
- `docs/skills/system-review.md`
  self-check / converge / metrics / overview 종합 점검
- `docs/skills/definition-boundary-workflow.md`
  boundary / boundary-context 기준의 문서 경계 정리와 영향 범위 읽기
- `docs/skills/decide.md`
  decision-flow 실행 절차

### Skill Catalog

- `docs/specs/skill-catalog/skill-catalog-system.md`
  전체 그룹 구조
- `docs/specs/skill-catalog/claude-skill-group.md`
  definition-catalog 계열
- `docs/specs/skill-catalog/automation-skill-group.md`
  테스트/파서/문서 전환 자동화
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
5. Claude/Codex skill 실행은 `skills/*/SKILL.md`를 기준으로 한다.
