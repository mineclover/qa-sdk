---
def:
  tier: component
  id: skill-def-entry-sync
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [documentation, entry-point]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-catalog-system
      type: depends_on
sources:
  - skills/def-entry-sync/SKILL.md
---

# Skill — def-entry-sync

## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-entry-sync**

## 목적 ^purpose

기능 추가나 구조 변경 후 root entry 문서, docs/skills index, 관련 skill-catalog spec이 함께 갱신되도록 하는 동기화 루틴이다.

## 사용 맥락 ^context

새 CLI surface, 새 skill, 새 system/module 문서가 생겼는데 사용자가 어디서 시작해야 할지 불분명할 때 사용한다.

## 피드백 규칙 ^feedback

- entry 문서가 최신인데 `docs explore`가 빈약하면 contains/refines 링크 또는 family-only scope를 점검한다.
- skill 실행 정의를 바꾸면 `scripts/sync-skills.sh` 실행 여부를 확인한다.

## 관련 소스

- `skills/def-entry-sync/SKILL.md`

