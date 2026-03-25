---
def:
  id: wi-codec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  links:
    - target: wi-api
      type: depends_on
---
# PrefixCodec + 직렬화 프로토콜

## 목적 ^purpose

시맨틱 주소(prefix:version:address)를 다양한 포맷으로 직렬화/파싱하는 코덱. colon, URI, compact, layout(UUID/hex) 프로토콜을 제공한다.

## 구성 ^overview

4개 프로토콜: colonProtocol("perm:v1:42"), uriProtocol("wi://perm/v1/42"), compactProtocol("perm-v1-42"), createLayoutProtocol(UUID/hex DB 저장).
