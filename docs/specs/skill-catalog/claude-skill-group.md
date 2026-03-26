---
def:
  id: claude-skill-group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: skill-def-topdown
      type: contains
    - target: skill-def-bottomup
      type: contains
    - target: skill-def-context
      type: contains
    - target: skill-def-audit
      type: contains
    - target: skill-def-new
      type: contains
    - target: skill-def-link
      type: contains
    - target: skill-def-split
      type: contains
---

## 목적 ^purpose

Claude Code에서 사용하는 definition-catalog 관리 도구 7종

## 구성 ^overview

- `def-topdown`
- `def-bottomup`
- `def-context`
- `def-audit`
- `def-new`
- `def-link`
- `def-split`
