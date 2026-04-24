---
def:
  id: governance-skill-group
  tier: system
  level: group
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [entry-point, governance]
  links:
    - target: skill-dkg-audit
      type: contains
    - target: skill-semantic-change
      type: contains
    - target: skill-catalog-system
      type: depends_on
---

# Governance Skill Group

## 탐색 ^navigation

skill-catalog-system > **governance-skill-group**

## 목적 ^purpose

구조 변경과 감사 추적처럼 validator green만으로는 충분하지 않은 운영/거버넌스 루틴을 묶는다.

## 구성 ^overview

- `semantic-change` — 좌표/링크 semantic 변경의 L1-L4 cascade 검증
- `dkg-audit` — DKG CLI lifecycle/audit event와 local/central forwarding 점검

## 경계 ^boundary

실행 정의는 `skills/semantic-change/SKILL.md`와 `skills/dkg-audit/SKILL.md`가 소유한다. 이 문서는 구조 변경 전후에 어떤 점검 skill을 선택할지 설명한다.

