---
def:
  id: automation-skill-group
  level: module
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point]
  links:
    - target: skill-e2e-test
      type: contains
    - target: skill-gform-parser
      type: contains
    - target: skill-spec-lifecycle
      type: contains
---


## 탐색 ^navigation

skill-catalog-system > **automation-skill-group**

형제: `claude-skill-group` · `ralph-tui-skill-group` · `dkg-skill-group` · `cli-command-group`

## 목적 ^purpose

테스트 작성, 외부 입력 파싱, 구현 후 문서 정리처럼 작업 산출물을 직접 바꾸는 자동화 스킬을 한 묶음으로 관리한다.

## 구성 ^overview

- `e2e-test` — 시나리오 문서를 Playwright E2E로 변환하고 디버깅
- `gform-parser` — Google Form URL에서 폼 메타데이터와 config/HTML 생성
- `spec-lifecycle` — 구현 완료 후 스펙 문서를 코드 참조 중심으로 전환

## 사용 순서

구현 전에는 `spec-lifecycle`로 문서 전환 조건을 확인하고,
검증 단계에서는 `e2e-test`로 사용자 흐름을 테스트하며,
외부 폼 입력 연동이 있으면 `gform-parser`로 config 생성을 자동화한다.

## 경계 ^boundary

이 문서는 automation 계열 skill의 카탈로그 문서다.
- 실제 skill 정의는 `skills/e2e-test`, `skills/gform-parser`, `skills/spec-lifecycle`
- 운영 플레이북은 `docs/skills/automation-workflows.md`

따라서 실제 프롬프트 표면을 바꾸려면 `skills/`를 수정해야 하고,
이 문서는 왜/언제/어떻게 묶어 쓰는지 설명하는 용도다.
