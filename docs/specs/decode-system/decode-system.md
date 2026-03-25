---
def:
  id: decode-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: decode-service
  tags: [entry-point, tier-infra]
  links:
    - target: decode-api
      type: contains
    - target: decode-bundle
      type: contains
    - target: decode-deploy
      type: contains
---

# Decode 시스템

## 목적 ^purpose

MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스. Edge Worker부터 Standalone Node.js까지 다양한 배포 형태를 지원한다.

## 구성 ^overview

overview: 총 3개 멤버.
- `decode-api`: 주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트.
- `decode-bundle`: decode에 필요한 최소 데이터(entity name → ID 매핑)를 DecodeMap 번들로 패키징하고, 캐시/갱신을 관리한다.
- `decode-deploy`: Decode Service의 3가지 배포 형태와 각각의 제약 조건을 정의한다.
