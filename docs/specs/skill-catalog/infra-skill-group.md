---
def:
  id: infra-skill-group
  tier: system
  level: group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [entry-point, infrastructure]
  links:
    - target: skill-infra-deploy
      type: contains
    - target: skill-infra-discover
      type: contains
    - target: skill-infra-export
      type: contains
    - target: skill-infra-status
      type: contains
    - target: skill-catalog-system
      type: depends_on
sources:
  - skills/infra-deploy/SKILL.md
  - skills/infra-discover/SKILL.md
  - skills/infra-export/SKILL.md
  - skills/infra-status/SKILL.md
  - packages/infra-engine/package.json
---

# Infra Skill Group

## 탐색 ^navigation

skill-catalog-system > **infra-skill-group**

## 목적 ^purpose

로컬 K3s/Pulumi 기반 서비스 운영을 배포, 조회, export, 상태 확인으로 나눠 수행하는 infra skill 묶음이다.

## 구성 ^overview

- `infra-deploy` — Config→Provision→Register→Verify→Observe 배포 파이프라인 실행
- `infra-discover` — 서비스 연결정보와 배포/문서/테스트 상태 조회
- `infra-export` — 연결 정보를 `.env`, TypeScript, compose override, 문서로 export
- `infra-status` — fleet 서비스 상태와 tier별 배포 현황 조회

## 경계 ^boundary

실행 정의는 `skills/infra-*/SKILL.md`가 소유한다. 이 문서는 infra skill의 목적과 선택 기준만 소유한다.

