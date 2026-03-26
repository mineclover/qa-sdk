---
def:
  id: dkg-skill-group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: skill-dkg-skill-cascade
      type: contains
    - target: skill-dkg-skill-migrator
      type: contains
    - target: skill-dkg-skill-version-event
      type: contains
    - target: skill-dkg-skill-decision
      type: contains
    - target: skill-dkg-skill-catalog
      type: contains
---

## 목적 ^purpose

DKG 그래프 자동화 도구 5종

## 구성 ^overview

- `dkg-skill-cascade`
- `dkg-skill-migrator`
- `dkg-skill-version-event`
- `dkg-skill-decision`
- `dkg-skill-catalog`
