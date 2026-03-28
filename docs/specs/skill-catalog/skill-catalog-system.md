---
def:
  id: skill-catalog-system
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: claude-skill-group
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

- claude-skill-group: Claude Code skills (def-topdown 등 7개)
- dkg-skill-group: DKG 자동화 skills (cascade 등 5개)
- cli-command-group: CLI 명령 그룹 (def/dkg/flow/coord 4개)

## 피드백 루프 ^feedback

CLI 사용 패턴 → emitCliEvent → 소비율 분석 → skill 문서의 ^feedback 규칙 갱신
- dormant skill (사용률 < 5%) → 폐기 검토 또는 접근성 개선
- hot skill (사용률 > 50%) → 자동화/단축키 후보
- error rate 높은 skill → ^caveat 보강
