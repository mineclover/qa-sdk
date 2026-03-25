---
def:
  id: wi-layout-protocol
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  links:
    - target: wi-semantic-address
      type: depends_on
    - target: wi-pack-format-def
      type: depends_on
---
# createLayoutProtocol

## 목적 ^purpose

SemanticAddress를 UUID/hex 컨테이너에 패킹하는 레이아웃 프로토콜 팩토리. DB 저장/조회에 최적화된 이진 직렬화를 제공한다.
