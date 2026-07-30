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
  - packages/cli/src/commands/dkg.ts
  - packages/cli/src/commands/dkg.e2e.test.ts
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
- 로컬 SQLite 기록은 중앙 ingest와 독립적으로 먼저 보존된다.
- 중앙 ingest forwarding은 명령 종료 전에 완료를 기다리지만 best-effort이며, 네트워크 오류와 HTTP
  non-2xx 응답은 원본 명령을 실패시키지 않는다. `QA_CLI_AUDIT_WARN=1` 또는 `DEBUG`에서만 경고를
  출력하고, HTTP 오류는 응답 상태를 함께 표시한다.
- `QA_CLI_AUDIT_INGEST_URL`과 `INGEST_URL`은 base URL 또는 `/v1/ingest` endpoint를 받을 수 있으며,
  끝의 `/`는 정규화한다.

## 관련 소스

- `skills/dkg-audit/SKILL.md`
- `packages/cli/src/commands/dkg.ts` — audit record 보존과 ingest forwarding
- `packages/cli/src/commands/dkg.e2e.test.ts` — 성공·HTTP 오류 forwarding 회귀
