---
def:
  id: pipeline-enrichment
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [observability, tier-infra]
  links:
    - target: pipeline-monitoring
      type: depends_on
---
# enrichAddressContext 미들웨어

## 목적 ^purpose

수집된 이벤트의 address_context를 보강하는 Phase 1 미들웨어. prefix별 좌표를 파싱하고, 누락된 컨텍스트를 카탈로그에서 파생한다.
