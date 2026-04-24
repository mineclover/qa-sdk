---
def:
  tier: component
  id: skill-infra-status
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [infrastructure, status]
  links:
    - target: infra-skill-group
      type: refines
---

# Skill — infra-status

## 탐색 ^navigation

skill-catalog-system > infra-skill-group > **skill-infra-status**

## 목적 ^purpose

fleet 서비스 상태, 배포/실행 현황, tier별 그룹핑을 빠르게 조회한다.

## 사용 맥락 ^context

서비스가 떠 있는지, 어떤 환경에 배포됐는지, 연결 가능한 endpoint가 무엇인지 확인할 때 사용한다.

## 피드백 규칙 ^feedback

- status와 discover 결과가 다르면 registry service profile과 infra monitor registration drift로 본다.

## 관련 소스

- `skills/infra-status/SKILL.md`

