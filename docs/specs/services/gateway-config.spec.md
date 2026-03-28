---
def:
  id: gateway-config
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: gateway
  tags: [tier-infra]
  links:
    - target: gateway-service-spec
      type: refines
---
# Gateway — data/domain_data

## 목적 ^purpose

게이트웨이 라우팅 설정. 서비스별 경로 매핑, strip prefix 규칙, 타임아웃.
