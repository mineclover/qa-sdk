---
def:
  id: gateway-routing
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: gateway
  tags: [tier-backend]
  links:
    - target: gateway-service-spec
      type: refines
---
# Gateway — feature/func_def

## 목적 ^purpose

API 라우팅 로직. path prefix strip, 서비스 디스패치, 헬스체크 프로빙.
