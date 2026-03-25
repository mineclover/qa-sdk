---
def:
  id: wi-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: wi-math
      type: implements
---
# Weighted-Index 퍼블릭 API

## 목적 ^purpose

WeightedIndex(encode/decode/encodeFromRecord/decodeToRecord), LabelRegistry(레이블 관리), PrefixCodec(시맨틱 주소 직렬화/파싱)의 퍼블릭 API.

## 구성 ^overview

WeightedIndex: encode(coords→int), decode(int→coords), encodeFromRecord, decodeToRecord, strides, size, shape.
LabelRegistry: 레이블 등록/조회, 축 관리.
PrefixCodec: colonProtocol("perm:v1:42"), uriProtocol("wi://perm/v1/42"), compactProtocol("perm-v1-42").
