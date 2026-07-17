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
    - target: skill-arch-governance
      type: contains
    - target: skill-project-closure-review
      type: contains
    - target: skill-catalog-system
      type: depends_on
sources:
  - skills/dkg-audit/SKILL.md
  - skills/semantic-change/SKILL.md
  - skills/arch-governance/SKILL.md
  - skills/project-closure-review/SKILL.md
  - packages/cli/src/commands/dkg.ts
---

# Governance Skill Group

## 탐색 ^navigation

skill-catalog-system > **governance-skill-group**

## 목적 ^purpose

구조 변경, 감사 추적, 아키텍처 영향 분석, 작업 종료처럼 validator green만으로는 충분하지 않은 운영/거버넌스 루틴을 묶는다.

## 구성 ^overview

- `semantic-change` — 좌표/링크 semantic 변경의 L1-L4 cascade 검증
- `dkg-audit` — DKG CLI lifecycle/audit event와 local/central forwarding 점검
- `arch-governance` — 계층 경계, API 영향, package 사용성, event signal 연결 분석
- `project-closure-review` — root/submodule 상태, generated artifact, 검증 결과, 커밋 경계 정리

## 경계 ^boundary

실행 정의는 `skills/semantic-change/SKILL.md`, `skills/dkg-audit/SKILL.md`, `skills/arch-governance/SKILL.md`, `skills/project-closure-review/SKILL.md`가 소유한다. 이 문서는 구조 변경과 작업 종료 전후에 어떤 점검 skill을 선택할지 설명한다.
