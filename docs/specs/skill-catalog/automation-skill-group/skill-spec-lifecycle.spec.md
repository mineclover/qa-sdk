---
def:
  tier: component
  id: skill-spec-lifecycle
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [documentation]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-def-state
      type: depends_on
    - target: skill-def-new
      type: depends_on
sources:
  - skills/spec-lifecycle/SKILL.md
---


## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-spec-lifecycle**

형제: `skill-e2e-test` · `skill-gform-parser`

## 목적 ^purpose

스펙 문서가 구현 완료 후에도 코드와 충돌하지 않도록, 코드가 SSOT가 되는 지점을 명시하고 문서를 목적/의도 중심으로 축소하는 전환 루틴을 제공한다.

## 사용 맥락 ^context

specification/implementation/validation 문서를 코드와 함께 유지해야 할 때,
특히 구현 완료 직후 문서에 복사된 타입과 API 시그니처를 소스 참조로 바꿀 때 유용하다.

## 설계 의도 ^intent

문서에는 왜와 제약을 남기고, 코드에는 타입과 시그니처를 남기는 분업을 강제한다.
같은 사실을 문서와 코드에 중복 기록하면 drift가 생기므로, 구현 완료 후에는 코드 참조 전환을 기본으로 삼는다.

## 피드백 규칙 ^feedback

- 구현 완료 후에도 코드 블록이 남아 있으면 소스 참조 전환 체크리스트를 강화한다.
- 같은 서비스에서 drift가 반복되면 `svc` 기준 문서 묶음 전체를 점검 대상으로 올린다.

## 주의사항 ^caveat

문서를 지나치게 축소하면 의도와 제약까지 사라질 수 있으므로, 코드로 표현 불가능한 판단 근거는 남겨야 한다.

## 관련 소스

- `skills/spec-lifecycle/SKILL.md`
