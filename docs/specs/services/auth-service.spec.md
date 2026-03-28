---
def:
  id: auth-service-spec
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: auth
  tags: [security, tier-backend]
  links:
    - target: permission-system
      type: depends_on
---
# Auth Service

## 목적 ^purpose

인증/인가를 담당하는 서비스. rbac prefix를 소유하여 역할 기반 접근 제어 이벤트를 생산한다. permission-engine 라이브러리를 사용하여 bitmask 권한 압축과 계층 상속을 수행한다.
