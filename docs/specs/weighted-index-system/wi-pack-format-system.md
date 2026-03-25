---
def:
  id: wi-pack-format-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  links:
    - target: wi-pack-format-def
      type: contains
    - target: wi-format-registry
      type: contains
    - target: wi-hex-ops
      type: contains
    - target: wi-capacity-planning
      type: contains
    - target: wi-semantic-address
      type: contains
    - target: wi-layout-protocol
      type: contains
---
# Pack Format 시스템

## 목적 ^purpose

WeightedIndex 주소를 다양한 이진 포맷으로 직렬화하고, capacity 계획, hex 경계 연산, 레이아웃 프로토콜을 제공하는 포맷 레이어.

## 구성 ^overview

6개 정의: PackFormat(포맷 정의), FormatRegistry(수평 확장), hex 연산(경계/자릿수), capacity 계획(fitShape/fitLayout/planCapacity), SemanticAddress(프로토콜 독립), createLayoutProtocol(hex container).
