---
def:
  id: spec-reference-system
  tier: system
  address: def_document:v2:273411
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, entry-point]
  links:
    - target: spec-linking-rules
      type: contains
    - target: axis-boundary-criteria
      type: contains
    - target: axis-boundary-patterns
      type: contains
    - target: axis-consumption-patterns
      type: contains
---

# Spec Reference 그룹

## 목적 ^purpose

스펙 문서 참조 규칙과 axis 판정 기준을 링크 표준, 분류표, 적용 패턴 문서로 분리해 설계 기준선을 안정화한다.

## 구성 ^overview

- `spec-linking-rules`: 문서 유형별 필수 참조와 관계 방향을 정리한 문서.
- `axis-boundary-criteria`: 무엇이 axis인지 판단하는 기준과 분류표를 정리한 문서.
- `axis-boundary-patterns`: prefix 재설계와 자동 태깅 패턴 같은 적용 사례를 정리한 문서.

원본: `docs/specs/spec-engine/spec-linking-standard.md` (`spec-linking-standard`), `docs/specs/spec-engine/axis-boundary.md` (`axis-boundary-spec`)
