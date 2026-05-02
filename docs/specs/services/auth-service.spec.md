---
def:
  tier: component
  id: auth-service-spec
  address: def_document:v2:68612
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: auth
  tags: [external, security]
  links:
    - target: permission-system
      type: depends_on
---
# Auth Service

## 목적 ^purpose

인증/인가를 담당하는 서비스. rbac prefix를 소유하여 역할 기반 접근 제어 이벤트를 생산한다. permission-engine 라이브러리를 사용하여 bitmask 권한 압축과 계층 상속을 수행한다.

## 구성 ^overview

Auth Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
