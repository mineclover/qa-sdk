---
def:
  id: automation-skill-group
  tier: system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point, cross-scope]
  links:
    - target: skill-bdd-contract
      type: contains
    - target: skill-e2e-test
      type: contains
    - target: skill-gform-parser
      type: contains
    - target: skill-spec-lifecycle
      type: contains
    - target: skill-event-taxonomy-gate
      type: contains
    - target: skill-catalog-system
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > **automation-skill-group**

형제: `claude-skill-group` · `ralph-tui-skill-group` · `dkg-skill-group` · `cli-command-group`

## 목적 ^purpose

테스트 작성, 외부 입력 파싱, 구현 후 문서 정리처럼 작업 산출물을 직접 바꾸는 자동화 스킬을 한 묶음으로 관리한다.

## 구성 ^overview

- `e2e-test` — 시나리오 문서를 Playwright E2E로 변환하고 디버깅
- `bdd-contract` — Given/When/Then을 행동 계약으로 정규화하고 테스트/구현 단위를 도출
- `gform-parser` — Google Form URL에서 폼 메타데이터와 config/HTML 생성
- `spec-lifecycle` — 구현 완료 후 스펙 문서를 코드 참조 중심으로 전환
- `event-taxonomy-gate` — registry event taxonomy 운영 게이트 실행

## 사용 순서

구현 전에는 `bdd-contract`로 행동 계약과 테스트/구현 단위를 먼저 고정하고,
브라우저 검증 단계에서는 `e2e-test`로 사용자 흐름을 테스트하며,
구현 완료 후에는 `spec-lifecycle`로 문서 전환 조건을 확인하고,
외부 폼 입력 연동이 있으면 `gform-parser`로 config 생성을 자동화한다.
운영 정합성 점검이 필요하면 `event-taxonomy-gate`를 별도로 실행한다.

## 경계 ^boundary

이 문서는 automation 계열 skill의 카탈로그 문서다.
- 실제 skill 정의는 `skills/e2e-test`, `skills/gform-parser`, `skills/spec-lifecycle`
- 운영 플레이북은 `docs/skills/automation-workflows.md`
- representative workflow 검증은 `packages/cli/src/skills-workflows.test.ts`와 `packages/cli/src/scenarios.e2e.test.ts`가 담당

따라서 실제 프롬프트 표면을 바꾸려면 `skills/`를 수정해야 하고,
이 문서는 왜/언제/어떻게 묶어 쓰는지 설명하는 용도다.
