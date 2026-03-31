---
def:
  id: skill-catalog-system
  level: module
  address: def_document:v2:68645
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
---

## 목적 ^purpose

사용자가 시스템과 상호작용하는 모든 skill/CLI 도구를 experience 계층으로 관리한다.
각 skill 문서에는 코드에서 파생할 수 없는 의도/맥락/피드백 규칙을 기록한다.

## 구성 ^overview

- claude-skill-group: definition-catalog 중심 스킬 12개
- automation-skill-group: 구현/테스트/문서 전환 보조 스킬 3개
- ralph-tui-skill-group: PRD/작업 생성용 ralph-tui 스킬 4개
- dkg-skill-group: DKG 그래프 자동화 39개 (read 5, write 5, analysis 26, chain 3)
- cli-command-group: CLI 명령 그룹 (def/dkg/flow/coord 4개)

## 3디렉토리 경계 ^boundary

"skill"이라는 이름이 들어간 디렉토리가 3개 있다. 각각 **목적, SSOT, 수정 기준**이 다르다.

| 디렉토리 | 목적 | SSOT | 수정하면 바뀌는 것 |
|---------|------|------|-----------------|
| `skills/` | 실행 정의 | Claude/Codex skill의 유일한 원본 | 에이전트가 실행하는 프롬프트·트리거·절차 |
| `docs/skills/` | 사용 가이드 | 운영 플레이북 (워크플로우 조합 설명) | 사람이 읽는 사용 순서·선택 기준 |
| `docs/specs/skill-catalog/` | 카탈로그 스펙 | 문서 시스템 내 skill 메타데이터 | 목적·맥락·관계·피드백 규칙 (def frontmatter) |

### 판단 기준

- skill 동작을 바꾸고 싶다 → `skills/*/SKILL.md` 수정
- skill 사용법·조합·선택 기준을 바꾸고 싶다 → `docs/skills/*.md` 수정
- skill 간 관계·목적·피드백 규칙을 바꾸고 싶다 → `docs/specs/skill-catalog/*.md` 수정

### 조회 원칙

- skill 조회는 command entrypoint를 통해 간접적으로 수행한다.
- `qa-sdk def ...`, `qa-sdk quality ...`, `qa-sdk dkg skills ...` 같은 명령 표면이 1차 진입점이다.
- `skills/*/SKILL.md`는 구현 SSOT이지만, 사용자와 운영자가 직접 뒤지는 탐색 표면이 아니다.

### 주의

- `skills/`와 `docs/skills/`는 이름이 비슷하지만 역할이 다르다. 전자는 실행 정의, 후자는 운영 설명
- `docs/specs/skill-catalog/`은 Claude skill과 DKG skill을 모두 추적한다. SSOT 소스가 다를 뿐 카탈로그 관점에서는 같은 experience 계층
  - Claude skill: `skills/*/SKILL.md`가 SSOT → 카탈로그는 메타데이터 추적
  - DKG skill: `demo-dkg-config.ts` SkillDef[]가 SSOT → 카탈로그는 메타데이터 추적

## 피드백 루프 ^feedback

CLI 사용 패턴 → emitCliEvent → 소비율 분석 → skill 문서의 ^feedback 규칙 갱신
- dormant skill (사용률 < 5%) → 폐기 검토 또는 접근성 개선
- hot skill (사용률 > 50%) → 자동화/단축키 후보
- error rate 높은 skill → ^caveat 보강
