---
def:
  tier: component
  id: skill-infra-deploy
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [infrastructure, deploy]
  links:
    - target: infra-skill-group
      type: refines
sources:
  - skills/infra-deploy/SKILL.md
---

# Skill — infra-deploy

## 탐색 ^navigation

skill-catalog-system > infra-skill-group > **skill-infra-deploy**

## 목적 ^purpose

Pulumi + K3s 로컬 배포를 Config→Provision→Register→Verify→Observe 단계로 실행한다.

## 사용 맥락 ^context

서비스를 로컬 클러스터에 올리고 registry/service profile/health gate까지 확인해야 할 때 사용한다.

## 피드백 규칙 ^feedback

- verify 또는 observe 단계 실패가 반복되면 deployment profile과 service discovery 문서를 함께 점검한다.

## 관련 소스

- `skills/infra-deploy/SKILL.md`

