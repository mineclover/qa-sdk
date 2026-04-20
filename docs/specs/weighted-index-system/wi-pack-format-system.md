---
def:
  id: wi-pack-format-system
  tier: system
  address: def_document:v2:68647
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural]
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

- `wi-pack-format-def`: shape을 이진 필드에 배치하는 포맷 규칙.
- `wi-format-registry`: PackFormat을 등록/조회하는 수평 확장 레지스트리.
- `wi-hex-ops`: formatHex/parseHex(포맷별 직렬화), hexBoundary/hexCeil/hexFloor(hex 자릿수 경계 연산).
- `wi-capacity-planning`: fitShape(shape 용량 맞춤), fitLayout(shape + layout 통합), planCapacity(growth-aware capacity 제안).
- `wi-semantic-address`: 프로토콜 독립적인 정보 좌표.
- `wi-layout-protocol`: SemanticAddress를 UUID/hex 컨테이너에 패킹하는 레이아웃 프로토콜 팩토리.
