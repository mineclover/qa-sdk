---
def:
  tier: component
  id: skill-dkg-audit
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [audit, dkg]
  links:
    - target: governance-skill-group
      type: refines
sources:
  - skills/dkg-audit/SKILL.md
---

# Skill — dkg-audit

## 탐색 ^navigation

skill-catalog-system > governance-skill-group > **skill-dkg-audit**

## 목적 ^purpose

DKG CLI lifecycle/audit 이벤트가 로컬 SQLite와 중앙 ingest forwarding 경로에서 추적되는지 점검한다.

## 사용 맥락 ^context

`dkg spec add`, `dkg version`, `dkg audit-events` 결과가 실제 감사 로그로 남는지 확인할 때 사용한다.

## 피드백 규칙 ^feedback

- 로컬에는 있는데 중앙 ingest에 없으면 `QA_CLI_AUDIT_INGEST_URL`와 `/v1/ingest` 경로를 확인한다.

## 관련 소스

- `skills/dkg-audit/SKILL.md`

